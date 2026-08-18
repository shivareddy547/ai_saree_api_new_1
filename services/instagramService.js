const axios = require('axios');
/**
 * Exchange authorization code for short-lived access token.
 */
const exchangeCodeForToken = async (code, redirectUri, clientId, clientSecret) => {
  const url = 'https://api.instagram.com/oauth/access_token';
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code: code,
  });
  const response = await axios.post(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data;
};
/**
 * Exchange short-lived token for long-lived token.
 */
const getLongLivedToken = async (shortLivedToken, clientSecret) => {
  const url = 'https://graph.instagram.com/access_token';
  const response = await axios.get(url, {
    params: {
      grant_type: 'ig_exchange_token',
      client_secret: clientSecret,
      access_token: shortLivedToken,
    },
  });
  return response.data;
};
/**
 * Get Instagram user info (username, account_type, etc.)
 */
const getInstagramUserInfo = async (accessToken, userId) => {
  const url = `https://graph.instagram.com/${userId}`;
  const response = await axios.get(url, {
    params: {
      fields: 'id,username,account_type',
      access_token: accessToken,
    },
  });
  return response.data;
};
/**
 * Post a reel to Instagram.
 * Note: This requires a business account with content publishing permission.
 * This is a placeholder – actual implementation would require media upload.
 */
const postReel = async (userId, videoUrl, mediaType, caption) => {
  // Placeholder: in production, implement real Instagram Reel upload
  console.log(`Posting reel to Instagram for user ${userId}: ${videoUrl}`);
  return {
    media_id: 'mock_media_id_' + Date.now(),
    status: 'success',
  };
};
/**
 * Fetch Instagram stats: total videos, total views, conversion rate.
 */
const fetchInstagramStats = async (accessToken, accountId) => {
  try {
    let media = [];
    let url = `https://graph.instagram.com/${accountId}/media?fields=id,media_type,media_url,views_count,timestamp&access_token=${accessToken}&limit=100`;
    let hasNext = true;
    while (hasNext) {
      const response = await axios.get(url);
      const data = response.data;
      if (data.data) {
        media = media.concat(data.data);
      }
      if (data.paging && data.paging.next) {
        url = data.paging.next;
      } else {
        hasNext = false;
      }
    }
    // Filter for video media types (VIDEO and REELS)
    const videos = media.filter(item => item.media_type === 'VIDEO' || item.media_type === 'REELS');
    const totalVideos = videos.length;
    const totalViews = videos.reduce((sum, video) => sum + (video.views_count || 0), 0);
    const conversionRate = totalVideos > 0 ? ((totalViews / totalVideos) * 100).toFixed(1) + '%' : '0%';
    return {
      totalVideos,
      totalViews,
      conversionRate,
      source: 'Instagram API',
      error: null,
    };
  } catch (error) {
    console.error('Instagram stats fetch error:', error);
    return {
      totalVideos: 0,
      totalViews: 0,
      conversionRate: '0%',
      source: 'Instagram API',
      error: error.message || 'Failed to fetch Instagram stats',
    };
  }
};
module.exports = {
  exchangeCodeForToken,
  getLongLivedToken,
  getInstagramUserInfo,
  postReel,
  fetchInstagramStats,
};
