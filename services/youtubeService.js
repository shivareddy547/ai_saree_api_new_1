const axios = require('axios');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3/videos';

exports.exchangeCodeForToken = async (code, redirectUri, clientId, clientSecret) => {
  try {
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('redirect_uri', redirectUri);
    params.append('grant_type', 'authorization_code');
    const response = await axios.post(GOOGLE_TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  } catch (error) {
    console.error('YouTube token exchange error:', error.response?.data);
    if (error.response) {
      throw new Error(`YouTube OAuth error: ${error.response.data?.error_description || error.response.data?.error || 'Failed to exchange code'}`);
    }
    throw error;
  }
};

exports.refreshAccessToken = async (refreshToken, clientId, clientSecret) => {
  try {
    const params = new URLSearchParams();
    params.append('refresh_token', refreshToken);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'refresh_token');
    const response = await axios.post(GOOGLE_TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  } catch (error) {
    console.error('YouTube token refresh error:', error.response?.data);
    throw new Error('Failed to refresh YouTube access token');
  }
};

exports.getUserInfo = async (accessToken) => {
  try {
    const response = await axios.get(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  } catch (error) {
    console.error('YouTube user info error:', error.response?.data);
    if (error.response) {
      throw new Error(`YouTube user info error: ${error.response.data?.error?.message || 'Failed to get user info'}`);
    }
    throw error;
  }
};

const sanitizeTitle = (title) => {
  let sanitized = (title || 'Product Video')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[<>]/g, '')
    .trim();
  if (!sanitized) {
    sanitized = 'Product Video';
  }
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 97).trim() + '...';
  }
  return sanitized;
};

const sanitizeDescription = (description) => {
  let sanitized = (description || '').trim();
  if (sanitized.length > 5000) {
    sanitized = sanitized.substring(0, 5000);
  }
  return sanitized;
};

exports.uploadVideo = async (accessToken, videoUrl, title, description, isShort = false, privacyStatus = 'public') => {
  try {
    const allowedPrivacy = ['public', 'unlisted', 'private'];
    const finalPrivacyStatus = allowedPrivacy.includes(privacyStatus) ? privacyStatus : 'public';

    const safeTitle = sanitizeTitle(title);
    const safeDescription = sanitizeDescription(description);

    console.log('Downloading video for YouTube upload:', videoUrl);
    const videoResponse = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    const videoBuffer = Buffer.from(videoResponse.data);
    const contentType = videoResponse.headers['content-type'] || 'video/mp4';

    const metadata = {
      snippet: {
        title: safeTitle,
        description: safeDescription,
        categoryId: '22',
      },
      status: {
        privacyStatus: finalPrivacyStatus,
        selfDeclaredMadeForKids: false,
      },
    };

    console.log('Initiating YouTube resumable upload:', { title: safeTitle, privacyStatus: finalPrivacyStatus, isShort });

    const initResponse = await axios.post(
      `${YOUTUBE_UPLOAD_BASE}?uploadType=resumable&part=snippet,status`,
      metadata,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': contentType,
          'X-Upload-Content-Length': videoBuffer.length,
        },
      }
    );

    const uploadUrl = initResponse.headers.location;
    if (!uploadUrl) {
      throw new Error('Failed to get YouTube resumable upload URL');
    }

    const uploadResponse = await axios.put(uploadUrl, videoBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': videoBuffer.length,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 300000,
    });

    const videoId = uploadResponse.data.id;
    if (!videoId) {
      throw new Error('YouTube API error: Video ID not available after upload');
    }

    return {
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  } catch (error) {
    console.error('YouTube upload error:', error.response?.data || error.message);
    if (error.response) {
      const errData = error.response.data;
      const errorMessage = errData?.error?.message ||
        errData?.error?.errors?.[0]?.message ||
        JSON.stringify(errData?.error) ||
        'YouTube API error';
      throw new Error(`YouTube API error: ${errorMessage}`);
    }
    throw error;
  }
};

exports.getChannelStats = async (accessToken) => {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/channels`, {
      params: {
        part: 'statistics',
        mine: true,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const channel = response.data.items?.[0];
    if (!channel) {
      return {
        totalVideos: 0,
        totalViews: 0,
        conversionRate: '0%',
        source: 'youtube',
        error: 'No channel found',
      };
    }
    const stats = channel.statistics || {};
    const totalVideos = parseInt(stats.videoCount || '0', 10);
    const totalViews = parseInt(stats.viewCount || '0', 10);
    return {
      totalVideos,
      totalViews,
      conversionRate: totalVideos > 0 ? `${(totalViews / totalVideos).toFixed(1)}%` : '0%',
      source: 'youtube',
      error: null,
    };
  } catch (error) {
    console.error('YouTube channel stats error:', error.response?.data || error.message);
    return {
      totalVideos: 0,
      totalViews: 0,
      conversionRate: '0%',
      source: 'youtube',
      error: 'Failed to fetch YouTube stats',
    };
  }
};
