const axios = require('axios');
/**
 * Exchange authorization code for access token (short-lived)
 */
const exchangeCodeForToken = async (code, redirectUri, clientId, clientSecret) => {
  try {
    const response = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Facebook token exchange error:', error.response?.data || error.message);
    throw new Error('Failed to exchange Facebook authorization code');
  }
};
/**
 * Exchange short-lived token for long-lived token (60 days)
 * Requires clientId and clientSecret.
 */
const getLongLivedToken = async (shortToken, clientId, clientSecret) => {
  try {
    const response = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: shortToken,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Facebook long-lived token error:', error.response?.data || error.message);
    throw new Error('Failed to get long-lived Facebook token');
  }
};
/**
 * Get Facebook user info
 */
const getUserInfo = async (accessToken) => {
  try {
    const response = await axios.get('https://graph.facebook.com/me', {
      params: {
        access_token: accessToken,
        fields: 'id,name,email',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Facebook user info error:', error.response?.data || error.message);
    throw new Error('Failed to fetch Facebook user info');
  }
};
module.exports = {
  exchangeCodeForToken,
  getLongLivedToken,
  getUserInfo,
};
