const express = require('express');
const router = express.Router();
const instagramController = require('../controllers/instagramController');
const authMiddleware = require('../middleware/authMiddleware');
// Apply authentication middleware to all Instagram routes
router.use(authMiddleware);
router.get('/oauth-url', instagramController.getOAuthUrl);
router.post('/connect', instagramController.connectInstagram);
router.get('/status', instagramController.getInstagramStatus);
router.post('/disconnect', instagramController.disconnectInstagram);
router.post('/post', instagramController.postToInstagram);
module.exports = router;
