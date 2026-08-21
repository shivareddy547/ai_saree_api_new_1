const { Product, ProductVariant, ProductImage, Category, PageView, Op } = require('../models');
const { Sequelize } = require('sequelize');
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
    isActive: true, // CRITICAL: only non-deleted + active products
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
 * Track a page view for any /store/* path.
 * - Always increments totalViews
 * - Increments guestViews when the visitor is not logged in
 * - When a provider query param is present, increments the corresponding key in providerViews
 */
const trackPageView = async ({ path, isGuest, provider }) => {
  if (!path || typeof path !== 'string' || !path.startsWith('/store')) {
    const err = new Error('Invalid path. Must start with /store');
    err.status = 400;
    throw err;
  }
  // Normalize path (strip trailing slash, keep query-less path)
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
  // Atomic increments via Sequelize
  const updates = {
    totalViews: Sequelize.literal('"totalViews" + 1'),
  };
  if (isGuest) {
    updates.guestViews = Sequelize.literal('"guestViews" + 1');
  }
  await pageView.update(updates);
  // Handle provider counter (JSONB)
  if (provider && typeof provider === 'string' && provider.trim()) {
    const key = provider.trim().toLowerCase();
    const current = pageView.providerViews || {};
    const next = { ...current, [key]: (current[key] || 0) + 1 };
    await pageView.update({ providerViews: next });
  }
  // Reload to return fresh values
  await pageView.reload();
  return {
    path: pageView.path,
    totalViews: pageView.totalViews,
    guestViews: pageView.guestViews,
    providerViews: pageView.providerViews,
  };
};
module.exports = {
  getStoreProducts,
  getStoreProductById,
  getAutocompleteSuggestions,
  getHomeSections,
  trackPageView,
};
