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
    // Search by product name or SKU (product-level defaultSku or variant sku)
    if (filters.search) {
      const search = filters.search.trim();
      if (search) {
        // Find product IDs matching name, defaultSku, or variant sku
        const productIdsByName = await Product.findAll({
          attributes: ['id'],
          where: {
            name: { [Op.iLike]: `%${search}%` }
          },
          raw: true
        });
        const idsByName = productIdsByName.map(p => p.id);
        const productIdsByDefaultSku = await Product.findAll({
          attributes: ['id'],
          where: {
            defaultSku: { [Op.iLike]: `%${search}%` }
          },
          raw: true
        });
        const idsByDefaultSku = productIdsByDefaultSku.map(p => p.id);
        const productIdsByVariantSku = await Product.findAll({
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
        const idsByVariantSku = productIdsByVariantSku.map(p => p.id);
        const allIds = [...new Set([...idsByName, ...idsByDefaultSku, ...idsByVariantSku])];
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
    // Find product IDs matching name, defaultSku, or variant sku
    const productIdsByName = await Product.findAll({
      attributes: ['id'],
      where: {
        name: { [Op.iLike]: `%${search}%` }
      },
      raw: true
    });
    const idsByName = productIdsByName.map(p => p.id);
    const productIdsByDefaultSku = await Product.findAll({
      attributes: ['id'],
      where: {
        defaultSku: { [Op.iLike]: `%${search}%` }
      },
      raw: true
    });
    const idsByDefaultSku = productIdsByDefaultSku.map(p => p.id);
    const productIdsByVariantSku = await Product.findAll({
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
    const idsByVariantSku = productIdsByVariantSku.map(p => p.id);
    const allIds = [...new Set([...idsByName, ...idsByDefaultSku, ...idsByVariantSku])];
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
