const { Provider, UserSocialConnection, User } = require('../models');
const { exchangeCodeForToken, getLongLivedToken, getInstagramUserInfo } = require('./instagramService');
const { getOAuthUrl: getPinterestOAuthUrl, exchangeCodeForToken: exchangePinterestCode, getUserInfo: getPinterestUserInfo } = require('./pinterestService');
/**
 * Build OAuth URL for a given provider.
 * Supports Instagram and Pinterest.
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
    const { app_id: clientId, redirect_uri: redirectUri, scope } = credentials;
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
    // Append state with providerId
    return baseUrl + providerId;
  } else {
    const err = new Error(`Provider ${provider_key} not yet supported for OAuth`);
    err.status = 400;
    throw err;
  }
};
/**
 * Exchange code for tokens and store connection.
 * Supports Instagram and Pinterest.
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
    const { app_id: clientId, app_secret: clientSecret, redirect_uri: redirectUri } = credentials;
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
    const { app_id: clientId, app_secret: clientSecret, redirect_uri: redirectUri, environment } = credentials;
    if (!clientId || !clientSecret || !redirectUri) {
      const err = new Error('Missing Pinterest credentials');
      err.status = 400;
      throw err;
    }
    // Exchange code for token
    let tokenData;
    try {
      tokenData = await exchangePinterestCode(code, redirectUri, clientId, clientSecret, environment || 'production');
    } catch (error) {
      console.error('Pinterest token exchange error:', error);
      throw new Error('Failed to exchange Pinterest authorization code');
    }
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in; // in seconds
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    // Get user info
    let userInfo;
    try {
      userInfo = await getPinterestUserInfo(accessToken);
    } catch (error) {
      console.error('Pinterest user info error:', error);
      throw new Error('Failed to fetch Pinterest user info');
    }
    const username = userInfo.username || 'pinterest_user';
    const accountId = userInfo.id;
    // Store connection
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
    // Optionally store Pinterest fields on User if needed, but not required for now
    return {
      connected: true,
      accountId: accountId,
      username: username,
      accountType: 'pinterest',
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
    connected: true,
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
  // If Instagram, clear user fields
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
  // For Pinterest, no user fields to clear (optional)
  await conn.destroy();
  return { disconnected: true };
};
/**
 * Post video to a social provider.
 * Currently supports Instagram only, extendable to others.
 */
const postVideo = async (userId, providerId, videoUrl, mediaType, caption) => {
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
  const { provider_key } = provider;
  // Get the user's connection for this provider
  const connection = await UserSocialConnection.findOne({
    where: { userId, providerId },
  });
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
  // Delegate to provider-specific posting logic
  if (provider_key === 'instagram') {
    const { postReel } = require('./instagramService');
    return await postReel(userId, videoUrl, mediaType, caption);
  } else {
    const err = new Error(`Posting to ${provider_key} is not yet supported`);
    err.status = 400;
    throw err;
  }
};
module.exports = {
  getOAuthUrl,
  connect,
  getConnections,
  getConnectionStatus,
  disconnect,
  postVideo,
};
