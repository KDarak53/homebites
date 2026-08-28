const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// Local disk storage — the pragmatic choice for a project without an S3/
// Cloudinary account configured yet. Swapping to cloud storage later only
// means changing this `storage` config; the route contract (multipart
// upload in, { url } out) stays the same.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG or WEBP images are allowed'));
    }
    cb(null, true);
  },
});

// @route POST /api/uploads/image  (vendor only — dish photos, kitchen photos)
router.post('/image', protect, requireRole('vendor'), upload.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No image file provided');
  }
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

module.exports = router;
