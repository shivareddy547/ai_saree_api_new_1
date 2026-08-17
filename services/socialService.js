const { Provider, UserSocialConnection } = require('../models');
const axios = require('axios');

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
 * Fetch live Instagram stats using Graph API + stored access token
 * Returns totalVideos (VIDEO + REELS), totalViews (plays/views when available), conversionRate
 */
async function fetchInstagramStats(accessToken, accountId) {
  const result = {
    totalVideos: 0,
    totalViews: 0,
    conversionRate: '0%',
    mediaCount: 0,
    videoItems: [],
    source: 'instagram_api',
  };

  if (!accessToken) {
    return { ...result, error: 'No access token' };
  }

  try {
    // Resolve IG user id if not stored
    let igUserId = accountId;
    if (!igUserId) {
      const meRes = await axios.get('https://graph.instagram.com/me', {
        params: {
          fields: 'id,username,account_type,media_count',
          access_token: accessToken,
        },
        timeout: 15000,
      });
      igUserId = meRes.data.id;
      result.mediaCount = meRes.data.media_count || 0;
    }

    // Fetch media (paginate up to a reasonable limit)
    let nextUrl = `https://graph.instagram.com/${igUserId}/media`;
    const params = {
      fields: 'id,media_type,media_product_type,timestamp,like_count,comments_count,permalink',
      limit: 50,
      access_token: accessToken,
    };

    let pages = 0;
    const maxPages = 5; // safety: max ~250 items
    let allMedia = [];

    while (nextUrl && pages < maxPages) {
      const mediaRes = await axios.get(nextUrl, {
        params: pages === 0 ? params : undefined,
        timeout: 20000,
      });
      const data = mediaRes.data?.data || [];
      allMedia = allMedia.concat(data);
      nextUrl = mediaRes.data?.paging?.next || null;
      pages += 1;
    }

    // Filter video / reels
    const videoMedia = allMedia.filter((m) => {
      const type = (m.media_type || '').toUpperCase();
      const product = (m.media_product_type || '').toUpperCase();
      return type === 'VIDEO' || product === 'REELS' || product === 'VIDEO';
    });

    result.totalVideos = videoMedia.length;
    result.mediaCount = allMedia.length;
    result.videoItems = videoMedia.map((m) => ({
      id: m.id,
      media_type: m.media_type,
      media_product_type: m.media_product_type,
      like_count: m.like_count || 0,
      comments_count: m.comments_count || 0,
      timestamp: m.timestamp,
      permalink: m.permalink,
    }));

    // Try to fetch views/plays for each video (insights). Failures are ignored per item.
    let totalViews = 0;
    let totalEngagement = 0;
    const insightPromises = videoMedia.slice(0, 40).map(async (m) => {
      try {
        // Prefer modern "views" metric; fall back to plays / video_views
        const insightsRes = await axios.get(
          `https://graph.instagram.com/${m.id}/insights`,
          {
            params: {
              metric: 'views,plays,reach,total_interactions',
              access_token: accessToken,
            },
            timeout: 10000,
          }
        );
        const metrics = insightsRes.data?.data || [];
        let views = 0;
        let interactions = 0;
        for (const metric of metrics) {
          const name = (metric.name || '').toLowerCase();
          const value = metric.values?.[0]?.value ?? metric.value ?? 0;
          if (name === 'views' || name === 'plays' || name === 'video_views') {
            views = Number(value) || 0;
          }
          if (name === 'total_interactions' || name === 'reach') {
            interactions = Math.max(interactions, Number(value) || 0);
          }
        }
        // Fallback engagement from likes + comments if insights empty
        if (views === 0 && (m.like_count || m.comments_count)) {
          // no reliable views – leave 0
        }
        return { views, interactions: interactions || (m.like_count || 0) + (m.comments_count || 0) };
      } catch {
        // Insights often unavailable for accounts < 1000 followers or certain media types
        return {
          views: 0,
          interactions: (m.like_count || 0) + (m.comments_count || 0),
        };
      }
    });

    const insightResults = await Promise.all(insightPromises);
    insightResults.forEach((r) => {
      totalViews += r.views;
      totalEngagement += r.interactions;
    });

    // If insights returned no views, use sum of like_count as a weak proxy display (still better than 0 for UX)
    if (totalViews === 0 && videoMedia.length > 0) {
      totalViews = videoMedia.reduce((s, m) => s + (m.like_count || 0), 0);
      result.viewsNote = 'Views from insights unavailable; showing engagement proxy (likes)';
    }

    result.totalViews = totalViews;

    // Conversion-style rate: engagement / views (or engagement / videos)
    if (totalViews > 0) {
      const rate = ((totalEngagement / totalViews) * 100).toFixed(1);
      result.conversionRate = `${rate}%`;
    } else if (videoMedia.length > 0 && totalEngagement > 0) {
      const rate = (totalEngagement / videoMedia.length).toFixed(1);
      result.conversionRate = `${rate} eng/video`;
    } else {
      result.conversionRate = '0%';
    }

    return result;
  } catch (err) {
    console.error('Instagram stats fetch error:', err.response?.data || err.message);
    // Soft fail – return zeros with error message
    return {
      ...result,
      error: err.response?.data?.error?.message || err.message || 'Failed to fetch Instagram media',
    };
  }
}

/**
 * Generic / other providers – best-effort.
 * YouTube, TikTok etc. can be extended similarly using their APIs.
 */
async function fetchGenericProviderStats(providerKey, accessToken, accountId, connection) {
  const base = {
    totalVideos: 0,
    totalViews: 0,
    conversionRate: '0%',
    source: providerKey || 'unknown',
  };

  // If connection metadata already stores counts, surface them
  const meta = connection?.metadata || {};
  if (meta.mediaCount != null || meta.totalVideos != null) {
    base.totalVideos = Number(meta.totalVideos || meta.mediaCount || 0);
    base.totalViews = Number(meta.totalViews || 0);
    if (base.totalVideos > 0 && base.totalViews > 0) {
      base.conversionRate = ((base.totalViews > 0 ? 0 : 0)).toFixed
        ? '0%'
        : '0%';
    }
  }

  // Light YouTube attempt if token present
  if (providerKey === 'youtube' && accessToken) {
    try {
      const ytRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: {
          part: 'statistics,contentDetails',
          mine: true,
          access_token: accessToken,
        },
        timeout: 15000,
      });
      const channel = ytRes.data?.items?.[0];
      if (channel?.statistics) {
        base.totalVideos = Number(channel.statistics.videoCount || 0);
        base.totalViews = Number(channel.statistics.viewCount || 0);
        if (base.totalVideos > 0) {
          const avg = base.totalViews / base.totalVideos;
          base.conversionRate = avg > 0 ? `${avg.toFixed(0)} views/video` : '0%';
        }
        base.source = 'youtube_api';
      }
    } catch (e) {
      base.error = e.response?.data?.error?.message || e.message;
    }
  }

  return base;
}

/**
 * Public: get live provider stats for dashboard tab
 */
async function getProviderStats(userId, providerId) {
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
    const live = await fetchInstagramStats(connection.accessToken, connection.accountId);
    return {
      ...baseResponse,
      totalVideos: live.totalVideos,
      totalViews: live.totalViews,
      conversionRate: live.conversionRate,
      publishedVideos: live.totalVideos,
      draftVideos: 0,
      mediaCount: live.mediaCount,
      source: live.source,
      error: live.error || null,
      viewsNote: live.viewsNote || null,
    };
  }

  // Other providers
  const live = await fetchGenericProviderStats(
    key,
    connection.accessToken,
    connection.accountId,
    connection
  );
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

// ---------- existing methods (kept / assumed present) ----------
// The following are stubs that call into the same patterns already used by the app.
// If your real socialService already has full implementations of getOAuthUrl, connect,
// getConnections, getConnectionStatus, disconnect, postVideo – keep those and only
// add getProviderStats. Below is a minimal compatible surface so the controller works.

async function getOAuthUrl(providerId, userId) {
  // Delegate to existing implementation if this file is merged; placeholder structure:
  const provider = await Provider.findByPk(providerId);
  if (!provider || !provider.is_enabled) {
    const err = new Error('Provider not found or not enabled');
    err.status = 404;
    throw err;
  }
  // Real OAuth URL building lives in your existing socialService – preserve it.
  // This file should be merged carefully: keep all previous OAuth/connect logic.
  const err = new Error('getOAuthUrl must use existing socialService OAuth logic');
  err.status = 501;
  throw err;
}

async function connect(userId, code, state) {
  const err = new Error('connect must use existing socialService connect logic');
  err.status = 501;
  throw err;
}

async function getConnections(userId) {
  const connections = await UserSocialConnection.findAll({
    where: { userId },
    include: [{ model: Provider, as: 'provider', required: false }],
  });
  return connections.map((c) => ({
    id: c.id,
    providerId: c.providerId,
    providerType: c.providerType,
    accountId: c.accountId,
    username: c.username,
    accountType: c.accountType,
    tokenExpiresAt: c.tokenExpiresAt,
    connected: !!c.accessToken,
    error: null,
  }));
}

async function getConnectionStatus(userId, providerId) {
  const { connection } = await getProviderAndConnection(userId, providerId);
  if (!connection) {
    return {
      providerId,
      connected: false,
    };
  }
  return {
    id: connection.id,
    providerId: connection.providerId,
    providerType: connection.providerType,
    accountId: connection.accountId,
    username: connection.username,
    accountType: connection.accountType,
    tokenExpiresAt: connection.tokenExpiresAt,
    connected: !!connection.accessToken,
    error: null,
  };
}

async function disconnect(userId, connectionId) {
  const connection = await UserSocialConnection.findOne({
    where: { id: connectionId, userId },
  });
  if (!connection) {
    const err = new Error('Connection not found');
    err.status = 404;
    throw err;
  }
  await connection.destroy();
  return true;
}

async function postVideo(userId, providerId, videoUrl, mediaType, caption) {
  const err = new Error('postVideo must use existing socialService post logic');
  err.status = 501;
  throw err;
}

module.exports = {
  getOAuthUrl,
  connect,
  getConnections,
  getConnectionStatus,
  disconnect,
  postVideo,
  getProviderStats,
};
