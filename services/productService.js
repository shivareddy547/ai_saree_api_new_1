const { Product, ProductVariant, ProductImage, Category, Subcategory, sequelize } = require('../models');
// Helper to sanitize numeric fields: convert empty string to null (or 0 for required fields)
const sanitizeNumeric = (value, defaultValue = null) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};
const createProduct = async (data) => {
  const transaction = await sequelize.transaction();
  try {
    // Validate subcategory if provided - if invalid, set to null
    let finalSubcategoryId = data.subcategoryId ? parseInt(data.subcategoryId, 10) : null;
    if (finalSubcategoryId) {
      const subcategory = await Subcategory.findByPk(finalSubcategoryId);
      if (!subcategory) {
        finalSubcategoryId = null;
      } else if (data.categoryId) {
        const categoryId = parseInt(data.categoryId, 10);
        if (subcategory.categoryId !== categoryId) {
          finalSubcategoryId = null;
        }
      }
    }
    // Sanitize numeric fields
    const basePrice = sanitizeNumeric(data.price || data.basePrice);
    const costPrice = sanitizeNumeric(data.costPrice);
    const stockQuantity = sanitizeNumeric(data.stockQuantity, 0);
    const videoLength = sanitizeNumeric(data.videoLength);
    const productData = {
      userId: data.userId,
      name: data.name,
      description: data.description,
      basePrice: basePrice,
      costPrice: costPrice,
      stockQuantity: stockQuantity,
      defaultSku: data.sku || data.defaultSku,
      categoryId: data.categoryId ? parseInt(data.categoryId, 10) : null,
      subcategoryId: finalSubcategoryId,
      videoUrl: data.videoUrl,
      videoKitUrl: data.videoKitUrl || data.videoUrl,
      audioMode: data.audioMode || 'text',
      audioScript: data.audioScript,
      audioLanguage: data.audioLanguage,
      voiceGender: data.voiceGender,
      videoLength: videoLength,
      customAudioUrl: data.customAudioUrl,
      recordedAudioUrl: data.recordedAudioUrl,
      status: data.status || 'draft',
      cloudinaryVideoPublicId: data.cloudinaryVideoPublicId,
      cloudinaryAudioPublicId: data.cloudinaryAudioPublicId,
      // New flags: default to false if not provided
      showInFeaturedProducts: data.showInFeaturedProducts || false,
      showInBestSellers: data.showInBestSellers || false,
      showInNewArrivals: data.showInNewArrivals || false,
      showInPremiumProducts: data.showInPremiumProducts || false,
    };
    const product = await Product.create(productData, { transaction });
    // Ensure at least one variant
    let variants = data.variants || [];
    if (variants.length === 0) {
      // Create a default variant using basePrice and product-level costPrice/stockQuantity
      variants = [{
        sku: data.sku || data.defaultSku || 'default',
        size: '',
        color: '',
        price: basePrice || 0,
        costPrice: costPrice,
        stockQuantity: stockQuantity,
      }];
    }
    const variantData = variants.map(v => {
      const price = sanitizeNumeric(v.price, 0);
      const costPriceVar = sanitizeNumeric(v.costPrice);
      const stockQuantityVar = sanitizeNumeric(v.stockQuantity, 0);
      return {
        productId: product.id,
        sku: v.sku || '',
        size: v.size || '',
        color: v.color || '',
        price: price,
        costPrice: costPriceVar,
        stockQuantity: stockQuantityVar,
      };
    });
    await ProductVariant.bulkCreate(variantData, { transaction });
    if (data.images && data.images.length > 0) {
      const imageData = data.images.map((url, index) => ({
        productId: product.id,
        url,
        position: index,
      }));
      await ProductImage.bulkCreate(imageData, { transaction });
    }
    await transaction.commit();
    const fullProduct = await Product.findByPk(product.id, {
      include: [
        { model: ProductVariant, as: 'variants' },
        { model: ProductImage, as: 'images' },
        { model: Category, as: 'category' },
        { model: Subcategory, as: 'subcategory' },
      ],
    });
    return fullProduct;
  } catch (error) {
    if (transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
      await transaction.rollback();
    }
    throw error;
  }
};
const getProducts = async (userId) => {
  return await Product.findAll({
    where: { userId },
    include: [
      { model: ProductVariant, as: 'variants' },
      { model: ProductImage, as: 'images' },
      { model: Category, as: 'category' },
      { model: Subcategory, as: 'subcategory' },
    ],
    order: [['createdAt', 'DESC']],
  });
};
const getProduct = async (id) => {
  return await Product.findByPk(id, {
    include: [
      { model: ProductVariant, as: 'variants' },
      { model: ProductImage, as: 'images' },
      { model: Category, as: 'category' },
      { model: Subcategory, as: 'subcategory' },
    ],
  });
};
const updateProduct = async (id, data) => {
  const transaction = await sequelize.transaction();
  try {
    const product = await Product.findByPk(id);
    if (!product) {
      if (transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
        await transaction.rollback();
      }
      return null;
    }
    // Validate subcategory if provided - if invalid, set to null
    let finalSubcategoryId = data.subcategoryId ? parseInt(data.subcategoryId, 10) : null;
    if (finalSubcategoryId) {
      const subcategory = await Subcategory.findByPk(finalSubcategoryId);
      if (!subcategory) {
        finalSubcategoryId = null;
      } else if (data.categoryId) {
        const categoryId = parseInt(data.categoryId, 10);
        if (subcategory.categoryId !== categoryId) {
          finalSubcategoryId = null;
        }
      }
    }
    // Sanitize numeric fields
    const basePrice = sanitizeNumeric(data.price || data.basePrice);
    const costPrice = sanitizeNumeric(data.costPrice);
    const stockQuantity = sanitizeNumeric(data.stockQuantity, 0);
    const videoLength = sanitizeNumeric(data.videoLength);
    const productData = {
      userId: data.userId,
      name: data.name,
      description: data.description,
      basePrice: basePrice,
      costPrice: costPrice,
      stockQuantity: stockQuantity,
      defaultSku: data.sku || data.defaultSku,
      categoryId: data.categoryId ? parseInt(data.categoryId, 10) : null,
      subcategoryId: finalSubcategoryId,
      videoUrl: data.videoUrl,
      videoKitUrl: data.videoKitUrl || data.videoUrl,
      audioMode: data.audioMode || 'text',
      audioScript: data.audioScript,
      audioLanguage: data.audioLanguage,
      voiceGender: data.voiceGender,
      videoLength: videoLength,
      customAudioUrl: data.customAudioUrl,
      recordedAudioUrl: data.recordedAudioUrl,
      status: data.status || 'draft',
      cloudinaryVideoPublicId: data.cloudinaryVideoPublicId,
      cloudinaryAudioPublicId: data.cloudinaryAudioPublicId,
      showInFeaturedProducts: data.showInFeaturedProducts !== undefined ? data.showInFeaturedProducts : product.showInFeaturedProducts,
      showInBestSellers: data.showInBestSellers !== undefined ? data.showInBestSellers : product.showInBestSellers,
      showInNewArrivals: data.showInNewArrivals !== undefined ? data.showInNewArrivals : product.showInNewArrivals,
      showInPremiumProducts: data.showInPremiumProducts !== undefined ? data.showInPremiumProducts : product.showInPremiumProducts,
    };
    await product.update(productData, { transaction });
    if (data.variants !== undefined) {
      await ProductVariant.destroy({
        where: { productId: id },
        transaction
      });
      let variants = data.variants || [];
      if (variants.length === 0) {
        // Ensure at least one variant using existing product data or fallback
        const currentPrice = product.basePrice || 0;
        const currentCostPrice = product.costPrice;
        const currentStock = product.stockQuantity || 0;
        variants = [{
          sku: product.defaultSku || 'default',
          size: '',
          color: '',
          price: currentPrice,
          costPrice: currentCostPrice,
          stockQuantity: currentStock,
        }];
      }
      const variantData = variants.map(v => {
        const price = sanitizeNumeric(v.price, 0);
        const costPriceVar = sanitizeNumeric(v.costPrice);
        const stockQuantityVar = sanitizeNumeric(v.stockQuantity, 0);
        return {
          productId: id,
          sku: v.sku || '',
          size: v.size || '',
          color: v.color || '',
          price: price,
          costPrice: costPriceVar,
          stockQuantity: stockQuantityVar,
        };
      });
      await ProductVariant.bulkCreate(variantData, { transaction });
    }
    if (data.images !== undefined) {
      await ProductImage.destroy({
        where: { productId: id },
        transaction
      });
      if (data.images && data.images.length > 0) {
        const imageData = data.images.map((url, index) => ({
          productId: id,
          url,
          position: index,
        }));
        await ProductImage.bulkCreate(imageData, { transaction });
      }
    }
    await transaction.commit();
    const fullProduct = await Product.findByPk(id, {
      include: [
        { model: ProductVariant, as: 'variants' },
        { model: ProductImage, as: 'images' },
        { model: Category, as: 'category' },
        { model: Subcategory, as: 'subcategory' },
      ],
    });
    return fullProduct;
  } catch (error) {
    if (transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
      await transaction.rollback();
    }
    throw error;
  }
};
const deleteProduct = async (id) => {
  const product = await Product.findByPk(id);
  if (!product) {
    return false;
  }
  await product.destroy();
  return true;
};
module.exports = { createProduct, getProducts, getProduct, updateProduct, deleteProduct };
