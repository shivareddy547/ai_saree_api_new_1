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
    const videoLength = sanitizeNumeric(data.videoLength);
    const productData = {
      userId: data.userId,
      name: data.name,
      description: data.description,
      basePrice: basePrice,
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
    if (data.variants && data.variants.length > 0) {
      const variantData = data.variants.map(v => {
        // Sanitize numeric fields for variants
        const price = sanitizeNumeric(v.price, 0); // price is required, default to 0
        const costPrice = sanitizeNumeric(v.costPrice);
        const stockQuantity = sanitizeNumeric(v.stockQuantity, 0);
        return {
          productId: product.id,
          sku: v.sku || '',
          size: v.size || '',
          color: v.color || '',
          price: price,
          costPrice: costPrice,
          stockQuantity: stockQuantity,
        };
      });
      await ProductVariant.bulkCreate(variantData, { transaction });
    }
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
    const videoLength = sanitizeNumeric(data.videoLength);
    const productData = {
      userId: data.userId,
      name: data.name,
      description: data.description,
      basePrice: basePrice,
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
      // New flags: update only if provided, else keep existing
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
      if (data.variants && data.variants.length > 0) {
        const variantData = data.variants.map(v => {
          const price = sanitizeNumeric(v.price, 0);
          const costPrice = sanitizeNumeric(v.costPrice);
          const stockQuantity = sanitizeNumeric(v.stockQuantity, 0);
          return {
            productId: id,
            sku: v.sku || '',
            size: v.size || '',
            color: v.color || '',
            price: price,
            costPrice: costPrice,
            stockQuantity: stockQuantity,
          };
        });
        await ProductVariant.bulkCreate(variantData, { transaction });
      }
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
