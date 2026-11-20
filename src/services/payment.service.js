// Paying for a booking with Paystack (PRD BR-10, BR-11):
//   1. POST /bookings/:id/payments -> Paystack page (authorizationUrl)
//   2. the guest pays; Paystack sends them back to the frontend with ?reference=...
//   3. GET /payments/verify/:reference and the webhook both report the result.
//      Whichever comes first applies it; the other changes nothing.
const { randomUUID } = require('crypto');
const prisma = require('../config/db');
const config = require('../config');
const AppError = require('../utils/AppError');
const paystack = require('./paystack');
const { findBookingForUser, HOLD_MINUTES } = require('./booking.service');

async function startPayment(bookingId, user) {
  const booking = await findBookingForUser(bookingId, user, { guest: true, room: { include: { hotel: true } } });
  if (booking.status !== 'PENDING') throw new AppError(409, 'BOOKING_CLOSED', 'This booking is already paid or cancelled');
  if (Date.now() - booking.createdAt.getTime() > HOLD_MINUTES * 60000) {
    throw new AppError(409, 'HOLD_EXPIRED', 'Your room hold ran out. Please book again.');
  }

  const reference = `DGEP-${randomUUID()}`;
  await prisma.payment.create({ data: { bookingId: booking.id, reference, amount: booking.totalAmount } });
  const { hotel } = booking.room;
  const data = await paystack.initialize({
    email: booking.guest.email,
    amount: booking.totalAmount, // kobo
    currency: 'NGN',
    reference,
    callback_url: config.paystackCallbackUrl,
    metadata: { bookingId: booking.id },
    ...(hotel.paystackSubaccount && { subaccount: hotel.paystackSubaccount }),
  });
  return { authorizationUrl: data.authorization_url, reference };
}

// Applies a Paystack transaction result once. tx = Paystack's transaction data.
async function applyResult(reference, tx) {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment) return null;

  const paid = tx.status === 'success' && tx.currency === 'NGN' && tx.amount >= payment.amount;
  const failed = ['failed', 'abandoned', 'reversed'].includes(tx.status);
  if (!paid && !failed) return payment; // still waiting

  // Only the first report changes anything
  const { count } = await prisma.payment.updateMany({
    where: { id: payment.id, status: 'INITIATED' },
    data: paid ? { status: 'SUCCESS', paidAt: new Date(tx.paid_at ?? Date.now()), channel: tx.channel } : { status: 'FAILED' },
  });
  if (count && paid) await confirmBooking(payment.bookingId);
  return prisma.payment.findUnique({ where: { id: payment.id } });
}

// Paid: confirm. If the hold ran out meanwhile, take the room back when it's still free.
async function confirmBooking(bookingId) {
  try {
    await prisma.booking.updateMany({ where: { id: bookingId, status: { in: ['PENDING', 'CANCELLED'] } }, data: { status: 'CONFIRMED' } });
  } catch (err) {
    if (!String(err.message).includes('bookings_no_overlap')) throw err; // room taken: stays CANCELLED, needs a refund
  }
}

async function verifyPayment(reference, user) {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment) throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  await findBookingForUser(payment.bookingId, user); // only the guest's own payment

  const result = await applyResult(reference, await paystack.verify(reference));
  const booking = await findBookingForUser(payment.bookingId, user, { payments: { orderBy: { createdAt: 'desc' } } });
  const status = { SUCCESS: 'success', FAILED: 'failed', INITIATED: 'pending' }[result.status];
  return {
    status,
    booking,
    ...(status === 'success' && booking.status === 'CANCELLED' && { refundNeeded: true }), // room was taken after the hold ran out
  };
}

// Paystack calls this directly. Answer 200 fast, or Paystack retries.
async function handleWebhook(rawBody, signature, event) {
  if (!paystack.isValidSignature(rawBody, signature)) throw new AppError(401, 'INVALID_SIGNATURE', 'Not from Paystack');
  if (event.event === 'charge.success') await applyResult(event.data.reference, event.data);
  return { received: true };
}

module.exports = { startPayment, verifyPayment, handleWebhook, applyResult };
