const express = require('express');
const router = express.Router();
const aiVideoController = require('../controllers/aiVideoController');
const authMiddleware = require('../middleware/authMiddleware');
router.use(authMiddleware);
router.post(
  '/generate',
  aiVideoController.uploadMiddleware,
  aiVideoController.generate
);
router.get('/', aiVideoController.list);
router.get('/:id', aiVideoController.getById);
router.post('/:id/reupload-cloudinary', aiVideoController.reupload);
router.delete('/:id', aiVideoController.remove);
module.exports = router;
