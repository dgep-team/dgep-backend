// Guest uploads an ID photo -> status PENDING -> staff marks it VERIFIED or FAILED.
const { randomUUID } = require('crypto');
const prisma = require('../config/db');
const config = require('../config');
const AppError = require('../utils/AppError');
const { findBookingForUser, GUEST_FIELDS } = require('./booking.service');
const storage = require('./storage.service');

const OPEN_STATUSES = ['PENDING', 'CONFIRMED'];
// ----- Guest -----

async function submit(bookingId, user, { idType, idNumber }, files = {}) {
  const booking = await findBookingForUser(bookingId, user, { idVerification: true });
  if (!OPEN_STATUSES.includes(booking.status)) throw new AppError(409, 'BOOKING_CLOSED', 'This booking is cancelled or already checked out');
  if (booking.idVerification?.status === 'VERIFIED') throw new AppError(409, 'ID_ALREADY_VERIFIED', 'Your ID is already verified');

  const idImage = files.idImage?.[0];
  const selfie = files.selfie?.[0];
  if (!idImage) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Some fields are missing or invalid', [{ field: 'idImage', message: 'Required' }]);
  }

  // A new folder per upload, so a new upload never overwrites an old one
  const folder = `bookings/${booking.id}/${randomUUID()}`;
  const data = {
    idType,
    idNumber,
    idImageKey: await storage.uploadFile(config.idBucket, `${folder}/id`, idImage),
    selfieKey: selfie ? await storage.uploadFile(config.idBucket, `${folder}/selfie`, selfie) : null,
    status: 'PENDING',
    reason: null,
    reviewedBy: null,
  };
  const verification = await prisma.idVerification.upsert({
    where: { bookingId: booking.id },
    create: { bookingId: booking.id, ...data },
    update: data,
  });
  return { verificationId: verification.id, status: verification.status };
}

async function getStatus(bookingId, user) {
  const { idVerification: v } = await findBookingForUser(bookingId, user, { idVerification: true });
  if (!v) return { verificationId: null, status: 'NOT_SUBMITTED', reason: null };
  return { verificationId: v.id, status: v.status, reason: v.reason };
}

// ----- Staff -----

// Short-lived links to the photos, so staff can look at them
async function withImageUrls(v) {
  const { idImageKey, selfieKey, ...rest } = v;
  return {
    ...rest,
    idImageUrl: await storage.getFileUrl(config.idBucket, idImageKey),
    selfieUrl: selfieKey ? await storage.getFileUrl(config.idBucket, selfieKey) : null,
  };
}

async function list({ status }) {
  const verifications = await prisma.idVerification.findMany({
    where: status ? { status } : {},
    include: { booking: { include: { guest: { select: GUEST_FIELDS }, room: true } } },
    orderBy: { createdAt: 'asc' }, // oldest first: who has waited longest
  });
  return Promise.all(verifications.map(withImageUrls));
}

async function review(id, staff, { status, reason }) {
  const verification = await prisma.idVerification.update({
    where: { id }, // unknown id -> 404 (see errorHandler)
    data: { status, reason: status === 'FAILED' ? reason : null, reviewedBy: staff.id },
  });
  return withImageUrls(verification);
}

module.exports = { submit, getStatus, list, review };
