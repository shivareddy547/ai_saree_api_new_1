const instagramService = require('../services/instagramService');
/**
 * Post a video to Instagram Reels
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.postToInstagram = async (req, res, next) => {
  try {
    const { video_url, media_type = 'REELS' } = req.body;
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
    const result = await instagramService.postReel(video_url, media_type);
    res.status(200).json({
      success: true,
      data: {
        media_id: result.media_id,
        publish_id: result.publish_id,
        video_url: video_url
      },
      message: 'Video posted to Instagram successfully'
    });
  } catch (error) {
    console.error('Instagram post error:', error);
    next(error);
  }
};
/**
 * Get Instagram account status/info
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getInstagramStatus = async (req, res, next) => {
  try {
    const status = await instagramService.getAccountStatus();
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
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.disconnectInstagram = async (req, res, next) => {
  try {
    const result = await instagramService.disconnectAccount();
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
