const axios = require('axios');
const FACEBOOK_API_BASE = 'https://graph.facebook.com/v18.0';
const FACEBOOK_OAUTH_BASE = 'https://www.facebook.com/v18.0/dialog/oauth';
/**
 * Exchange authorization code for short-lived access token.
 */
const exchangeCodeForToken = async (code, redirectUri, clientId, clientSecret) => {
  try {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('redirect_uri', redirectUri);
    params.append('code', code);
    const response = await axios.post(
      `${FACEBOOK_API_BASE}/oauth/access_token`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Facebook token exchange error:', error.response?.data);
    if (error.response) {
      throw new Error(
        `Facebook OAuth error: ${error.response.data?.error?.message || 'Failed to get access token'}`
      );
    }
    throw error;
  }
};
/**
 * Exchange short-lived token for long-lived token (valid ~60 days).
 */
const getLongLivedToken = async (shortLivedToken, clientId, clientSecret) => {
  try {
    const response = await axios.get(
      `${FACEBOOK_API_BASE}/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: clientId,
          client_secret: clientSecret,
          fb_exchange_token: shortLivedToken,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Facebook long-lived token error:', error.response?.data);
    if (error.response) {
      throw new Error(
        `Facebook token exchange error: ${error.response.data?.error?.message || 'Failed to get long-lived token'}`
      );
    }
    throw error;
  }
};
/**
 * Get Facebook user profile info.
 */
const getUserInfo = async (accessToken) => {
  try {
    const response = await axios.get(
      `${FACEBOOK_API_BASE}/me`,
      {
        params: {
          fields: 'id,name,email',
          access_token: accessToken,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Facebook user info error:', error.response?.data);
    if (error.response) {
      throw new Error(
        `Facebook user info error: ${error.response.data?.error?.message || 'Failed to get user info'}`
      );
    }
    throw error;
  }
};
/**
 * Get list of pages the user manages, and return the first page's access token.
 * Returns { pageId, pageAccessToken }.
 */
const getPageAccessToken = async (userAccessToken) => {
  try {
    const response = await axios.get(
      `${FACEBOOK_API_BASE}/me/accounts`,
      {
        params: {
          access_token: userAccessToken,
        },
      }
    );
    const pages = response.data.data;
    if (!pages || pages.length === 0) {
      throw new Error('No Facebook pages found for this user. Please ensure you have a page and granted pages_manage_posts permission.');
    }
    const firstPage = pages[0];
    return {
      pageId: firstPage.id,
      pageAccessToken: firstPage.access_token,
      pageName: firstPage.name,
    };
  } catch (error) {
    console.error('Facebook page list error:', error.response?.data);
    if (error.response) {
      throw new Error(
        `Failed to fetch pages: ${error.response.data?.error?.message || 'Unknown error'}`
      );
    }
    throw error;
  }
};
/**
 * Post a video to a Facebook page.
 * @param {string} userAccessToken - Long-lived user access token.
 * @param {string} videoUrl - Public URL of the video (must be HTTPS).
 * @param {string} title - Title/caption for the video.
 * @param {string} description - Optional description.
 * @returns {Object} { postId, videoId }.
 */
const postVideoToPage = async (userAccessToken, videoUrl, title = '', description = '') => {
  try {
    // 1. Get page access token
    const { pageId, pageAccessToken, pageName } = await getPageAccessToken(userAccessToken);
    console.log(`Posting to Facebook page: ${pageName} (${pageId})`);
    // 2. Prepare the video upload request
    const params = new URLSearchParams();
    params.append('access_token', pageAccessToken);
    params.append('video_url', videoUrl);
    if (title) params.append('title', title);
    if (description) params.append('description', description);
    const response = await axios.post(
      `${FACEBOOK_API_BASE}/${pageId}/videos`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    if (response.data.error) {
      throw new Error(`Facebook API error: ${response.data.error.message}`);
    }
    const videoId = response.data.id;
    const postId = response.data.post_id || null;
    return {
      videoId,
      postId,
      pageId,
      pageName,
    };
  } catch (error) {
    console.error('Facebook video post error:', error.message);
    if (error.response) {
      const fbError = error.response.data?.error;
      throw new Error(
        `Facebook API error: ${fbError?.message || error.message} (Status: ${error.response.status})`
      );
    }
    throw error;
  }
};
// Export all functions
module.exports = {
  exchangeCodeForToken,
  getLongLivedToken,
  getUserInfo,
  postVideoToPage,
  getPageAccessToken,
};
