const express = require('express');
const router = express.Router();
const instagramController = require('../controllers/instagramController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication middleware to all Instagram routes
router.use(authMiddleware);

/**
 * GET /api/instagram/oauth-url
 * Get Instagram OAuth URL
 * Query: redirectUri
 */
router.get('/oauth-url', instagramController.getOAuthUrl);

/**
 * POST /api/instagram/connect
 * Connect Instagram account using authorization code
 * Body: { code: string, redirectUri?: string }
 */
router.post('/connect', instagramController.connectInstagram);

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

/**
 * POST /api/instagram/post
 * Post a video to Instagram Reels
 * Body: { video_url: string, media_type?: string }
 */
router.post('/post', instagramController.postToInstagram);

module.exports = router;
