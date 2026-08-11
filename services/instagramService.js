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
 */
exports.getOAuthUrl = (redirectUri) => {
  const { clientId } = getAppCredentials();
  const scope = 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_manage_insights';
  return `${INSTAGRAM_OAUTH_BASE}/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri || process.env.INSTAGRAM_REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&response_type=code&force_reauth=true`;
};
/**
 * Exchange authorization code for access token
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
 */
exports.connectAccount = async (userId, code, redirectUri) => {
  try {
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    console.log('Token data received:', { 
      user_id: tokenData.user_id,
      access_token_length: tokenData.access_token?.length,
      expires_in: tokenData.expires_in
    });
    const longLivedData = await getLongLivedToken(tokenData.access_token);
    console.log('Long-lived token received:', {
      access_token_length: longLivedData.access_token?.length,
      expires_in: longLivedData.expires_in
    });
    const userInfo = await getInstagramUserInfo(longLivedData.access_token, tokenData.user_id);
    console.log('User info received:', {
      username: userInfo.username,
      account_type: userInfo.account_type,
      media_count: userInfo.media_count
    });
    const expiresIn = longLivedData.expires_in || 60 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
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
  if (!user.instagramAccessToken || !user.instagramAccountId) {
    return {
      connected: false,
      error: 'Instagram account not connected'
    };
  }
  if (user.instagramTokenExpiresAt && new Date(user.instagramTokenExpiresAt) < new Date()) {
    return {
      connected: false,
      accountId: user.instagramAccountId,
      username: user.instagramUsername,
      error: 'Token expired. Please reconnect your account.'
    };
  }
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
 */
const getUserAccessToken = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: ['instagramAccessToken', 'instagramAccountId', 'instagramTokenExpiresAt']
  });
  if (!user || !user.instagramAccessToken) {
    throw new Error('Instagram account not connected for this user');
  }
  if (user.instagramTokenExpiresAt && new Date(user.instagramTokenExpiresAt) < new Date()) {
    throw new Error('Instagram token expired. Please reconnect your account.');
  }
  return {
    accessToken: user.instagramAccessToken,
    accountId: user.instagramAccountId
  };
};
/**
 * Post a video to Instagram (Reels or Feed)
 */
exports.postReel = async (userId, videoUrl, mediaType = 'REELS', caption = '') => {
  try {
    const { accessToken, accountId } = await getUserAccessToken(userId);
    console.log('Posting to Instagram:', { accountId, videoUrl, mediaType, caption });
    // Step 1: Create media container - access_token goes in params
    console.log('Attempting to create media container...');
    const createMediaResponse = await axios.post(
      `${INSTAGRAM_API_BASE}/${accountId}/media`,
      {
        video_url: videoUrl,
        media_type: mediaType,
        caption: caption
      },
      {
        params: {
          access_token: accessToken
        },
        timeout: 30000 // 30 seconds timeout
      }
    );
    console.log('Create media response status:', createMediaResponse.status);
    console.log('Create media response data:', JSON.stringify(createMediaResponse.data, null, 2));
    // Check for error in response
    if (createMediaResponse.data.error) {
      const errMsg = createMediaResponse.data.error.message || 'Instagram API error';
      console.error('Instagram API returned error:', errMsg);
      throw new Error(`Instagram API error: ${errMsg}`);
    }
    const mediaId = createMediaResponse.data.id;
    if (!mediaId) {
      console.error('No media ID returned. Full response:', createMediaResponse.data);
      throw new Error('Instagram API error: Media ID is not available - ' + JSON.stringify(createMediaResponse.data));
    }
    console.log('Instagram media container created with ID:', mediaId);
    // Wait for video to be processed
    console.log('Waiting for video processing...');
    let attempts = 0;
    let isReady = false;
    let lastStatus = 'unknown';
    while (attempts < 25) { // Increased attempts to 25 (75 seconds)
      await new Promise(resolve => setTimeout(resolve, 3000));
      try {
        const statusResponse = await axios.get(
          `${INSTAGRAM_API_BASE}/${mediaId}`,
          {
            params: {
              fields: 'status_code,status',
              access_token: accessToken
            }
          }
        );
        const status = statusResponse.data.status_code || statusResponse.data.status;
        lastStatus = status;
        console.log(`Video status (attempt ${attempts + 1}):`, status);
        if (status === 'FINISHED' || status === 'PUBLISHED') {
          isReady = true;
          break;
        } else if (status === 'ERROR') {
          // Get error details
          const errorResponse = await axios.get(
            `${INSTAGRAM_API_BASE}/${mediaId}`,
            {
              params: {
                fields: 'error',
                access_token: accessToken
              }
            }
          );
          const errorMsg = errorResponse.data.error?.message || 'Video processing failed';
          console.error('Video processing error:', errorMsg);
          throw new Error(`Instagram video processing error: ${errorMsg}`);
        }
      } catch (statusErr) {
        console.log('Status check error, retrying:', statusErr.message);
      }
      attempts++;
    }
    if (!isReady) {
      console.warn(`⚠️ Video not ready after ${attempts} attempts. Last status: ${lastStatus}. Attempting to publish anyway...`);
    }
    // Step 2: Publish the media - access_token goes in params
    console.log('Attempting to publish media...');
    const publishResponse = await axios.post(
      `${INSTAGRAM_API_BASE}/${accountId}/media_publish`,
      {
        creation_id: mediaId
      },
      {
        params: {
          access_token: accessToken
        },
        timeout: 30000
      }
    );
    console.log('Publish response data:', JSON.stringify(publishResponse.data, null, 2));
    if (publishResponse.data.error) {
      const errMsg = publishResponse.data.error.message || 'Instagram API error';
      console.error('Publish API error:', errMsg);
      throw new Error(`Instagram API error: ${errMsg}`);
    }
    const publishId = publishResponse.data.id;
    if (!publishId) {
      console.error('No publish ID returned. Full response:', publishResponse.data);
      throw new Error('Instagram API error: Publish ID not available - ' + JSON.stringify(publishResponse.data));
    }
    console.log('Instagram video published successfully with ID:', publishId);
    return {
      media_id: mediaId,
      publish_id: publishId
    };
  } catch (error) {
    console.error('Instagram post error:', error.message);
    if (error.response) {
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Error response status:', error.response.status);
      const errorMessage = error.response.data?.error?.message || 
                         error.response.data?.message || 
                         'Instagram API error';
      throw new Error(`Instagram API error: ${errorMessage} (Status: ${error.response.status})`);
    }
    throw error;
  }
};
