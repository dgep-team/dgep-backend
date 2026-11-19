// Request rules used by more than one routes file.
const { z } = require('zod');

const staffBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
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

module.exports = { staffBody, date, stayDates };
