const { Product, ProductVariant, ProductImage, Category, Subcategory } = require('../models');

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

  async getProductById(id) {
    const product = await Product.findByPk(id, {
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
        {
          model: Category,
          as: 'category',
        },
        {
          model: Subcategory,
          as: 'subcategory',
        },
      ],
    });
    return product;
  }
}

module.exports = new StoreService();
