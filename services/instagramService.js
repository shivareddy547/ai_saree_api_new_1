const axios = require('axios');
const { User } = require('../models');
// Instagram API configuration
const INSTAGRAM_API_BASE = 'https://graph.instagram.com/v23.0';
const INSTAGRAM_OAUTH_BASE = 'https://api.instagram.com/oauth';
// Get Instagram App credentials from environment
const getAppCredentials = () => {
  const clientId = process.env.INSTAGRAM_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET must be configured in environment');
  }
  return { clientId, clientSecret };
};
/**
 * Get OAuth URL for Instagram authorization
 * @param {string} redirectUri - Redirect URI for OAuth callback
 * @returns {string} OAuth URL
 */
exports.getOAuthUrl = (redirectUri) => {
  const { clientId } = getAppCredentials();
  // Instagram Business scopes
  const scope = 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_manage_insights';
  // Use Instagram OAuth for Business API
  return `${INSTAGRAM_OAUTH_BASE}/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri || process.env.INSTAGRAM_REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&response_type=code&force_reauth=true`;
};
/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code from Instagram
 * @param {string} redirectUri - Redirect URI used in OAuth flow
 * @returns {Object} Token response data
 */
const exchangeCodeForToken = async (code, redirectUri) => {
  const { clientId, clientSecret } = getAppCredentials();
  try {
    const response = await axios.post(
      `${INSTAGRAM_OAUTH_BASE}/access_token`,
      {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri || process.env.INSTAGRAM_REDIRECT_URI,
        code: code
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Token exchange error:', error.response?.data);
    if (error.response) {
      throw new Error(`Instagram OAuth error: ${error.response.data?.error_message || error.response.data?.error || 'Failed to get access token'}`);
    }
    throw error;
  }
};
/**
 * Get long-lived access token
 * @param {string} shortLivedToken - Short-lived access token
 * @returns {Object} Long-lived token response
 */
const getLongLivedToken = async (shortLivedToken) => {
  const { clientSecret } = getAppCredentials();
  try {
    const response = await axios.get(
      `${INSTAGRAM_API_BASE}/access_token`,
      {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: clientSecret,
          access_token: shortLivedToken
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Token exchange error:', error.response?.data);
    if (error.response) {
      throw new Error(`Instagram token exchange error: ${error.response.data?.error?.message || 'Failed to get long-lived token'}`);
    }
    throw error;
  }
};
/**
 * Get Instagram user info
 * @param {string} accessToken - Access token
 * @param {string} accountId - Instagram account ID
 * @returns {Object} User info
 */
const getInstagramUserInfo = async (accessToken, accountId) => {
  try {
    const response = await axios.get(
      `${INSTAGRAM_API_BASE}/${accountId}`,
      {
        params: {
          fields: 'id,username,account_type,media_count',
          access_token: accessToken
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('User info error:', error.response?.data);
    if (error.response) {
      throw new Error(`Instagram user info error: ${error.response.data?.error?.message || 'Failed to get user info'}`);
    }
    throw error;
  }
};
/**
 * Connect Instagram account for a user
 * @param {string} userId - User ID
 * @param {string} code - OAuth authorization code
 * @param {string} redirectUri - Redirect URI
 * @returns {Object} Connection result
 */
exports.connectAccount = async (userId, code, redirectUri) => {
  try {
    // Exchange code for short-lived token
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    console.log('Token data received:', { 
      user_id: tokenData.user_id,
      access_token_length: tokenData.access_token?.length,
      expires_in: tokenData.expires_in
    });
    // Get long-lived token
    const longLivedData = await getLongLivedToken(tokenData.access_token);
    console.log('Long-lived token received:', {
      access_token_length: longLivedData.access_token?.length,
      expires_in: longLivedData.expires_in
    });
    // Get user info
    const userInfo = await getInstagramUserInfo(longLivedData.access_token, tokenData.user_id);
    console.log('User info received:', {
      username: userInfo.username,
      account_type: userInfo.account_type,
      media_count: userInfo.media_count
    });
    // Calculate token expiry
    const expiresIn = longLivedData.expires_in || 60 * 24 * 60 * 60; // Default 60 days
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    // Store in database
    await User.update({
      instagramAccessToken: longLivedData.access_token,
      instagramAccountId: tokenData.user_id,
      instagramUsername: userInfo.username,
      instagramAccountType: userInfo.account_type || 'business',
      instagramTokenExpiresAt: expiresAt
    }, {
      where: { id: userId }
    });
    return {
      connected: true,
      accountId: tokenData.user_id,
      username: userInfo.username,
      accountType: userInfo.account_type || 'business',
      mediaCount: userInfo.media_count || 0,
      tokenExpiresAt: expiresAt
    };
  } catch (error) {
    console.error('Connect account error:', error);
    throw error;
  }
};
/**
 * Get Instagram account status for a user
 * @param {string} userId - User ID
 * @returns {Object} Account status
 */
exports.getAccountStatus = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: [
      'instagramAccessToken',
      'instagramAccountId',
      'instagramUsername',
      'instagramAccountType',
      'instagramTokenExpiresAt'
    ]
  });
  if (!user) {
    throw new Error('User not found');
  }
  // Check if user has token and it's not expired
  if (!user.instagramAccessToken || !user.instagramAccountId) {
    return {
      connected: false,
      error: 'Instagram account not connected'
    };
  }
  // Check if token is expired
  if (user.instagramTokenExpiresAt && new Date(user.instagramTokenExpiresAt) < new Date()) {
    return {
      connected: false,
      accountId: user.instagramAccountId,
      username: user.instagramUsername,
      error: 'Token expired. Please reconnect your account.'
    };
  }
  // Test token by making a call to Instagram API
  try {
    const userInfo = await getInstagramUserInfo(
      user.instagramAccessToken,
      user.instagramAccountId
    );
    return {
      connected: true,
      accountId: user.instagramAccountId,
      username: userInfo.username || user.instagramUsername,
      accountType: userInfo.account_type || user.instagramAccountType,
      mediaCount: userInfo.media_count || 0,
      tokenExpiresAt: user.instagramTokenExpiresAt
    };
  } catch (error) {
    console.error('Status check error:', error.message);
    // If token is invalid, return disconnected
    return {
      connected: false,
      accountId: user.instagramAccountId,
      username: user.instagramUsername,
      error: 'Invalid or expired token. Please reconnect your account.'
    };
  }
};
/**
 * Disconnect Instagram account
 * @param {string} userId - User ID
 * @returns {Object} Disconnect result
 */
exports.disconnectAccount = async (userId) => {
  await User.update({
    instagramAccessToken: null,
    instagramAccountId: null,
    instagramUsername: null,
    instagramAccountType: null,
    instagramTokenExpiresAt: null
  }, {
    where: { id: userId }
  });
  return {
    disconnected: true,
    message: 'Instagram account disconnected successfully'
  };
};
/**
 * Get user's Instagram access token
 * @param {string} userId - User ID
 * @returns {Object} Access token and account ID
 */
const getUserAccessToken = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: ['instagramAccessToken', 'instagramAccountId', 'instagramTokenExpiresAt']
  });
  if (!user || !user.instagramAccessToken) {
    throw new Error('Instagram account not connected for this user');
  }
  // Check if token is expired
  if (user.instagramTokenExpiresAt && new Date(user.instagramTokenExpiresAt) < new Date()) {
    throw new Error('Instagram token expired. Please reconnect your account.');
  }
  return {
    accessToken: user.instagramAccessToken,
    accountId: user.instagramAccountId
  };
};
/**
 * Post a video reel to Instagram
 * @param {string} userId - User ID
 * @param {string} videoUrl - Public URL of the video to post
 * @param {string} mediaType - Media type (default: 'REELS')
 * @returns {Object} - { media_id, publish_id }
 */
exports.postReel = async (userId, videoUrl, mediaType = 'REELS') => {
  try {
    const { accessToken, accountId } = await getUserAccessToken(userId);
    console.log('Posting to Instagram:', { accountId, videoUrl, mediaType });
    // Step 1: Create media container
    const createMediaResponse = await axios.post(
      `${INSTAGRAM_API_BASE}/${accountId}/media`,
      {
        video_url: videoUrl,
        media_type: mediaType
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    const mediaId = createMediaResponse.data.id;
    if (!mediaId) {
      throw new Error('Failed to create media container: No ID returned');
    }
    console.log('Instagram media container created:', mediaId);
    // Step 2: Publish the media
    const publishResponse = await axios.post(
      `${INSTAGRAM_API_BASE}/${accountId}/media_publish`,
      {
        creation_id: mediaId
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    const publishId = publishResponse.data.id;
    if (!publishId) {
      throw new Error('Failed to publish media: No ID returned');
    }
    console.log('Instagram video published:', publishId);
    return {
      media_id: mediaId,
      publish_id: publishId
    };
  } catch (error) {
    console.error('Instagram post error:', error.response?.data || error.message);
    if (error.response) {
      const errorMessage = error.response.data?.error?.message || 
                         error.response.data?.message || 
                         'Instagram API error';
      throw new Error(`Instagram API error: ${errorMessage}`);
    }
    throw error;
  }
};
