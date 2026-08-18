const axios = require('axios');
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_OAUTH_BASE = 'https://oauth2.googleapis.com';
/**
 * Exchange authorization code for access token and refresh token.
 */
const exchangeCodeForToken = async (code, redirectUri, clientId, clientSecret) => {
  try {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('redirect_uri', redirectUri);
    params.append('code', code);
    params.append('grant_type', 'authorization_code');
    const response = await axios.post(
      `${YOUTUBE_OAUTH_BASE}/token`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('YouTube token exchange error:', error.response?.data);
    if (error.response) {
      throw new Error(
        `YouTube OAuth error: ${error.response.data?.error_description || error.response.data?.error || 'Failed to get access token'}`
      );
    }
    throw error;
  }
};
/**
 * Refresh access token using refresh token.
 */
const refreshAccessToken = async (refreshToken, clientId, clientSecret) => {
  try {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');
    const response = await axios.post(
      `${YOUTUBE_OAUTH_BASE}/token`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('YouTube token refresh error:', error.response?.data);
    throw new Error('Failed to refresh YouTube token');
  }
};
/**
 * Get YouTube channel info.
 */
const getUserInfo = async (accessToken) => {
  try {
    const response = await axios.get(
      `${YOUTUBE_API_BASE}/channels`,
      {
        params: {
          part: 'snippet,statistics,contentDetails',
          mine: true,
          access_token: accessToken,
        },
      }
    );
    const channel = response.data?.items?.[0];
    if (!channel) {
      throw new Error('No YouTube channel found for this user');
    }
    return {
      id: channel.id,
      name: channel.snippet?.title || 'YouTube User',
      email: null,
      statistics: channel.statistics || {},
      contentDetails: channel.contentDetails || {},
    };
  } catch (error) {
    console.error('YouTube user info error:', error.response?.data);
    if (error.response) {
      throw new Error(
        `YouTube user info error: ${error.response.data?.error?.message || 'Failed to get user info'}`
      );
    }
    throw error;
  }
};
/**
 * Get channel statistics.
 */
const getChannelStats = async (accessToken) => {
  try {
    const userInfo = await getUserInfo(accessToken);
    const stats = userInfo.statistics || {};
    const totalVideos = parseInt(stats.videoCount || 0);
    const totalViews = parseInt(stats.viewCount || 0);
    const conversionRate = totalVideos > 0 ? `${(totalViews / totalVideos).toFixed(0)} views/video` : '0%';
    return {
      totalVideos,
      totalViews,
      conversionRate,
      publishedVideos: totalVideos,
      draftVideos: 0,
      source: 'youtube_api',
      subscriberCount: parseInt(stats.subscriberCount || 0),
      error: null,
    };
  } catch (error) {
    console.error('YouTube stats error:', error);
    return {
      totalVideos: 0,
      totalViews: 0,
      conversionRate: '0%',
      publishedVideos: 0,
      draftVideos: 0,
      source: 'youtube_api',
      error: error.message || 'Failed to fetch YouTube stats',
    };
  }
};
/**
 * Upload a video to YouTube.
 * @param {string} accessToken - OAuth access token
 * @param {string} videoUrl - Public URL of the video (Cloudinary URL)
 * @param {string} title - Video title
 * @param {string} description - Video description
 * @param {boolean} isShort - Whether this is a YouTube Short (upload as Short)
 * @returns {Object} { videoId, videoUrl }
 */
const uploadVideo = async (accessToken, videoUrl, title, description, isShort = false) => {
  try {
    console.log('Uploading video to YouTube:', { videoUrl, title, isShort });
    // First, we need to download the video from Cloudinary to upload to YouTube
    // YouTube API requires the actual video file upload, not a URL.
    // We'll download the video from Cloudinary first.
    let videoBlob;
    try {
      const response = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
      });
      videoBlob = Buffer.from(response.data);
    } catch (error) {
      console.error('Failed to download video from Cloudinary:', error);
      throw new Error('Failed to download video from Cloudinary URL');
    }
    // Create a temporary file in memory
    const fileType = videoUrl.endsWith('.webm') ? 'video/webm' :
                    videoUrl.endsWith('.mp4') ? 'video/mp4' :
                    'video/mp4';
    // YouTube upload endpoint
    const uploadUrl = `${YOUTUBE_API_BASE}/videos?part=snippet,status`;
    // Prepare metadata
    const metadata = {
      snippet: {
        title: title || 'Product Video',
        description: description || '',
        categoryId: '22', // People & Blogs
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    };
    // Build multipart form data
    const formData = new FormData();
    const blob = new Blob([videoBlob], { type: fileType });
    const file = new File([blob], 'video.mp4', { type: fileType });
    formData.append('uploadType', 'multipart');
    formData.append('part', 'snippet,status');
    formData.append('metadata', JSON.stringify(metadata));
    formData.append('file', file);
    // Make the upload request
    // Note: We need to use fetch directly since axios doesn't support FormData with Blobs well in Node
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`YouTube API error: ${errorData.error?.message || 'Upload failed'}`);
    }
    const result = await response.json();
    const videoId = result.id;
    // If it's a YouTube Short, we need to add a hashtag to indicate it's a Short
    // YouTube automatically treats videos as Shorts if they are vertical and < 60 seconds
    // We'll add #Shorts to the description to help
    if (isShort && description) {
      try {
        const updateResponse = await axios.patch(
          `${YOUTUBE_API_BASE}/videos`,
          {
            snippet: {
              description: `${description}\n\n#Shorts`,
            },
          },
          {
            params: {
              part: 'snippet',
              access_token: accessToken,
            },
          }
        );
        console.log('Updated video description for Shorts');
      } catch (updateError) {
        console.warn('Failed to update video description for Shorts:', updateError);
      }
    }
    return {
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      title,
    };
  } catch (error) {
    console.error('YouTube upload error:', error);
    if (error.response) {
      throw new Error(
        `YouTube API error: ${error.response.data?.error?.message || 'Upload failed'}`
      );
    }
    throw error;
  }
};
module.exports = {
  exchangeCodeForToken,
  refreshAccessToken,
  getUserInfo,
  getChannelStats,
  uploadVideo,
};
