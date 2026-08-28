const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const aiVideoController = require('../controllers/aiVideoController');

router.use(authMiddleware);

router.get('/', aiVideoController.list);
router.get('/:id', aiVideoController.getById);
router.get('/:id/status', aiVideoController.pollStatus);
router.post('/save', aiVideoController.save);
router.post('/generate-ai', aiVideoController.generateAi);
router.post('/generate-grok', aiVideoController.generateGrok);
router.post('/tts', aiVideoController.tts);

module.exports = router;
