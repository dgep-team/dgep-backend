// Request rules used by more than one routes file.
const { z } = require('zod');

const email = z.string().trim().toLowerCase().email();
const password = z.string().min(8, 'Use at least 8 characters').max(72);
const name = z.string().trim().min(1).max(50);
const phone = z.string().trim().regex(/^\+?\d{7,15}$/, 'Digits only, e.g. +2348012345678');
const loginBody = z.object({ email, password: z.string().min(1).max(72) });

// The first password is given when the staff member is added; they log in with it
const staffBody = z.object({
  email,
  password,
  firstName: name,
  lastName: name,
  role: z.enum(['MANAGER', 'RECEPTION', 'HOUSEKEEPING', 'MAINTENANCE']),
});

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Not a real date');

// Optional stay dates: both or neither, check-out after check-in
const stayDates = (fields = {}) =>
  z
    .object({ checkIn: date.optional(), checkOut: date.optional(), ...fields })
    .refine((q) => !q.checkIn === !q.checkOut, { path: ['checkOut'], message: 'Send checkIn and checkOut together' })
    .refine((q) => !q.checkIn || q.checkOut > q.checkIn, { path: ['checkOut'], message: 'Must be after checkIn' });

module.exports = { email, password, name, phone, loginBody, staffBody, date, stayDates };
