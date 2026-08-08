const { Product, ProductVariant, ProductImage, Category, Subcategory, sequelize } = require('../models');
class StoreService {
  async getProducts(filters = {}) {
    const where = {};
    if (filters.featured) {
      where.showInFeaturedProducts = true;
    }
    if (filters.newArrivals) {
      where.showInNewArrivals = true;
    }
    const products = await Product.findAll({
      where,
      include: [
        {
          model: ProductVariant,
          as: 'variants',
        },
        {
          model: ProductImage,
          as: 'images',
          limit: 1,
        },
        {
          model: Category,
          as: 'category',
        },
        {
          model: Subcategory,
          as: 'subcategory',
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    return products;
  }
}
module.exports = new StoreService();
