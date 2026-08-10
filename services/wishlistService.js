const { WishlistItem, Product, ProductImage } = require('../models');
const { Op } = require('sequelize');
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
    const items = await WishlistItem.findAll({
      where: { userId },
      include: [
        {
          model: Product,
          as: 'product',
          include: [
            {
              model: ProductImage,
              as: 'images',
              limit: 1,
              attributes: ['url'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    return items.map((item) => item.product);
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
