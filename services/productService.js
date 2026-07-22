const { Product, ProductVariant, ProductImage, Category, Subcategory } = require('../models');

const createProduct = async (data) => {
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

  const product = await Product.create(productData);

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
    await ProductVariant.bulkCreate(variantData);
  }

  if (data.images && data.images.length > 0) {
    const imageData = data.images.map((url, index) => ({
      productId: product.id,
      url,
      position: index,
    }));
    await ProductImage.bulkCreate(imageData);
  }

  const fullProduct = await Product.findByPk(product.id, {
    include: [
      { model: ProductVariant, as: 'variants' },
      { model: ProductImage, as: 'images' },
      { model: Category, as: 'category' },
      { model: Subcategory, as: 'subcategory' },
    ],
  });

  return fullProduct;
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

module.exports = { createProduct, getProducts, getProduct };
