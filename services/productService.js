const { Product, ProductVariant, ProductImage, Category, Subcategory, sequelize } = require('../models');

const createProduct = async (data) => {
  const transaction = await sequelize.transaction();
  try {
    const productData = {
      name: data.name,
      description: data.description,
      basePrice: data.price || data.basePrice,
      defaultSku: data.sku || data.defaultSku,
      categoryId: data.categoryId,
      subcategoryId: data.subcategoryId,
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
    await transaction.rollback();
    throw error;
  }
};

const getProducts = async () => {
  return await Product.findAll({
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
      await transaction.rollback();
      return null;
    }

    const productData = {
      name: data.name,
      description: data.description,
      basePrice: data.price || data.basePrice,
      defaultSku: data.sku || data.defaultSku,
      categoryId: data.categoryId,
      subcategoryId: data.subcategoryId,
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
    };

    await product.update(productData, { transaction });

    // Update variants if provided
    if (data.variants) {
      // Delete existing variants
      await ProductVariant.destroy({ 
        where: { productId: id }, 
        transaction 
      });

      if (data.variants.length > 0) {
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

    // Update images if provided
    if (data.images) {
      await ProductImage.destroy({ 
        where: { productId: id }, 
        transaction 
      });

      if (data.images.length > 0) {
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
    await transaction.rollback();
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
