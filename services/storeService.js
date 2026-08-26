const { Product, ProductVariant, ProductImage, Category, PageView, PageViewLog } = require('../models');
const { Sequelize, Op } = require('sequelize');
/**
 * Public store product listing – only ACTIVE (isActive = true) products.
 * Soft-deleted products (isActive = false) are never returned.
 */
const getStoreProducts = async (filters = {}) => {
  const {
    search,
    categoryId,
    subcategoryId,
    featured,
    bestSellers,
    newArrivals,
    premium,
    page = 1,
    limit = 20,
    sort = 'newest',
  } = filters;
  const where = {
    isActive: true,
  };
  if (search && search.trim()) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search.trim()}%` } },
      { description: { [Op.iLike]: `%${search.trim()}%` } },
      { defaultSku: { [Op.iLike]: `%${search.trim()}%` } },
    ];
  }
  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (subcategoryId) {
    where.subcategoryId = subcategoryId;
  }
  if (featured === 'true' || featured === true) {
    where.showInFeaturedProducts = true;
  }
  if (bestSellers === 'true' || bestSellers === true) {
    where.showInBestSellers = true;
  }
  if (newArrivals === 'true' || newArrivals === true) {
    where.showInNewArrivals = true;
  }
  if (premium === 'true' || premium === true) {
    where.showInPremiumProducts = true;
  }
  let order = [['createdAt', 'DESC']];
  if (sort === 'price_asc') order = [['basePrice', 'ASC']];
  else if (sort === 'price_desc') order = [['basePrice', 'DESC']];
  else if (sort === 'name') order = [['name', 'ASC']];
  else if (sort === 'popular') order = [['views', 'DESC']];
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(50, parseInt(limit, 10) || 20);
  const lim = Math.min(50, parseInt(limit, 10) || 20);
  const { rows, count } = await Product.findAndCountAll({
    where,
    include: [
      {
        model: ProductVariant,
        as: 'variants',
        required: false,
      },
      {
        model: ProductImage,
        as: 'images',
        required: false,
      },
      {
        model: Category,
        as: 'category',
        required: false,
      },
      {
        model: Category,
        as: 'subcategory',
        required: false,
      },
    ],
    order,
    limit: lim,
    offset,
    distinct: true,
  });
  return {
    products: rows,
    pagination: {
      page: Math.max(1, parseInt(page, 10)),
      limit: lim,
      total: count,
      totalPages: Math.ceil(count / lim) || 1,
    },
  };
};
const getStoreProductById = async (id) => {
  const product = await Product.findOne({
    where: { id, isActive: true },
    include: [
      {
        model: ProductVariant,
        as: 'variants',
        required: false,
      },
      {
        model: ProductImage,
        as: 'images',
        required: false,
      },
      {
        model: Category,
        as: 'category',
        required: false,
      },
      {
        model: Category,
        as: 'subcategory',
        required: false,
      },
    ],
  });
  return product;
};
const getAutocompleteSuggestions = async (q) => {
  if (!q || !q.trim()) return [];
  const products = await Product.findAll({
    where: {
      isActive: true,
      [Op.or]: [
        { name: { [Op.iLike]: `%${q.trim()}%` } },
        { defaultSku: { [Op.iLike]: `%${q.trim()}%` } },
      ],
    },
    attributes: ['id', 'name', 'defaultSku'],
    limit: 10,
    order: [['name', 'ASC']],
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.defaultSku,
  }));
};
const getHomeSections = async () => {
  const baseWhere = { isActive: true };
  const [featured, bestSellers, newArrivals, premium] = await Promise.all([
    Product.findAll({
      where: { ...baseWhere, showInFeaturedProducts: true },
      include: [
        { model: ProductImage, as: 'images', required: false },
        { model: ProductVariant, as: 'variants', required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit: 12,
    }),
    Product.findAll({
      where: { ...baseWhere, showInBestSellers: true },
      include: [
        { model: ProductImage, as: 'images', required: false },
        { model: ProductVariant, as: 'variants', required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit: 12,
    }),
    Product.findAll({
      where: { ...baseWhere, showInNewArrivals: true },
      include: [
        { model: ProductImage, as: 'images', required: false },
        { model: ProductVariant, as: 'variants', required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit: 12,
    }),
    Product.findAll({
      where: { ...baseWhere, showInPremiumProducts: true },
      include: [
        { model: ProductImage, as: 'images', required: false },
        { model: ProductVariant, as: 'variants', required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit: 12,
    }),
  ]);
  return {
    featured,
    bestSellers,
    newArrivals,
    premium,
  };
};
/**
 * Resolve city / region / country from IP via free ip-api.com.
 * Fails silently (returns nulls) for private IPs or network errors.
 */
const lookupGeoFromIp = async (ip) => {
  const empty = { city: null, region: null, country: null, countryCode: null };
  if (!ip) return empty;
  const normalized = String(ip).replace(/^::ffff:/, '');
  if (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.startsWith('192.168.') ||
    normalized.startsWith('10.') ||
    normalized.startsWith('172.16.') ||
    normalized.startsWith('172.17.') ||
    normalized.startsWith('172.18.') ||
    normalized.startsWith('172.19.') ||
    normalized.startsWith('172.2') ||
    normalized.startsWith('172.30.') ||
    normalized.startsWith('172.31.')
  ) {
    return empty;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(normalized)}?fields=status,country,countryCode,regionName,city`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return empty;
    const data = await res.json();
    if (data && data.status === 'success') {
      return {
        city: data.city || null,
        region: data.regionName || null,
        country: data.country || null,
        countryCode: data.countryCode || null,
      };
    }
  } catch (e) {
    // Geo lookup must never break page-view tracking
  }
  return empty;
};
/**
 * Track a page view for any /store/* path.
 * - Always increments totalViews
 * - Increments guestViews when the visitor is not logged in
 * - When a provider query param is present, increments the corresponding key in providerViews
 * - Stores IP address and geolocation in page_view_logs
 */
const trackPageView = async ({ path, isGuest, provider, ipAddress, userAgent }) => {
  if (!path || typeof path !== 'string' || !path.startsWith('/store')) {
    const err = new Error('Invalid path. Must start with /store');
    err.status = 400;
    throw err;
  }
  const normalizedPath = path.split('?')[0].replace(/\/+$/, '') || '/store';
  let pageView = await PageView.findOne({ where: { path: normalizedPath } });
  if (!pageView) {
    pageView = await PageView.create({
      path: normalizedPath,
      totalViews: 0,
      guestViews: 0,
      providerViews: {},
    });
  }
  const updates = {
    totalViews: Sequelize.literal('"totalViews" + 1'),
  };
  if (isGuest) {
    updates.guestViews = Sequelize.literal('"guestViews" + 1');
  }
  await pageView.update(updates);
  if (provider && typeof provider === 'string' && provider.trim()) {
    const key = provider.trim().toLowerCase();
    const current = pageView.providerViews || {};
    const next = { ...current, [key]: (current[key] || 0) + 1 };
    await pageView.update({ providerViews: next });
  }
  // Persist individual visit with IP + location (non-blocking on geo failure)
  let geo = { city: null, region: null, country: null, countryCode: null };
  try {
    geo = await lookupGeoFromIp(ipAddress);
  } catch (e) {
    // ignore
  }
  try {
    if (PageViewLog) {
      await PageViewLog.create({
        path: normalizedPath,
        ipAddress: ipAddress || null,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        countryCode: geo.countryCode,
        isGuest: !!isGuest,
        provider:
          provider && typeof provider === 'string' && provider.trim()
            ? provider.trim().toLowerCase()
            : null,
        userAgent: userAgent || null,
      });
    }
  } catch (e) {
    console.error('Failed to save page view log:', e.message || e);
  }
  await pageView.reload();
  return {
    path: pageView.path,
    totalViews: pageView.totalViews,
    guestViews: pageView.guestViews,
    providerViews: pageView.providerViews,
    ipAddress: ipAddress || null,
    city: geo.city,
    region: geo.region,
    country: geo.country,
    countryCode: geo.countryCode,
  };
};
/**
 * List all tracked page views with derived registered-user count,
 * summed provider total, and last known IP / location for that path.
 * Optional filters: path (ilike), provider (key in providerViews), minViews,
 * startDate / endDate (filter by PageView.updatedAt).
 *
 * Filtering strategy:
 * - path: ilike on PageView.path
 * - provider: checks if key exists in providerViews JSONB
 * - minViews: totalViews >= N
 * - startDate / endDate: PageView.updatedAt between the given dates
 * - last IP / location are fetched from the most recent PageViewLog for each path
 */
const getPageViews = async (filters = {}) => {
  const { path, provider, minViews, startDate, endDate } = filters;
  const where = {};
  if (path && path.trim()) {
    where.path = { [Op.iLike]: `%${path.trim()}%` };
  }
  if (minViews !== undefined && minViews !== null && minViews !== '') {
    const n = parseInt(minViews, 10);
    if (!isNaN(n) && n >= 0) {
      where.totalViews = { [Op.gte]: n };
    }
  }
  // Date filter on updatedAt
  if (startDate || endDate) {
    where.updatedAt = {};
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        where.updatedAt[Op.gte] = start;
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        where.updatedAt[Op.lte] = end;
      }
    }
  }
  // Provider filter: check if key exists in providerViews JSONB
  if (provider && provider.trim()) {
    const key = provider.trim().toLowerCase();
    // Use PostgreSQL JSONB exists operator: providerViews ? key
    where[Op.and] = Sequelize.literal(`"providerViews" ? '${key}'`);
  }
  const rows = await PageView.findAll({
    where,
    order: [['totalViews', 'DESC']],
  });
  // Get latest log per path for last IP / location (overall, not filtered by date)
  const paths = rows.map((r) => r.path);
  const latestByPath = {};
  if (paths.length > 0 && PageViewLog) {
    try {
      const logs = await PageViewLog.findAll({
        where: { path: { [Op.in]: paths } },
        order: [['createdAt', 'DESC']],
      });
      for (const log of logs) {
        if (!latestByPath[log.path]) {
          latestByPath[log.path] = log;
        }
      }
    } catch (e) {
      console.error('Failed to load page view logs:', e.message || e);
    }
  }
  return rows.map((row) => {
    const providerViews = row.providerViews || {};
    const providerTotal = Object.values(providerViews).reduce((s, n) => s + n, 0);
    const registeredViews = Math.max(0, (row.totalViews || 0) - (row.guestViews || 0));
    const last = latestByPath[row.path] || null;
    const locationParts = last
      ? [last.city, last.region, last.country].filter(Boolean)
      : [];
    return {
      id: row.id,
      path: row.path,
      totalViews: row.totalViews || 0,
      guestViews: row.guestViews || 0,
      registeredViews,
      providerViews,
      providerTotal,
      lastIpAddress: last ? last.ipAddress : null,
      lastCity: last ? last.city : null,
      lastRegion: last ? last.region : null,
      lastCountry: last ? last.country : null,
      lastCountryCode: last ? last.countryCode : null,
      lastLocation: locationParts.length ? locationParts.join(', ') : null,
      lastViewedAt: last ? last.createdAt : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
};
module.exports = {
  getStoreProducts,
  getStoreProductById,
  getAutocompleteSuggestions,
  getHomeSections,
  trackPageView,
  getPageViews,
};
