// Private file storage (Neon Object Storage, which speaks the S3 API).
// We save the file's key in the database, never a public link. To show a
// file, create a short-lived link with getFileUrl().
require('../config'); // loads the AWS_* settings from .env
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({ forcePathStyle: true }); // Neon needs path-style URLs

async function uploadFile(bucket, key, file) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: file.buffer, ContentType: file.mimetype }));
  return key;
}

// The link stops working after `seconds` (default 5 minutes)
function getFileUrl(bucket, key, seconds = 300) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: seconds });
}

module.exports = { uploadFile, getFileUrl };
