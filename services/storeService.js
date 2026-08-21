const { Product, ProductVariant, ProductImage, Category, Op } = require('../models');
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
      page: parseInt(page, 10) || 1,
      limit: lim,
      total: count,
      totalPages: Math.ceil(count / lim),
    },
  };
};
/**
 * Get a single product for the storefront.
 * Only returns if the product is active (isActive = true).
 */
const getStoreProductById = async (id) => {
  const product = await Product.findOne({
    where: {
      id,
      isActive: true, // CRITICAL: never return soft-deleted products
    },
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
/**
 * Autocomplete suggestions used by StoreLayout search.
 * Only returns active products.
 */
const getAutocompleteSuggestions = async (query, limit = 8) => {
  if (!query || query.trim().length < 2) {
    return [];
  }
  const products = await Product.findAll({
    where: {
      isActive: true, // CRITICAL: only active products
      [Op.or]: [
        { name: { [Op.iLike]: `%${query.trim()}%` } },
        { defaultSku: { [Op.iLike]: `%${query.trim()}%` } },
      ],
    },
    attributes: ['id', 'name'],
    include: [
      {
        model: ProductImage,
        as: 'images',
        attributes: ['url'],
        required: false,
        limit: 1,
      },
    ],
    limit: Math.min(15, parseInt(limit, 10) || 8),
    order: [['name', 'ASC']],
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    image: p.images && p.images.length > 0 ? p.images[0].url : null,
  }));
};
/**
 * Featured / Best Sellers / New Arrivals / Premium sections for Store Home.
 * All filtered by isActive = true.
 */
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
      order: [['views', 'DESC']],
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
module.exports = {
  getStoreProducts,
  getStoreProductById,
  getAutocompleteSuggestions,
  getHomeSections,
};
