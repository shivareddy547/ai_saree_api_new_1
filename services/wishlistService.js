const { WishlistItem, Product, ProductVariant, ProductImage } = require('../models');
class WishlistService {
  async toggle(userId, productId) {
    const existing = await WishlistItem.findOne({ where: { userId, productId } });
    if (existing) {
      await existing.destroy();
      const count = await WishlistItem.count({ where: { userId } });
      return { isWishlisted: false, count };
    } else {
      await WishlistItem.create({ userId, productId });
      const count = await WishlistItem.count({ where: { userId } });
      return { isWishlisted: true, count };
    }
  }
  async getWishlist(userId) {
    const wishlistItems = await WishlistItem.findAll({
      where: { userId },
      include: [
        {
          model: Product,
          as: 'product',
          include: [
            {
              model: ProductVariant,
              as: 'variants',
            },
            {
              model: ProductImage,
              as: 'images',
              order: [['position', 'ASC']],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    return wishlistItems.map(item => item.product);
  }
  async getCount(userId) {
    return await WishlistItem.count({ where: { userId } });
  }
  async getStatus(userId, productId) {
    const exists = await WishlistItem.findOne({ where: { userId, productId } });
    return !!exists;
  }
}
module.exports = new WishlistService();
