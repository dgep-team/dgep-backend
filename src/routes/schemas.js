// Request rules used by more than one routes file.
const { z } = require('zod');

const staffBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  role: z.enum(['MANAGER', 'RECEPTION', 'HOUSEKEEPING', 'MAINTENANCE']),
});

module.exports = { staffBody };
