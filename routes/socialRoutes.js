const express = require('express');
const router = express.Router();
const socialController = require('../controllers/socialController');
const authMiddleware = require('../middleware/authMiddleware');
// All routes require authentication
router.use(authMiddleware);
// Get OAuth URL for a provider
router.get('/oauth-url/:providerId', socialController.getOAuthUrl);
// Connect with code
router.post('/connect', socialController.connect);
// Get all connections for user
router.get('/status', socialController.getConnections);
// Get status for a specific provider
router.get('/status/:providerId', socialController.getConnectionStatus);
// Disconnect
router.delete('/disconnect/:connectionId', socialController.disconnect);
module.exports = router;
