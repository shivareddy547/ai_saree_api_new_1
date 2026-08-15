const axios = require('axios');
const { User, UserSocialConnection, Provider } = require('../models');
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
// OAuth URL using env redirect_uri (no param)
exports.getOAuthUrl = () => {
  const { clientId } = getAppCredentials();
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error('INSTAGRAM_REDIRECT_URI is not configured in environment');
  }
  const scope = 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_manage_insights';
  return `${INSTAGRAM_OAUTH_BASE}/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code&force_reauth=true`;
};
// Exchange functions with credentials as parameters
const exchangeCodeForToken = async (code, redirectUri, clientId, clientSecret) => {
  try {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', redirectUri);
    params.append('code', code);
    console.log('Exchange code with redirect_uri:', redirectUri);
    const response = await axios.post(
      `${INSTAGRAM_OAUTH_BASE}/access_token`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
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
const getLongLivedToken = async (shortLivedToken, clientSecret) => {
  try {
    const response = await axios.get(
      `${INSTAGRAM_API_BASE}/access_token`,
      {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: clientSecret,
          access_token: shortLivedToken,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Long-lived token error:', error.response?.data);
    if (error.response) {
      throw new Error(`Instagram token exchange error: ${error.response.data?.error?.message || 'Failed to get long-lived token'}`);
    }
    throw error;
  }
};
const getInstagramUserInfo = async (accessToken, accountId) => {
  try {
    const response = await axios.get(
      `${INSTAGRAM_API_BASE}/${accountId}`,
      {
        params: {
          fields: 'id,username,account_type,media_count',
          access_token: accessToken,
        },
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
// Export for socialService
exports.exchangeCodeForToken = exchangeCodeForToken;
exports.getLongLivedToken = getLongLivedToken;
exports.getInstagramUserInfo = getInstagramUserInfo;
// Connect account using env credentials and redirect_uri, and sync with UserSocialConnection
exports.connectAccount = async (userId, code) => {
  const { clientId, clientSecret } = getAppCredentials();
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error('INSTAGRAM_REDIRECT_URI is not configured in environment');
  }
  try {
    const tokenData = await exchangeCodeForToken(code, redirectUri, clientId, clientSecret);
    const longLivedData = await getLongLivedToken(tokenData.access_token, clientSecret);
    const userInfo = await getInstagramUserInfo(longLivedData.access_token, tokenData.user_id);
    const expiresIn = longLivedData.expires_in || 60 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    // Update User model
    await User.update({
      instagramAccessToken: longLivedData.access_token,
      instagramAccountId: tokenData.user_id,
      instagramUsername: userInfo.username,
      instagramAccountType: userInfo.account_type || 'business',
      instagramTokenExpiresAt: expiresAt,
    }, {
      where: { id: userId },
    });
    // Also sync with UserSocialConnection
    const provider = await Provider.findOne({
      where: {
        provider_type: 'social',
        provider_key: 'instagram',
        is_enabled: true,
      },
    });
    if (provider) {
      await UserSocialConnection.upsert({
        userId: userId,
        providerId: provider.id,
        providerType: 'instagram',
        accessToken: longLivedData.access_token,
        refreshToken: null,
        tokenExpiresAt: expiresAt,
        accountId: tokenData.user_id,
        username: userInfo.username,
        accountType: userInfo.account_type || 'business',
        metadata: { ...userInfo },
      });
    }
    return {
      connected: true,
      accountId: tokenData.user_id,
      username: userInfo.username,
      accountType: userInfo.account_type || 'business',
      mediaCount: userInfo.media_count || 0,
      tokenExpiresAt: expiresAt,
    };
  } catch (error) {
    console.error('Connect account error:', error);
    throw error;
  }
};
// Original getAccountStatus, disconnectAccount, postReel remain unchanged except disconnect sync
exports.getAccountStatus = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: [
      'instagramAccessToken',
      'instagramAccountId',
      'instagramUsername',
      'instagramAccountType',
      'instagramTokenExpiresAt',
    ],
  });
  if (!user) {
    throw new Error('User not found');
  }
  if (!user.instagramAccessToken || !user.instagramAccountId) {
    return {
      connected: false,
      error: 'Instagram account not connected',
    };
  }
  if (user.instagramTokenExpiresAt && new Date(user.instagramTokenExpiresAt) < new Date()) {
    return {
      connected: false,
      accountId: user.instagramAccountId,
      username: user.instagramUsername,
      error: 'Token expired. Please reconnect your account.',
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
      tokenExpiresAt: user.instagramTokenExpiresAt,
    };
  } catch (error) {
    console.error('Status check error:', error.message);
    return {
      connected: false,
      accountId: user.instagramAccountId,
      username: user.instagramUsername,
      error: 'Invalid or expired token. Please reconnect your account.',
    };
  }
};
exports.disconnectAccount = async (userId) => {
  // Remove from User model
  await User.update({
    instagramAccessToken: null,
    instagramAccountId: null,
    instagramUsername: null,
    instagramAccountType: null,
    instagramTokenExpiresAt: null,
  }, {
    where: { id: userId },
  });
  // Also remove from UserSocialConnection
  const provider = await Provider.findOne({
    where: {
      provider_type: 'social',
      provider_key: 'instagram',
    },
  });
  if (provider) {
    await UserSocialConnection.destroy({
      where: {
        userId: userId,
        providerId: provider.id,
      },
    });
  }
  return {
    disconnected: true,
    message: 'Instagram account disconnected successfully',
  };
};
const getUserAccessToken = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: ['instagramAccessToken', 'instagramAccountId', 'instagramTokenExpiresAt'],
  });
  if (!user || !user.instagramAccessToken) {
    throw new Error('Instagram account not connected for this user');
  }
  if (user.instagramTokenExpiresAt && new Date(user.instagramTokenExpiresAt) < new Date()) {
    throw new Error('Instagram token expired. Please reconnect your account.');
  }
  return {
    accessToken: user.instagramAccessToken,
    accountId: user.instagramAccountId,
  };
};
exports.postReel = async (userId, videoUrl, mediaType = 'REELS', caption = '') => {
  try {
    const { accessToken, accountId } = await getUserAccessToken(userId);
    console.log('Posting to Instagram:', { accountId, videoUrl, mediaType, caption });
    const createMediaResponse = await axios.post(
      `${INSTAGRAM_API_BASE}/${accountId}/media`,
      {
        video_url: videoUrl,
        media_type: mediaType,
        caption: caption,
      },
      {
        params: { access_token: accessToken },
        timeout: 30000,
      }
    );
    if (createMediaResponse.data.error) {
      const errMsg = createMediaResponse.data.error.message || 'Instagram API error';
      throw new Error(`Instagram API error: ${errMsg}`);
    }
    const mediaId = createMediaResponse.data.id;
    if (!mediaId) {
      throw new Error('Instagram API error: Media ID is not available');
    }
    let attempts = 0;
    let isReady = false;
    let lastStatus = 'unknown';
    while (attempts < 25) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      try {
        const statusResponse = await axios.get(
          `${INSTAGRAM_API_BASE}/${mediaId}`,
          {
            params: {
              fields: 'status_code,status',
              access_token: accessToken,
            },
          }
        );
        const status = statusResponse.data.status_code || statusResponse.data.status;
        lastStatus = status;
        console.log(`Video status (attempt ${attempts + 1}):`, status);
        if (status === 'FINISHED' || status === 'PUBLISHED') {
          isReady = true;
          break;
        } else if (status === 'ERROR') {
          const errorResponse = await axios.get(
            `${INSTAGRAM_API_BASE}/${mediaId}`,
            {
              params: {
                fields: 'error',
                access_token: accessToken,
              },
            }
          );
          const errorMsg = errorResponse.data.error?.message || 'Video processing failed';
          throw new Error(`Instagram video processing error: ${errorMsg}`);
        }
      } catch (statusErr) {
        console.log('Status check error, retrying:', statusErr.message);
      }
      attempts++;
    }
    if (!isReady) {
      console.warn(`Video not ready after ${attempts} attempts. Last status: ${lastStatus}. Attempting to publish anyway...`);
    }
    const publishResponse = await axios.post(
      `${INSTAGRAM_API_BASE}/${accountId}/media_publish`,
      { creation_id: mediaId },
      {
        params: { access_token: accessToken },
        timeout: 30000,
      }
    );
    if (publishResponse.data.error) {
      const errMsg = publishResponse.data.error.message || 'Instagram API error';
      throw new Error(`Instagram API error: ${errMsg}`);
    }
    const publishId = publishResponse.data.id;
    if (!publishId) {
      throw new Error('Instagram API error: Publish ID not available');
    }
    return {
      media_id: mediaId,
      publish_id: publishId,
    };
  } catch (error) {
    console.error('Instagram post error:', error.message);
    if (error.response) {
      const errorMessage = error.response.data?.error?.message ||
        error.response.data?.message ||
        'Instagram API error';
      throw new Error(`Instagram API error: ${errorMessage} (Status: ${error.response.status})`);
    }
    throw error;
  }
};
