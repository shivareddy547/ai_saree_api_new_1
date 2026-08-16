const socialService = require('../services/socialService');

/**
 * Get OAuth URL for a provider
 */
exports.getOAuthUrl = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const url = await socialService.getOAuthUrl(providerId, userId);
    res.status(200).json({
      success: true,
      data: { url },
      message: 'OAuth URL generated',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Connect with authorization code
 */
exports.connect = async (req, res, next) => {
  try {
    const { code, state, provider } = req.body;
    
    console.log('Connect request body:', { code: code ? 'present' : 'missing', state, provider });
    
    if (!code) {
      const err = new Error('Authorization code is required');
      err.status = 400;
      throw err;
    }

    // If state is missing but provider is provided, use the provider as state
    // This handles the case where the frontend sends provider separately
    let finalState = state;
    if (!finalState && provider) {
      console.log('State missing, using provider as state:', provider);
      finalState = provider;
    }

    if (!finalState) {
      const err = new Error('State parameter is required');
      err.status = 400;
      throw err;
    }

    const userId = req.user.id;
    const result = await socialService.connect(userId, code, finalState);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Social account connected successfully',
    });
  } catch (error) {
    console.error('Connect error:', error);
    next(error);
  }
};

/**
 * Get all social connections for the current user
 */
exports.getConnections = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const connections = await socialService.getConnections(userId);
    res.status(200).json({
      success: true,
      data: connections,
      message: 'Connections fetched',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get status for a specific provider connection
 */
exports.getConnectionStatus = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const status = await socialService.getConnectionStatus(userId, providerId);
    res.status(200).json({
      success: true,
      data: status,
      message: 'Connection status fetched',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disconnect a social connection
 */
exports.disconnect = async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id;
    await socialService.disconnect(userId, connectionId);
    res.status(200).json({
      success: true,
      message: 'Disconnected successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Post video to a social provider
 */
exports.postToSocial = async (req, res, next) => {
  try {
    const { providerId, video_url, media_type = 'REELS', caption = '' } = req.body;
    const userId = req.user.id;

    console.log('Social post request:', { userId, providerId, video_url, media_type });

    if (!providerId) {
      const err = new Error('providerId is required');
      err.status = 400;
      throw err;
    }
    if (!video_url) {
      const err = new Error('video_url is required');
      err.status = 400;
      throw err;
    }
    if (!video_url.startsWith('http://') && !video_url.startsWith('https://')) {
      const err = new Error('video_url must be a valid HTTP/HTTPS URL');
      err.status = 400;
      throw err;
    }

    const result = await socialService.postVideo(userId, providerId, video_url, media_type, caption);
    res.status(200).json({
      success: true,
      data: result,
      message: `Video posted successfully`,
    });
  } catch (error) {
    console.error('Social post error:', error);
    const status = error.status || 500;
    const message = error.message || 'Failed to post video';
    res.status(status).json({
      success: false,
      error: message,
      message: message,
      timestamp: Date.now()
    });
  }
};
