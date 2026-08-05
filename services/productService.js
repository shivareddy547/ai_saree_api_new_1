const { Product, ProductVariant, ProductImage, Category, Subcategory, sequelize } = require('../models');
const createProduct = async (data) => {
  const transaction = await sequelize.transaction();
  try {
    // Validate subcategory if provided
    if (data.subcategoryId) {
      const subcategoryId = parseInt(data.subcategoryId, 10);
      const subcategory = await Subcategory.findByPk(subcategoryId);
      if (!subcategory) {
        throw new Error('Invalid subcategory ID');
      }
      // Check if subcategory belongs to the selected category
      if (data.categoryId) {
        const categoryId = parseInt(data.categoryId, 10);
        if (subcategory.categoryId !== categoryId) {
          throw new Error('Subcategory does not belong to the selected category');
        }
      }
    }
    const productData = {
      userId: data.userId,
      name: data.name,
      description: data.description,
      basePrice: data.price || data.basePrice,
      defaultSku: data.sku || data.defaultSku,
      categoryId: data.categoryId ? parseInt(data.categoryId, 10) : null,
      subcategoryId: data.subcategoryId ? parseInt(data.subcategoryId, 10) : null,
      videoUrl: data.videoUrl,
      videoKitUrl: data.videoKitUrl || data.videoUrl,
      audioMode: data.audioMode || 'text',
      audioScript: data.audioScript,
      audioLanguage: data.audioLanguage,
      voiceGender: data.voiceGender,
      videoLength: data.videoLength,
      customAudioUrl: data.customAudioUrl,
      recordedAudioUrl: data.recordedAudioUrl,
      status: data.status || 'draft',
      cloudinaryVideoPublicId: data.cloudinaryVideoPublicId,
      cloudinaryAudioPublicId: data.cloudinaryAudioPublicId,
    };
    const product = await Product.create(productData, { transaction });
    if (data.variants && data.variants.length > 0) {
      const variantData = data.variants.map(v => ({
        productId: product.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        price: v.price,
        costPrice: v.costPrice,
        stockQuantity: parseInt(v.stockQuantity, 10) || 0,
      }));
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
    // Validate subcategory if provided
    if (data.subcategoryId) {
      const subcategoryId = parseInt(data.subcategoryId, 10);
      const subcategory = await Subcategory.findByPk(subcategoryId);
      if (!subcategory) {
        throw new Error('Invalid subcategory ID');
      }
      // Check if subcategory belongs to the selected category
      if (data.categoryId) {
        const categoryId = parseInt(data.categoryId, 10);
        if (subcategory.categoryId !== categoryId) {
          throw new Error('Subcategory does not belong to the selected category');
        }
      }
    }
    const productData = {
      userId: data.userId,
      name: data.name,
      description: data.description,
      basePrice: data.price || data.basePrice,
      defaultSku: data.sku || data.defaultSku,
      categoryId: data.categoryId ? parseInt(data.categoryId, 10) : null,
      subcategoryId: data.subcategoryId ? parseInt(data.subcategoryId, 10) : null,
      videoUrl: data.videoUrl,
      videoKitUrl: data.videoKitUrl || data.videoUrl,
      audioMode: data.audioMode || 'text',
      audioScript: data.audioScript,
      audioLanguage: data.audioLanguage,
      voiceGender: data.voiceGender,
      videoLength: data.videoLength,
      customAudioUrl: data.customAudioUrl,
      recordedAudioUrl: data.recordedAudioUrl,
      status: data.status || 'draft',
      cloudinaryVideoPublicId: data.cloudinaryVideoPublicId,
      cloudinaryAudioPublicId: data.cloudinaryAudioPublicId,
    };
    await product.update(productData, { transaction });
    if (data.variants !== undefined) {
      await ProductVariant.destroy({
        where: { productId: id },
        transaction
      });
      if (data.variants && data.variants.length > 0) {
        const variantData = data.variants.map(v => ({
          productId: id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          price: v.price,
          costPrice: v.costPrice,
          stockQuantity: parseInt(v.stockQuantity, 10) || 0,
        }));
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
