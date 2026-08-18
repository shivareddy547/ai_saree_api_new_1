const { Provider, UserSocialConnection, User } = require('../models');
const axios = require('axios');
const facebookService = require('./facebookService');
const youtubeService = require('./youtubeService');
const { exchangeCodeForToken, getLongLivedToken, getInstagramUserInfo } = require('./instagramService');
const { getOAuthUrl: getPinterestOAuthUrl, exchangeCodeForToken: exchangePinterestCode, getUserInfo: getPinterestUserInfo } = require('./pinterestService');
/**
 * Helper: load provider + user connection
 */
async function getProviderAndConnection(userId, providerId) {
  const provider = await Provider.findByPk(providerId);
  if (!provider) {
    const err = new Error('Provider not found');
    err.status = 404;
    throw err;
  }
  if (provider.provider_type !== 'social') {
    const err = new Error('Not a social provider');
    err.status = 400;
    throw err;
  }
  if (!provider.is_enabled) {
    const err = new Error('Provider is not enabled');
    err.status = 400;
    throw err;
  }
  const connection = await UserSocialConnection.findOne({
    where: { userId, providerId },
  });
  return { provider, connection };
}
/**
 * Build OAuth URL for a given provider.
 * Supports Instagram, Pinterest, Facebook, and YouTube.
 */
const getOAuthUrl = async (providerId, userId) => {
  const provider = await Provider.findByPk(providerId);
  if (!provider) {
    const err = new Error('Provider not found');
    err.status = 404;
    throw err;
  }
  if (!provider.is_enabled) {
    const err = new Error('Provider is not enabled');
    err.status = 400;
    throw err;
  }
  if (provider.provider_type !== 'social') {
    const err = new Error('Not a social provider');
    err.status = 400;
    throw err;
  }
  const { provider_key, credentials } = provider;
  if (provider_key === 'instagram') {
    let { app_id: clientId, redirect_uri: redirectUri, scope } = credentials;
    clientId = clientId ? clientId.trim() : '';
    redirectUri = redirectUri ? redirectUri.trim() : '';
    scope = scope ? scope.trim() : '';
    if (!clientId || !redirectUri) {
      const err = new Error('Missing required credentials for Instagram');
      err.status = 400;
      throw err;
    }
    const scopeStr = scope || 'instagram_business_basic,instagram_business_content_publish';
    const url = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopeStr)}&response_type=code&state=${providerId}`;
    return url;
  } else if (provider_key === 'pinterest') {
    const baseUrl = getPinterestOAuthUrl(credentials);
    return baseUrl + providerId;
  } else if (provider_key === 'facebook') {
    let { app_id: clientId, redirect_uri: redirectUri, scope } = credentials;
    clientId = clientId ? clientId.trim() : '';
    redirectUri = redirectUri ? redirectUri.trim() : '';
    scope = scope ? scope.trim() : '';
    if (!clientId || !redirectUri) {
      const err = new Error('Missing required credentials for Facebook');
      err.status = 400;
      throw err;
    }
    if (!/^\d+$/.test(clientId)) {
      const err = new Error('Invalid Facebook App ID. Please check your credentials.');
      err.status = 400;
      throw err;
    }
    const scopeStr = scope || 'pages_manage_posts,pages_read_engagement';
    const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopeStr)}&state=${providerId}`;
    console.log('Facebook OAuth URL:', url);
    return url;
  } else if (provider_key === 'youtube') {
    let { client_id, redirect_uri, scope } = credentials;
    client_id = client_id ? client_id.trim() : '';
    redirect_uri = redirect_uri ? redirect_uri.trim() : '';
    scope = scope ? scope.trim() : '';
    if (!client_id || !redirect_uri) {
      const err = new Error('Missing required credentials for YouTube');
      err.status = 400;
      throw err;
    }
    const scopeStr = scope || 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scopeStr)}&response_type=code&access_type=offline&state=${providerId}`;
    console.log('YouTube OAuth URL:', url);
    return url;
  } else {
    const err = new Error(`Provider ${provider_key} not yet supported for OAuth`);
    err.status = 400;
    throw err;
  }
};
/**
 * Exchange code for tokens and store connection.
 * Supports Instagram, Pinterest, Facebook, and YouTube.
 */
const connect = async (userId, code, state) => {
  const providerId = state;
  if (!providerId) {
    const err = new Error('Missing state parameter (providerId)');
    err.status = 400;
    throw err;
  }
  const provider = await Provider.findByPk(providerId);
  if (!provider) {
    const err = new Error('Provider not found');
    err.status = 404;
    throw err;
  }
  if (!provider.is_enabled) {
    const err = new Error('Provider is not enabled');
    err.status = 400;
    throw err;
  }
  const { provider_key, credentials } = provider;
  // --- Instagram ---
  if (provider_key === 'instagram') {
    let { app_id: clientId, app_secret: clientSecret, redirect_uri: redirectUri } = credentials;
    clientId = clientId ? clientId.trim() : '';
    clientSecret = clientSecret ? clientSecret.trim() : '';
    redirectUri = redirectUri ? redirectUri.trim() : '';
    if (!clientId || !clientSecret || !redirectUri) {
      const err = new Error('Missing Instagram credentials');
      err.status = 400;
      throw err;
    }
    let tokenData;
    try {
      tokenData = await exchangeCodeForToken(code, redirectUri, clientId, clientSecret);
    } catch (error) {
      console.error('Token exchange error:', error);
      throw new Error('Failed to exchange authorization code');
    }
    const shortToken = tokenData.access_token;
    const accountId = tokenData.user_id;
    let longLivedData;
    try {
      longLivedData = await getLongLivedToken(shortToken, clientSecret);
    } catch (error) {
      console.error('Long-lived token error:', error);
      throw new Error('Failed to get long-lived token');
    }
    let userInfo;
    try {
      userInfo = await getInstagramUserInfo(longLivedData.access_token, accountId);
    } catch (error) {
      console.error('User info error:', error);
      throw new Error('Failed to fetch Instagram user info');
    }
    const expiresIn = longLivedData.expires_in || 60 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const [connection, created] = await UserSocialConnection.findOrCreate({
      where: { userId, providerId },
      defaults: {
        providerType: provider_key,
        accessToken: longLivedData.access_token,
        refreshToken: null,
        tokenExpiresAt: expiresAt,
        accountId: accountId,
        username: userInfo.username,
        accountType: userInfo.account_type || 'business',
        metadata: { ...userInfo },
      },
    });
    if (!created) {
      await connection.update({
        accessToken: longLivedData.access_token,
        tokenExpiresAt: expiresAt,
        accountId: accountId,
        username: userInfo.username,
        accountType: userInfo.account_type || 'business',
        metadata: { ...userInfo },
      });
    }
    await User.update({
      instagramAccessToken: longLivedData.access_token,
      instagramAccountId: accountId,
      instagramUsername: userInfo.username,
      instagramAccountType: userInfo.account_type || 'business',
      instagramTokenExpiresAt: expiresAt,
    }, {
      where: { id: userId },
    });
    return {
      connected: true,
      accountId: accountId,
      username: userInfo.username,
      accountType: userInfo.account_type || 'business',
      tokenExpiresAt: expiresAt,
    };
  }
  // --- Pinterest ---
  else if (provider_key === 'pinterest') {
    let { app_id: clientId, app_secret: clientSecret, redirect_uri: redirectUri, environment } = credentials;
    clientId = clientId ? clientId.trim() : '';
    clientSecret = clientSecret ? clientSecret.trim() : '';
    redirectUri = redirectUri ? redirectUri.trim() : '';
    environment = environment ? environment.trim() : 'production';
    if (!clientId || !clientSecret || !redirectUri) {
      const err = new Error('Missing Pinterest credentials');
      err.status = 400;
      throw err;
    }
    let tokenData;
    try {
      tokenData = await exchangePinterestCode(code, redirectUri, clientId, clientSecret, environment);
    } catch (error) {
      console.error('Pinterest token exchange error:', error);
      throw new Error('Failed to exchange Pinterest authorization code');
    }
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    let userInfo;
    try {
      userInfo = await getPinterestUserInfo(accessToken);
    } catch (error) {
      console.error('Pinterest user info error:', error);
      throw new Error('Failed to fetch Pinterest user info');
    }
    const username = userInfo.username || 'pinterest_user';
    const accountId = userInfo.id;
    const [connection, created] = await UserSocialConnection.findOrCreate({
      where: { userId, providerId },
      defaults: {
        providerType: provider_key,
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenExpiresAt: expiresAt,
        accountId: accountId,
        username: username,
        accountType: 'pinterest',
        metadata: { ...userInfo },
      },
    });
    if (!created) {
      await connection.update({
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenExpiresAt: expiresAt,
        accountId: accountId,
        username: username,
        metadata: { ...userInfo },
      });
    }
    return {
      connected: true,
      accountId: accountId,
      username: username,
      accountType: 'pinterest',
      tokenExpiresAt: expiresAt,
    };
  }
  // --- Facebook ---
  else if (provider_key === 'facebook') {
    let { app_id: clientId, app_secret: clientSecret, redirect_uri: redirectUri } = credentials;
    clientId = clientId ? clientId.trim() : '';
    clientSecret = clientSecret ? clientSecret.trim() : '';
    redirectUri = redirectUri ? redirectUri.trim() : '';
    if (!clientId || !clientSecret || !redirectUri) {
      const err = new Error('Missing Facebook credentials');
      err.status = 400;
      throw err;
    }
    if (!/^\d+$/.test(clientId)) {
      const err = new Error('Invalid Facebook App ID. Please check your credentials.');
      err.status = 400;
      throw err;
    }
    let tokenData;
    try {
      tokenData = await facebookService.exchangeCodeForToken(code, redirectUri, clientId, clientSecret);
    } catch (error) {
      console.error('Facebook token exchange error:', error);
      throw new Error('Failed to exchange Facebook authorization code');
    }
    const shortToken = tokenData.access_token;
    let longLivedData;
    try {
      longLivedData = await facebookService.getLongLivedToken(shortToken, clientId, clientSecret);
    } catch (error) {
      console.error('Facebook long-lived token error:', error);
      throw new Error('Failed to get long-lived Facebook token');
    }
    let userInfo;
    try {
      userInfo = await facebookService.getUserInfo(longLivedData.access_token);
    } catch (error) {
      console.error('Facebook user info error:', error);
      throw new Error('Failed to fetch Facebook user info');
    }
    const expiresIn = longLivedData.expires_in || 60 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const accountId = userInfo.id;
    const username = userInfo.name || userInfo.email || 'facebook_user';
    const [connection, created] = await UserSocialConnection.findOrCreate({
      where: { userId, providerId },
      defaults: {
        providerType: provider_key,
        accessToken: longLivedData.access_token,
        refreshToken: null,
        tokenExpiresAt: expiresAt,
        accountId: accountId,
        username: username,
        accountType: 'facebook',
        metadata: { ...userInfo },
      },
    });
    if (!created) {
      await connection.update({
        accessToken: longLivedData.access_token,
        tokenExpiresAt: expiresAt,
        accountId: accountId,
        username: username,
        metadata: { ...userInfo },
      });
    }
    return {
      connected: true,
      accountId: accountId,
      username: username,
      accountType: 'facebook',
      tokenExpiresAt: expiresAt,
    };
  }
  // --- YouTube ---
  else if (provider_key === 'youtube') {
    let { client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri } = credentials;
    clientId = clientId ? clientId.trim() : '';
    clientSecret = clientSecret ? clientSecret.trim() : '';
    redirectUri = redirectUri ? redirectUri.trim() : '';
    if (!clientId || !clientSecret || !redirectUri) {
      const err = new Error('Missing YouTube credentials');
      err.status = 400;
      throw err;
    }
    let tokenData;
    try {
      tokenData = await youtubeService.exchangeCodeForToken(code, redirectUri, clientId, clientSecret);
    } catch (error) {
      console.error('YouTube token exchange error:', error);
      throw new Error('Failed to exchange YouTube authorization code');
    }
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    let userInfo;
    try {
      userInfo = await youtubeService.getUserInfo(accessToken);
    } catch (error) {
      console.error('YouTube user info error:', error);
      throw new Error('Failed to fetch YouTube user info');
    }
    const accountId = userInfo.id;
    const username = userInfo.name || userInfo.email || 'youtube_user';
    const [connection, created] = await UserSocialConnection.findOrCreate({
      where: { userId, providerId },
      defaults: {
        providerType: provider_key,
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenExpiresAt: expiresAt,
        accountId: accountId,
        username: username,
        accountType: 'youtube',
        metadata: { ...userInfo, refreshToken, expiresIn },
      },
    });
    if (!created) {
      await connection.update({
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenExpiresAt: expiresAt,
        accountId: accountId,
        username: username,
        metadata: { ...userInfo, refreshToken, expiresIn },
      });
    }
    return {
      connected: true,
      accountId: accountId,
      username: username,
      accountType: 'youtube',
      tokenExpiresAt: expiresAt,
    };
  }
  else {
    const err = new Error(`Provider ${provider_key} not yet supported for connection`);
    err.status = 400;
    throw err;
  }
};
/**
 * Get all connections for a user.
 */
const getConnections = async (userId) => {
  const connections = await UserSocialConnection.findAll({
    where: { userId },
    include: [
      {
        model: Provider,
        as: 'provider',
        attributes: ['id', 'name', 'provider_key', 'is_enabled'],
      },
    ],
  });
  return connections.map((conn) => ({
    id: conn.id,
    providerId: conn.providerId,
    providerType: conn.providerType,
    accountId: conn.accountId,
    username: conn.username,
    accountType: conn.accountType,
    tokenExpiresAt: conn.tokenExpiresAt,
    connected: !!conn.accessToken,
    provider: conn.provider,
  }));
};
/**
 * Get status for a specific provider connection.
 */
const getConnectionStatus = async (userId, providerId) => {
  const conn = await UserSocialConnection.findOne({
    where: { userId, providerId },
  });
  if (!conn) {
    return { connected: false };
  }
  if (conn.tokenExpiresAt && new Date(conn.tokenExpiresAt) < new Date()) {
    return {
      connected: false,
      error: 'Token expired. Please reconnect.',
      accountId: conn.accountId,
      username: conn.username,
    };
  }
  return {
    connected: true,
    accountId: conn.accountId,
    username: conn.username,
    accountType: conn.accountType,
    tokenExpiresAt: conn.tokenExpiresAt,
    id: conn.id,
  };
};
/**
 * Disconnect a connection.
 */
const disconnect = async (userId, connectionId) => {
  const conn = await UserSocialConnection.findOne({
    where: { id: connectionId, userId },
  });
  if (!conn) {
    const err = new Error('Connection not found');
    err.status = 404;
    throw err;
  }
  if (conn.providerType === 'instagram') {
    await User.update({
      instagramAccessToken: null,
      instagramAccountId: null,
      instagramUsername: null,
      instagramAccountType: null,
      instagramTokenExpiresAt: null,
    }, {
      where: { id: userId },
    });
  }
  await conn.destroy();
  return { disconnected: true };
};
/**
 * Post video to a social provider.
 * Supports Instagram, Facebook, and YouTube.
 */
const postVideo = async (userId, providerId, videoUrl, mediaType, caption) => {
  const { provider, connection } = await getProviderAndConnection(userId, providerId);
  if (!connection || !connection.accessToken) {
    const err = new Error('No connected account found for this provider');
    err.status = 401;
    throw err;
  }
  if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt) < new Date()) {
    const err = new Error('Token expired. Please reconnect your account.');
    err.status = 401;
    throw err;
  }
  const { provider_key } = provider;
  if (provider_key === 'instagram') {
    const { postReel } = require('./instagramService');
    return await postReel(userId, videoUrl, mediaType, caption);
  } else if (provider_key === 'facebook') {
    const title = caption || 'Video post';
    const description = caption || '';
    const result = await facebookService.postVideoToPage(connection.accessToken, videoUrl, title, description);
    return {
      media_id: result.videoId,
      post_id: result.postId,
      page_id: result.pageId,
      page_name: result.pageName,
      video_url: videoUrl,
    };
  } else if (provider_key === 'youtube') {
    const title = caption || 'Product Video';
    const description = caption || '';
    const isShort = mediaType === 'REELS';
    const result = await youtubeService.uploadVideo(
      connection.accessToken,
      videoUrl,
      title,
      description,
      isShort
    );
    return {
      video_id: result.videoId,
      video_url: result.videoUrl,
      title: title,
      is_short: isShort,
    };
  } else {
    const err = new Error(`Posting to ${provider_key} is not yet supported`);
    err.status = 400;
    throw err;
  }
};
/**
 * Fetch live provider stats for dashboard
 */
const getProviderStats = async (userId, providerId) => {
  const { provider, connection } = await getProviderAndConnection(userId, providerId);
  const connected = !!(connection && connection.accessToken);
  const baseResponse = {
    providerId: provider.id,
    providerKey: provider.provider_key,
    providerName: provider.name,
    connected,
    username: connection?.username || null,
    accountId: connection?.accountId || null,
    tokenExpiresAt: connection?.tokenExpiresAt || null,
    totalVideos: 0,
    totalViews: 0,
    conversionRate: '0%',
    publishedVideos: 0,
    draftVideos: 0,
    source: null,
    error: null,
  };
  if (!connected) {
    return {
      ...baseResponse,
      error: 'Account not connected. Connect to fetch live stats.',
    };
  }
  const key = (provider.provider_key || '').toLowerCase();
  if (key === 'instagram') {
    const { fetchInstagramStats } = require('./instagramService');
    const live = await fetchInstagramStats(connection.accessToken, connection.accountId);
    return {
      ...baseResponse,
      totalVideos: live.totalVideos,
      totalViews: live.totalViews,
      conversionRate: live.conversionRate,
      publishedVideos: live.totalVideos,
      draftVideos: 0,
      source: live.source,
      error: live.error || null,
    };
  } else if (key === 'youtube') {
    const live = await youtubeService.getChannelStats(connection.accessToken);
    return {
      ...baseResponse,
      totalVideos: live.totalVideos,
      totalViews: live.totalViews,
      conversionRate: live.conversionRate,
      publishedVideos: live.totalVideos,
      draftVideos: 0,
      source: live.source,
      error: live.error || null,
    };
  }
  return baseResponse;
};
module.exports = {
  getOAuthUrl,
  connect,
  getConnections,
  getConnectionStatus,
  disconnect,
  postVideo,
  getProviderStats,
};
