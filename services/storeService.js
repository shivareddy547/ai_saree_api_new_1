const { Product, ProductVariant, ProductImage, Category, sequelize } = require('../models');
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
    if (filters.categoryId) {
      where.categoryId = parseInt(filters.categoryId, 10);
    }
    if (filters.subcategoryId) {
      where.subcategoryId = parseInt(filters.subcategoryId, 10);
    }
    // Search by product name or SKU
    if (filters.search) {
      const search = filters.search.trim();
      if (search) {
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
        where.id = { [Op.in]: allIds };
      }
    }
    // Sorting
    let order = [['createdAt', 'DESC']];
    const sortBy = filters.sortBy || 'newest';
    switch (sortBy) {
      case 'price_asc':
        order = [['basePrice', 'ASC']];
        break;
      case 'price_desc':
        order = [['basePrice', 'DESC']];
        break;
      case 'name_asc':
        order = [['name', 'ASC']];
        break;
      case 'name_desc':
        order = [['name', 'DESC']];
        break;
      case 'oldest':
        order = [['createdAt', 'ASC']];
        break;
      case 'newest':
      default:
        order = [['createdAt', 'DESC']];
        break;
    }
    // Fetch products (price filtering is done after, because real price often lives on variants)
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
          model: Category,
          as: 'subcategory',
        },
      ],
      order,
    });
    // ---------- Price filtering (works with both basePrice and variant prices) ----------
    const minPrice = filters.minPrice !== undefined && filters.minPrice !== ''
      ? parseFloat(filters.minPrice)
      : null;
    const maxPrice = filters.maxPrice !== undefined && filters.maxPrice !== ''
      ? parseFloat(filters.maxPrice)
      : null;
    let filtered = products;
    if (
      (minPrice !== null && !isNaN(minPrice)) ||
      (maxPrice !== null && !isNaN(maxPrice))
    ) {
      filtered = products.filter((p) => {
        // Calculate effective price:
        // Prefer the lowest positive variant price, otherwise fall back to basePrice
        let effectivePrice = null;
        if (p.variants && p.variants.length > 0) {
          const variantPrices = p.variants
            .map((v) => parseFloat(v.price))
            .filter((pr) => !isNaN(pr) && pr > 0);
          if (variantPrices.length > 0) {
            effectivePrice = Math.min(...variantPrices);
          }
        }
        if (effectivePrice === null) {
          const base = p.basePrice ? parseFloat(p.basePrice) : null;
          if (base !== null && !isNaN(base) && base > 0) {
            effectivePrice = base;
          }
        }
        // If we still have no valid price, exclude the product when a price filter is active
        if (effectivePrice === null || isNaN(effectivePrice)) {
          return false;
        }
        if (minPrice !== null && !isNaN(minPrice) && effectivePrice < minPrice) {
          return false;
        }
        if (maxPrice !== null && !isNaN(maxPrice) && effectivePrice > maxPrice) {
          return false;
        }
        return true;
      });
    }
    // When sorting by price, re-sort using the effective price
    if (sortBy === 'price_asc' || sortBy === 'price_desc') {
      filtered = filtered.slice().sort((a, b) => {
        const getEffective = (p) => {
          if (p.variants && p.variants.length > 0) {
            const prices = p.variants
              .map((v) => parseFloat(v.price))
              .filter((pr) => !isNaN(pr) && pr > 0);
            if (prices.length > 0) return Math.min(...prices);
          }
          return p.basePrice ? parseFloat(p.basePrice) || 0 : 0;
        };
        const priceA = getEffective(a);
        const priceB = getEffective(b);
        return sortBy === 'price_asc' ? priceA - priceB : priceB - priceA;
      });
    }
    return filtered;
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
          model: Category,
          as: 'subcategory',
        },
      ],
    });
    return product;
  }
  async autocomplete(query, limit = 10) {
    if (!query || query.trim().length === 0) {
      return [];
    }
    const search = query.trim();
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
