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
 * Poll media container status until it is FINISHED or fails.
 * Instagram requires the container to finish processing before publish.
 */
const waitForContainerReady = async (creationId, accessToken, maxAttempts = 30, delayMs = 3000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const statusUrl = `https://graph.instagram.com/v21.0/${creationId}`;
    const statusRes = await axios.get(statusUrl, {
      params: {
        fields: 'status_code,status',
        access_token: accessToken,
      },
    });
    const statusCode = statusRes.data?.status_code;
    console.log(`[Instagram] Container ${creationId} status (attempt ${attempt}): ${statusCode}`);
    if (statusCode === 'FINISHED') {
      return statusRes.data;
    }
    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      const err = new Error(
        `Instagram media container failed with status: ${statusCode}. ${statusRes.data?.status || ''}`
      );
      err.status = 400;
      throw err;
    }
    // IN_PROGRESS or other intermediate state – wait and retry
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const err = new Error('Instagram media container processing timed out. Please try again.');
  err.status = 408;
  throw err;
};
/**
 * Post a Reel (or feed VIDEO) to Instagram using the Content Publishing API.
 * Requires an Instagram Business / Creator account with
 * instagram_business_content_publish permission.
 *
 * Flow:
 * 1. Create media container (REELS or VIDEO)
 * 2. Poll until status_code === FINISHED
 * 3. Publish the container
 *
 * @param {string} accessToken - Long-lived Instagram user access token
 * @param {string} accountId   - Instagram user / business account ID
 * @param {string} videoUrl    - Publicly accessible HTTPS video URL (e.g. Cloudinary)
 * @param {string} mediaType   - 'REELS' | 'VIDEO' (default REELS)
 * @param {string} caption     - Optional caption text
 */
const postReel = async (accessToken, accountId, videoUrl, mediaType = 'REELS', caption = '') => {
  if (!accessToken || !accountId) {
    const err = new Error('Instagram access token and account ID are required');
    err.status = 401;
    throw err;
  }
  if (!videoUrl || (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://'))) {
    const err = new Error('A valid public HTTP/HTTPS video_url is required');
    err.status = 400;
    throw err;
  }
  const igMediaType = (mediaType || 'REELS').toUpperCase() === 'VIDEO' ? 'VIDEO' : 'REELS';
  console.log(`[Instagram] Creating ${igMediaType} container for account ${accountId}: ${videoUrl}`);
  // Step 1 – Create media container
  const createUrl = `https://graph.instagram.com/v21.0/${accountId}/media`;
  const createParams = {
    media_type: igMediaType,
    video_url: videoUrl,
    access_token: accessToken,
  };
  if (caption && caption.trim()) {
    createParams.caption = caption.trim();
  }
  // For Reels, share_to_feed can be set if desired (optional)
  if (igMediaType === 'REELS') {
    createParams.share_to_feed = true;
  }
  let creationId;
  try {
    const createRes = await axios.post(createUrl, null, { params: createParams });
    creationId = createRes.data?.id;
    if (!creationId) {
      throw new Error('No creation_id returned from Instagram media container API');
    }
    console.log(`[Instagram] Container created: ${creationId}`);
  } catch (error) {
    const igError = error.response?.data?.error;
    console.error('[Instagram] Create container error:', igError || error.message);
    const message =
      igError?.message ||
      error.message ||
      'Failed to create Instagram media container';
    const err = new Error(message);
    err.status = error.response?.status || 400;
    throw err;
  }
  // Step 2 – Wait until container is ready
  await waitForContainerReady(creationId, accessToken);
  // Step 3 – Publish
  const publishUrl = `https://graph.instagram.com/v21.0/${accountId}/media_publish`;
  try {
    const publishRes = await axios.post(publishUrl, null, {
      params: {
        creation_id: creationId,
        access_token: accessToken,
      },
    });
    const mediaId = publishRes.data?.id;
    if (!mediaId) {
      throw new Error('No media_id returned from Instagram publish API');
    }
    console.log(`[Instagram] Published successfully. media_id=${mediaId}`);
    return {
      media_id: mediaId,
      creation_id: creationId,
      status: 'success',
      media_type: igMediaType,
    };
  } catch (error) {
    const igError = error.response?.data?.error;
    console.error('[Instagram] Publish error:', igError || error.message);
    const message =
      igError?.message ||
      error.message ||
      'Failed to publish Instagram media';
    const err = new Error(message);
    err.status = error.response?.status || 400;
    throw err;
  }
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
    const videos = media.filter(
      (item) => item.media_type === 'VIDEO' || item.media_type === 'REELS'
    );
    const totalVideos = videos.length;
    const totalViews = videos.reduce((sum, video) => sum + (video.views_count || 0), 0);
    const conversionRate =
      totalVideos > 0 ? ((totalViews / totalVideos) * 100).toFixed(1) + '%' : '0%';
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
