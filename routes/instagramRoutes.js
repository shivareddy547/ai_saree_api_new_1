const express = require('express');
const router = express.Router();
const instagramController = require('../controllers/instagramController');
const authMiddleware = require('../middleware/authMiddleware');
// Apply authentication middleware to all Instagram routes
router.use(authMiddleware);
/**
 * POST /api/instagram/post
 * Post a video to Instagram Reels
 * Body: { video_url: string, media_type?: string }
 */
router.post('/post', instagramController.postToInstagram);
/**
 * GET /api/instagram/status
 * Get Instagram account status/info
 */
router.get('/status', instagramController.getInstagramStatus);
/**
 * POST /api/instagram/disconnect
 * Disconnect Instagram account
 */
router.post('/disconnect', instagramController.disconnectInstagram);
module.exports = router;
