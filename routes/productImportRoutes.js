const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const productImportController = require('../controllers/productImportController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const uploadDir = path.join(os.tmpdir(), 'product-imports');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = String(file.originalname || 'upload')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const ok =
      name.endsWith('.xls') ||
      name.endsWith('.xlsx') ||
      name.endsWith('.zip');
    if (!ok) {
      return cb(new Error('Only .xls, .xlsx or .zip files are allowed'));
    }
    cb(null, true);
  },
});

/**
 * POST /api/products/import
 * multipart form-data:
 *   - file: Excel or ZIP
 *   - importType: excel | excel_images | excel_videos | excel_images_videos
 */
router.post(
  '/products/import',
  authMiddleware,
  upload.single('file'),
  (req, res, next) => productImportController.importProducts(req, res, next)
);

module.exports = router;
