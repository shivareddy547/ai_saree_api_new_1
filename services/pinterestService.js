const axios = require('axios');
/**
 * Generate Pinterest OAuth URL for user authorization.
 * @param {Object} credentials - Provider credentials containing app_id, redirect_uri, scope.
 * @returns {string} OAuth URL without state parameter (to be appended).
 */
const getOAuthUrl = (credentials) => {
  const { app_id: clientId, redirect_uri: redirectUri, scope } = credentials;
  if (!clientId || !redirectUri) {
    const err = new Error('Missing required credentials for Pinterest');
    err.status = 400;
    throw err;
  }
  const scopeStr = scope || 'boards:read,pins:read,pins:write';
  // Pinterest OAuth endpoint (same for sandbox)
  const url = `https://www.pinterest.com/oauth/?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopeStr)}&state=`;
  return url;
};
/**
 * Exchange authorization code for access token.
 * @param {string} code - Authorization code from callback.
 * @param {string} redirectUri - Redirect URI used in OAuth flow.
 * @param {string} clientId - App ID.
 * @param {string} clientSecret - App secret.
 * @param {string} environment - 'production' or 'sandbox'.
 * @returns {Object} Token data including access_token, refresh_token, expires_in.
 */
const exchangeCodeForToken = async (code, redirectUri, clientId, clientSecret, environment = 'production') => {
  const baseUrl = environment === 'sandbox' ? 'https://api-sandbox.pinterest.com' : 'https://api.pinterest.com';
  const url = `${baseUrl}/v5/oauth/token`;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', redirectUri);
  // Pinterest recommends continuous_refresh for apps created before Sept 2025; we'll omit to use default behavior.
  try {
    const response = await axios.post(url, params, {
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Pinterest token exchange error:', error.response?.data || error.message);
    const err = new Error('Failed to exchange Pinterest authorization code');
    err.status = 400;
    throw err;
  }
};
/**
 * Fetch Pinterest user account information.
 * @param {string} accessToken - Valid access token.
 * @returns {Object} User data including id, username, etc.
 */
const getUserInfo = async (accessToken) => {
  try {
    const response = await axios.get('https://api.pinterest.com/v5/user_account', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Pinterest user info error:', error.response?.data || error.message);
    const err = new Error('Failed to fetch Pinterest user info');
    err.status = 400;
    throw err;
  }
};
module.exports = { getOAuthUrl, exchangeCodeForToken, getUserInfo };
