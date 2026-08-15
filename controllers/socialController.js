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
    const { code, state } = req.body;
    if (!code || !state) {
      const err = new Error('Missing code or state');
      err.status = 400;
      throw err;
    }
    const userId = req.user.id;
    const result = await socialService.connect(userId, code, state);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Social account connected successfully',
    });
  } catch (error) {
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
