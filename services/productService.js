const { Product, ProductImage, ProductVariant, Category, sequelize } = require('../models');
const { Op } = require('sequelize');
const XLSX = require('xlsx');
class ProductService {
  async getAllProducts(filters = {}) {
    try {
      const where = {};
      if (filters.search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${filters.search}%` } },
          { defaultSku: { [Op.iLike]: `%${filters.search}%` } },
        ];
      }
      if (filters.status === 'active') {
        where.isActive = true;
      } else if (filters.status === 'deleted') {
        where.isActive = false;
      }
      if (filters.categoryId) {
        where.categoryId = filters.categoryId;
      }
      const products = await Product.findAll({
        where,
        include: [
          {
            model: ProductImage,
            as: 'images',
            attributes: ['id', 'url', 'position'],
          },
          {
            model: ProductVariant,
            as: 'variants',
            attributes: ['id', 'sku', 'size', 'color', 'price', 'stockQuantity', 'videoUrl', 'cloudinaryVideoPublicId'],
          },
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name'],
          },
        ],
        order: [['createdAt', 'DESC']],
      });
      return products;
    } catch (error) {
      console.error('Error in getAllProducts:', error);
      throw new Error('Failed to fetch products');
    }
  }
  async getProductById(id) {
    try {
      const product = await Product.findByPk(id, {
        include: [
          {
            model: ProductImage,
            as: 'images',
            attributes: ['id', 'url', 'position'],
          },
          {
            model: ProductVariant,
            as: 'variants',
          },
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name'],
          },
        ],
      });
      if (!product) {
        const err = new Error('Product not found');
        err.status = 404;
        throw err;
      }
      return product;
    } catch (error) {
      if (error.status) throw error;
      console.error('Error in getProductById:', error);
      throw new Error('Failed to fetch product');
    }
  }
  async deleteProduct(id) {
    try {
      const product = await Product.findByPk(id);
      if (!product) {
        const err = new Error('Product not found');
        err.status = 404;
        throw err;
      }
      await product.update({ isActive: false });
      return { success: true, message: 'Product deleted successfully' };
    } catch (error) {
      if (error.status) throw error;
      console.error('Error in deleteProduct:', error);
      throw new Error('Failed to delete product');
    }
  }
  async exportProductsToExcel(filters = {}) {
    try {
      const products = await this.getAllProducts(filters);
      const rows = products.map((p) => {
        const imageUrls = (p.images || [])
          .map((img) => img.url)
          .filter(Boolean)
          .join(' | ');
        const videoUrls = [
          p.videoUrl,
          p.videoKitUrl,
          p.cloudinaryVideoPublicId
            ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name'}/video/upload/${p.cloudinaryVideoPublicId}`
            : null,
        ]
          .filter(Boolean)
          .join(' | ');
        const variantSkus = (p.variants || [])
          .map((v) => v.sku)
          .filter(Boolean)
          .join(' | ');
        return {
          ID: p.id,
          Name: p.name || '',
          Description: p.description || '',
          'Base Price': p.basePrice != null ? Number(p.basePrice) : '',
          'Cost Price': p.costPrice != null ? Number(p.costPrice) : '',
          'Default SKU': p.defaultSku || '',
          'Stock Quantity': p.stockQuantity != null ? p.stockQuantity : '',
          Status: p.status || '',
          'Is Active': p.isActive ? 'Yes' : 'No',
          Views: p.views || 0,
          Category: p.category ? p.category.name : '',
          'Category ID': p.categoryId || '',
          'Video URL': p.videoUrl || '',
          'VideoKit URL': p.videoKitUrl || '',
          'Cloudinary Video Public ID': p.cloudinaryVideoPublicId || '',
          'All Image URLs': imageUrls,
          'All Video URLs': videoUrls,
          'Variant SKUs': variantSkus,
          Weight: p.weight != null ? Number(p.weight) : '',
          Length: p.length != null ? Number(p.length) : '',
          Breadth: p.breadth != null ? Number(p.breadth) : '',
          Height: p.height != null ? Number(p.height) : '',
          'Created At': p.createdAt ? new Date(p.createdAt).toISOString() : '',
          'Updated At': p.updatedAt ? new Date(p.updatedAt).toISOString() : '',
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
      // Generate buffer as .xls (BIFF8)
      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xls',
      });
      return buffer;
    } catch (error) {
      console.error('Error in exportProductsToExcel:', error);
      throw new Error('Failed to export products to Excel');
    }
  }
}
module.exports = new ProductService();
