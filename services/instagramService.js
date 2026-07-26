const axios = require('axios');
// Instagram API configuration
const INSTAGRAM_API_BASE = 'https://graph.instagram.com/v23.0';
/**
 * Get Instagram access token from environment
 * @returns {string} Instagram access token
 */
const getAccessToken = () => {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    throw new Error('INSTAGRAM_ACCESS_TOKEN not configured in environment');
  }
  return token;
};
/**
 * Get Instagram account ID from environment
 * @returns {string} Instagram account ID
 */
const getAccountId = () => {
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('INSTAGRAM_ACCOUNT_ID not configured in environment');
  }
  return accountId;
};
/**
 * Post a video reel to Instagram
 * @param {string} videoUrl - Public URL of the video to post
 * @param {string} mediaType - Media type (default: 'REELS')
 * @returns {Object} - { media_id, publish_id }
 */
exports.postReel = async (videoUrl, mediaType = 'REELS') => {
  try {
    const accessToken = getAccessToken();
    const accountId = getAccountId();
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
    // Handle Axios errors with response data
    if (error.response) {
      const errorMessage = error.response.data?.error?.message || 
                         error.response.data?.message || 
                         'Instagram API error';
      throw new Error(`Instagram API error: ${errorMessage}`);
    }
    throw error;
  }
};
/**
 * Get Instagram account status
 * @returns {Object} - Account status information
 */
exports.getAccountStatus = async () => {
  try {
    const accessToken = getAccessToken();
    const accountId = getAccountId();
    // Get account information
    const response = await axios.get(
      `${INSTAGRAM_API_BASE}/${accountId}`,
      {
        params: {
          fields: 'id,username,account_type,media_count',
          access_token: accessToken
        }
      }
    );
    return {
      connected: true,
      accountId: accountId,
      username: response.data.username || 'Unknown',
      accountType: response.data.account_type || 'Unknown',
      mediaCount: response.data.media_count || 0,
      timestamp: Date.now()
    };
  } catch (error) {
    // If token is invalid, return disconnected status
    if (error.response?.status === 400 || error.response?.status === 401) {
      return {
        connected: false,
        accountId: getAccountId() || 'Not configured',
        error: 'Invalid or expired access token'
      };
    }
    throw error;
  }
};
/**
 * Disconnect Instagram account (clear local config)
 * @returns {Object} - Disconnect result
 */
exports.disconnectAccount = async () => {
  // In a real implementation, this would clear tokens from database
  // For now, we just return a success message
  return {
    disconnected: true,
    message: 'Instagram account disconnected'
  };
};
