const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const storeSettingsController = require('../controllers/storeSettingsController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const uploadDir = path.join(os.tmpdir(), 'store-settings-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = String(file.originalname || 'upload').replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );
    cb(null, `${Date.now()}-${file.fieldname}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = /^image\//i.test(file.mimetype);
    if (!ok) {
      return cb(new Error('Only image files are allowed for logo and favicon'));
    }
    cb(null, true);
  },
});

// GET is public (storefront needs logo/favicon)
router.get('/', storeSettingsController.getSettings);

// PUT requires auth – multipart: name, caption, logo?, favicon?
router.put(
  '/',
  authMiddleware,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 },
  ]),
  storeSettingsController.updateSettings
);

module.exports = router;
