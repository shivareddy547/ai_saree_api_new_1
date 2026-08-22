const { Product, ProductVariant, ProductImage, Category } = require('../models');
const { Op } = require('sequelize');
const createProduct = async (productData) => {
  const {
    name,
    description,
    basePrice,
    defaultSku,
    categoryId,
    subcategoryId,
    videoUrl,
    videoKitUrl,
    audioMode,
    audioScript,
    audioLanguage,
    voiceGender,
    videoLength,
    customAudioUrl,
    recordedAudioUrl,
    status,
    cloudinaryVideoPublicId,
    cloudinaryAudioPublicId,
    costPrice,
    stockQuantity,
    showInFeaturedProducts,
    showInBestSellers,
    showInNewArrivals,
    showInPremiumProducts,
    weight,
    length,
    breadth,
    height,
    isActive,
    variants,
    images,
    userId,
  } = productData;
  const product = await Product.create({
    name,
    description,
    basePrice: basePrice ? parseFloat(basePrice) : null,
    defaultSku,
    categoryId: categoryId || null,
    subcategoryId: subcategoryId || null,
    videoUrl,
    videoKitUrl,
    audioMode,
    audioScript,
    audioLanguage,
    voiceGender,
    videoLength,
    customAudioUrl,
    recordedAudioUrl,
    status: status || 'draft',
    cloudinaryVideoPublicId,
    cloudinaryAudioPublicId,
    costPrice: costPrice ? parseFloat(costPrice) : null,
    stockQuantity: stockQuantity ? parseInt(stockQuantity, 10) : 0,
    showInFeaturedProducts: !!showInFeaturedProducts,
    showInBestSellers: !!showInBestSellers,
    showInNewArrivals: !!showInNewArrivals,
    showInPremiumProducts: !!showInPremiumProducts,
    weight: weight ? parseFloat(weight) : 0.5,
    length: length ? parseFloat(length) : 30,
    breadth: breadth ? parseFloat(breadth) : 25,
    height: height ? parseFloat(height) : 5,
    isActive: isActive !== undefined ? !!isActive : true,
    userId,
  });
  if (variants && Array.isArray(variants) && variants.length > 0) {
    for (const v of variants) {
      await ProductVariant.create({
        productId: product.id,
        sku: v.sku || `SKU-${Date.now()}`,
        size: v.size || null,
        color: v.color || null,
        price: v.price ? parseFloat(v.price) : (basePrice ? parseFloat(basePrice) : 0),
        costPrice: v.costPrice ? parseFloat(v.costPrice) : null,
        stockQuantity: v.stockQuantity ? parseInt(v.stockQuantity, 10) : 0,
        videoUrl: v.videoUrl || null,
        cloudinaryVideoPublicId: v.cloudinaryVideoPublicId || null,
      });
    }
  }
  if (images && Array.isArray(images) && images.length > 0) {
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      await ProductImage.create({
        productId: product.id,
        url: typeof img === 'string' ? img : img.url,
        position: i,
        variantId: img.variantId || null,
      });
    }
  }
  return getProduct(product.id);
};
const getProducts = async (userId, filters = {}) => {
  const where = { userId };
  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }
  if (filters.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${filters.search}%` } },
      { defaultSku: { [Op.iLike]: `%${filters.search}%` } }
    ];
  }
  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }
  const products = await Product.findAll({
    where,
    include: [
      { model: ProductVariant, as: 'variants' },
      { model: ProductImage, as: 'images' },
      { model: Category, as: 'category' },
      { model: Category, as: 'subcategory' },
    ],
    order: [['createdAt', 'DESC']],
  });
  return products;
};
const getProduct = async (id) => {
  const product = await Product.findOne({
    where: { id, isActive: true },
    include: [
      { model: ProductVariant, as: 'variants' },
      { model: ProductImage, as: 'images' },
      { model: Category, as: 'category' },
      { model: Category, as: 'subcategory' },
    ],
  });
  return product;
};
const updateProduct = async (id, productData) => {
  const product = await Product.findOne({ where: { id, isActive: true } });
  if (!product) return null;
  const updateFields = {};
  const allowed = [
    'name', 'description', 'basePrice', 'defaultSku', 'categoryId', 'subcategoryId',
    'videoUrl', 'videoKitUrl', 'audioMode', 'audioScript', 'audioLanguage', 'voiceGender',
    'videoLength', 'customAudioUrl', 'recordedAudioUrl', 'status', 'cloudinaryVideoPublicId',
    'cloudinaryAudioPublicId', 'costPrice', 'stockQuantity', 'showInFeaturedProducts',
    'showInBestSellers', 'showInNewArrivals', 'showInPremiumProducts', 'weight', 'length',
    'breadth', 'height', 'isActive',
  ];
  for (const key of allowed) {
    if (productData[key] !== undefined) {
      if (['basePrice', 'costPrice', 'weight', 'length', 'breadth', 'height'].includes(key)) {
        updateFields[key] = productData[key] !== null && productData[key] !== '' ? parseFloat(productData[key]) : null;
      } else if (key === 'stockQuantity') {
        updateFields[key] = productData[key] !== null && productData[key] !== '' ? parseInt(productData[key], 10) : 0;
      } else if (['showInFeaturedProducts', 'showInBestSellers', 'showInNewArrivals', 'showInPremiumProducts', 'isActive'].includes(key)) {
        updateFields[key] = !!productData[key];
      } else {
        updateFields[key] = productData[key];
      }
    }
  }
  await product.update(updateFields);
  if (productData.variants && Array.isArray(productData.variants)) {
    // variants update logic can be added if needed
  }
  return getProduct(id);
};
const softDeleteProduct = async (id) => {
  const product = await Product.findOne({ where: { id, isActive: true } });
  if (!product) return false;
  await product.update({ isActive: false });
  return true;
};
const deleteProduct = async (id) => {
  const product = await Product.findByPk(id);
  if (!product) return false;
  await product.destroy();
  return true;
};
module.exports = {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  softDeleteProduct,
  deleteProduct,
};
