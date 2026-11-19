// Reads image files from a multipart/form-data request into memory.
//
//   router.post('/', uploadImages(['idImage', 'selfie']), controller.create);
//   // then: req.files.idImage[0].buffer
const multer = require('multer');
const AppError = require('../utils/AppError');

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// Check the file's first bytes, not just the name, so a renamed file is caught
const isJpeg = (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isPng = (b) => b.subarray(0, 4).toString('hex') === '89504e47';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SIZE } });

const uploadImages = (fields) => (req, res, next) => {
  upload.fields(fields.map((name) => ({ name, maxCount: 1 })))(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return next(new AppError(413, 'FILE_TOO_LARGE', 'Each file must be 5 MB or less'));
    if (err) return next(new AppError(400, 'INVALID_FILE', err.message));

    const files = Object.values(req.files || {}).flat();
    if (files.some((f) => !isJpeg(f.buffer) && !isPng(f.buffer))) {
      return next(new AppError(400, 'INVALID_FILE', 'Only JPEG or PNG images are allowed'));
    }
    next();
  });
};

module.exports = { uploadImages };
