const { Product, ProductVariant, ProductImage, Category, Subcategory, sequelize } = require('../models');
const { Op } = require('sequelize');
class StoreService {
  async getProducts(filters = {}) {
    const where = {};
    if (filters.featured) {
      where.showInFeaturedProducts = true;
    }
    if (filters.newArrivals) {
      where.showInNewArrivals = true;
    }
    // Search by product name or variant SKU
    if (filters.search) {
      const search = filters.search.trim();
      if (search) {
        // Use a single query with an OR condition on name and variant SKU
        // We need to include variants and use a subquery or literal
        // Approach: Use a subquery to find product IDs that match name or variant SKU,
        // then filter products by those IDs.
        // This is more reliable than trying to use include with where on the association
        // because we need to match any variant.
        const productIdsByName = await Product.findAll({
          attributes: ['id'],
          where: {
            name: { [Op.iLike]: `%${search}%` }
          },
          raw: true
        });
        const idsByName = productIdsByName.map(p => p.id);
        const productIdsBySku = await Product.findAll({
          attributes: ['id'],
          include: [{
            model: ProductVariant,
            as: 'variants',
            where: {
              sku: { [Op.iLike]: `%${search}%` }
            },
            required: true
          }],
          raw: true
        });
        const idsBySku = productIdsBySku.map(p => p.id);
        const allIds = [...new Set([...idsByName, ...idsBySku])];
        if (allIds.length === 0) {
          return []; // No matches
        }
        where.id = { [Op.in]: allIds };
      }
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
  // Autocomplete: return limited products (id, name, image) matching query
  async autocomplete(query, limit = 10) {
    if (!query || query.trim().length === 0) {
      return [];
    }
    const search = query.trim();
    // Similar search logic but only return id, name, and first image
    const productIdsByName = await Product.findAll({
      attributes: ['id'],
      where: {
        name: { [Op.iLike]: `%${search}%` }
      },
      raw: true
    });
    const idsByName = productIdsByName.map(p => p.id);
    const productIdsBySku = await Product.findAll({
      attributes: ['id'],
      include: [{
        model: ProductVariant,
        as: 'variants',
        where: {
          sku: { [Op.iLike]: `%${search}%` }
        },
        required: true
      }],
      raw: true
    });
    const idsBySku = productIdsBySku.map(p => p.id);
    const allIds = [...new Set([...idsByName, ...idsBySku])];
    if (allIds.length === 0) {
      return [];
    }
    const products = await Product.findAll({
      attributes: ['id', 'name'],
      where: { id: { [Op.in]: allIds } },
      include: [
        {
          model: ProductImage,
          as: 'images',
          limit: 1,
          attributes: ['url']
        }
      ],
      limit: limit,
      order: [['name', 'ASC']]
    });
    return products.map(p => ({
      id: p.id,
      name: p.name,
      image: p.images && p.images.length > 0 ? p.images[0].url : null
    }));
  }
}
module.exports = new StoreService();
