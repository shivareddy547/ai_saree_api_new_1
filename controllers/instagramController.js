const instagramService = require('../services/instagramService');
/**
 * Get Instagram OAuth URL
 */
exports.getOAuthUrl = async (req, res, next) => {
  try {
    const { redirectUri } = req.query;
    const url = instagramService.getOAuthUrl(redirectUri);
    res.status(200).json({
      success: true,
      data: { url },
      message: 'OAuth URL generated successfully'
    });
  } catch (error) {
    console.error('OAuth URL error:', error);
    next(error);
  }
};
/**
 * Connect Instagram account using authorization code
 */
exports.connectInstagram = async (req, res, next) => {
  try {
    const { code, redirectUri } = req.body;
    if (!code) {
      const err = new Error('Authorization code is required');
      err.status = 400;
      throw err;
    }
    const userId = req.user.id;
    const result = await instagramService.connectAccount(userId, code, redirectUri);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Instagram account connected successfully'
    });
  } catch (error) {
    console.error('Instagram connect error:', error);
    next(error);
  }
};
/**
 * Get Instagram account status for current user
 */
exports.getInstagramStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const status = await instagramService.getAccountStatus(userId);
    res.status(200).json({
      success: true,
      data: status,
      message: 'Instagram account status retrieved successfully'
    });
  } catch (error) {
    console.error('Instagram status error:', error);
    next(error);
  }
};
/**
 * Disconnect Instagram account
 */
exports.disconnectInstagram = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await instagramService.disconnectAccount(userId);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Instagram account disconnected successfully'
    });
  } catch (error) {
    console.error('Instagram disconnect error:', error);
    next(error);
  }
};
/**
 * Post a video to Instagram (Reels or Feed)
 */
exports.postToInstagram = async (req, res, next) => {
  try {
    const { video_url, media_type = 'REELS', caption = '' } = req.body;
    const userId = req.user.id;
    if (!video_url) {
      const err = new Error('video_url is required');
      err.status = 400;
      throw err;
    }
    // Validate video_url format
    if (!video_url.startsWith('http://') && !video_url.startsWith('https://')) {
      const err = new Error('video_url must be a valid HTTP/HTTPS URL');
      err.status = 400;
      throw err;
    }
    // Validate media_type: only REELS and VIDEO are supported
    if (media_type !== 'REELS' && media_type !== 'VIDEO') {
      const err = new Error('media_type must be either "REELS" or "VIDEO"');
      err.status = 400;
      throw err;
    }
    const result = await instagramService.postReel(userId, video_url, media_type, caption);
    res.status(200).json({
      success: true,
      data: {
        media_id: result.media_id,
        publish_id: result.publish_id,
        video_url: video_url,
        media_type: media_type
      },
      message: `Video posted to Instagram as ${media_type} successfully`
    });
  } catch (error) {
    console.error('Instagram post error:', error);
    // Send more detailed error to client
    const status = error.status || 500;
    const message = error.message || 'Failed to post video to Instagram';
    res.status(status).json({
      success: false,
      error: message,
      message: message,
      timestamp: Date.now()
    });
  }
};
