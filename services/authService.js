const instagramService =
  require('../services/instagramService');

/**
 * GET /api/instagram/auth
 *
 * Start Instagram OAuth
 */
exports.auth = async (req, res) => {
  try {

    const authUrl =
      instagramService.getOAuthUrl();

    return res.redirect(
      authUrl
    );

  } catch (error) {

    console.error(
      'Instagram auth error:',
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message
    });
  }
};

/**
 * GET /api/instagram/callback
 *
 * Instagram redirects here
 */
exports.callback = async (
  req,
  res
) => {

  try {

    const {
      code,
      error,
      error_reason,
      error_description
    } = req.query;

    console.log(
      'Instagram OAuth callback:',
      {
        codeReceived: !!code,
        error,
        error_reason,
        error_description
      }
    );

    // User rejected authorization
    if (error) {

      return res.status(400).json({
        success: false,

        error,

        error_reason,

        error_description
      });
    }

    if (!code) {

      return res.status(400).json({
        success: false,

        error:
          'Instagram authorization code was not received'
      });
    }

    /**
     * IMPORTANT:
     *
     * We need to know which application user
     * initiated the OAuth request.
     *
     * For production, use a signed state parameter.
     *
     * For now, this expects:
     *
     * ?user_id=123
     *
     * You should replace this with your
     * authenticated session/JWT user ID.
     */

    const userId =
      req.query.user_id;

    if (!userId) {

      return res.status(400).json({
        success: false,

        error:
          'user_id is required to connect Instagram account'
      });
    }

    const result =
      await instagramService.connectAccount(
        userId,
        code
      );

    return res.json({
      success: true,

      message:
        'Instagram account connected successfully',

      data:
        result
    });

  } catch (error) {

    console.error(
      'Instagram OAuth callback error:',
      error
    );

    return res.status(500).json({
      success: false,

      error:
        error.message
    });
  }
};

/**
 * GET /api/instagram/status
 */
exports.status = async (
  req,
  res
) => {

  try {

    const userId =
      req.user.id;

    const result =
      await instagramService.getAccountStatus(
        userId
      );

    return res.json({
      success: true,

      data:
        result
    });

  } catch (error) {

    return res.status(500).json({
      success: false,

      error:
        error.message
    });
  }
};

/**
 * DELETE /api/instagram/disconnect
 */
exports.disconnect = async (
  req,
  res
) => {

  try {

    const userId =
      req.user.id;

    const result =
      await instagramService.disconnectAccount(
        userId
      );

    return res.json({
      success: true,

      data:
        result
    });

  } catch (error) {

    return res.status(500).json({
      success: false,

      error:
        error.message
    });
  }
};

/**
 * POST /api/instagram/reels
 */
exports.postReel = async (
  req,
  res
) => {

  try {

    const userId =
      req.user.id;

    const {
      videoUrl,
      caption
    } = req.body;

    if (!videoUrl) {

      return res.status(400).json({
        success: false,

        error:
          'videoUrl is required'
      });
    }

    const result =
      await instagramService.postReel(
        userId,
        videoUrl,
        caption
      );

    return res.json({
      success: true,

      data:
        result
    });

  } catch (error) {

    console.error(
      'Instagram Reel controller error:',
      error
    );

    return res.status(500).json({
      success: false,

      error:
        error.message
    });
  }
};