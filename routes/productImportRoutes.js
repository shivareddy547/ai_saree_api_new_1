const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const productImportController = require('../controllers/productImportController');
const uploadDir = path.join(__dirname, '../uploads/tmp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'import-' + unique + path.extname(file.originalname || '.zip'));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
});
// POST /api/products/import
router.post(
  '/products/import',
  upload.single('file'),
  productImportController.importProducts
);
module.exports = router;
