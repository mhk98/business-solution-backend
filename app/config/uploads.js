const path = require("path");

// Resolve once so Multer and Express always use the same physical directory.
const uploadDir = path.resolve(
  __dirname,
  "../..",
  process.env.UPLOAD_DIR || "images",
);

// Store public paths in the database, never the server's filesystem paths.
const getUploadedFilePath = (file) =>
  file ? `images/${file.filename}` : undefined;

module.exports = { uploadDir, getUploadedFilePath };
