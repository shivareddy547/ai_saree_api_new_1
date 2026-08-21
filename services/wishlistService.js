const { WishlistItem, Product, ProductVariant, ProductImage, Category } = require('../models');
const getWishlistProducts = async (userId) => {
  const items = await WishlistItem.findAll({
    where: { userId },
    include: [
      {
        model: Product,
        as: 'product',
        where: { isActive: true },
        required: true,
        include: [
          {
            model: ProductVariant,
            as: 'variants',
          },
          {
            model: ProductImage,
            as: 'images',
          },
          {
            model: Category,
            as: 'category',
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
  });
  return items.map((item) => item.product).filter(Boolean);
};
const getWishlistCount = async (userId) => {
  const count = await WishlistItem.count({
    where: { userId },
    include: [
      {
        model: Product,
        as: 'product',
        where: { isActive: true },
        required: true,
      },
    ],
  });
  return count;
};
const toggleWishlist = async (userId, productId) => {
  if (!productId) {
    const err = new Error('productId is required');
    err.status = 400;
    throw err;
  }
  const product = await Product.findOne({
    where: { id: productId, isActive: true },
  });
  if (!product) {
    const err = new Error('Product not found or is no longer available');
    err.status = 404;
    throw err;
  }
  const existing = await WishlistItem.findOne({
    where: { userId, productId },
  });
  let isWishlisted;
  if (existing) {
    await existing.destroy();
    isWishlisted = false;
  } else {
    await WishlistItem.create({ userId, productId });
    isWishlisted = true;
  }
  const count = await getWishlistCount(userId);
  return { isWishlisted, count };
};
const getWishlistStatus = async (userId, productId) => {
  if (!productId) {
    const err = new Error('productId is required');
    err.status = 400;
    throw err;
  }
  const existing = await WishlistItem.findOne({
    where: { userId, productId },
  });
  return { isWishlisted: !!existing };
};
module.exports = {
  getWishlistProducts,
  getWishlistCount,
  toggleWishlist,
  getWishlistStatus,
};
