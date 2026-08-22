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
            attributes: ['id', 'url', 'position', 'variantId'],
          },
          {
            model: ProductVariant,
            as: 'variants',
            attributes: [
              'id',
              'sku',
              'size',
              'color',
              'price',
              'costPrice',
              'stockQuantity',
              'videoUrl',
              'cloudinaryVideoPublicId',
            ],
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
            attributes: ['id', 'url', 'position', 'variantId'],
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
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'your-cloud-name';
      const rows = products.map((p) => {
        // Product-level images (no variantId)
        const productImages = (p.images || [])
          .filter((img) => !img.variantId)
          .sort((a, b) => (a.position || 0) - (b.position || 0))
          .map((img) => img.url)
          .filter(Boolean);
        // Variant-level images grouped
        const variantImageMap = {};
        (p.images || [])
          .filter((img) => img.variantId)
          .forEach((img) => {
            if (!variantImageMap[img.variantId]) {
              variantImageMap[img.variantId] = [];
            }
            variantImageMap[img.variantId].push(img.url);
          });
        // Build rich variant details (pipe-separated for import compatibility)
        const variantDetails = (p.variants || []).map((v) => {
          const vImages = (variantImageMap[v.id] || []).join(',');
          const vVideo =
            v.videoUrl ||
            (v.cloudinaryVideoPublicId
              ? `https://res.cloudinary.com/${cloudName}/video/upload/${v.cloudinaryVideoPublicId}`
              : '');
          return [
            `id:${v.id || ''}`,
            `sku:${v.sku || ''}`,
            `size:${v.size || ''}`,
            `color:${v.color || ''}`,
            `price:${v.price != null ? v.price : ''}`,
            `costPrice:${v.costPrice != null ? v.costPrice : ''}`,
            `stockQuantity:${v.stockQuantity != null ? v.stockQuantity : ''}`,
            `videoUrl:${vVideo}`,
            `cloudinaryVideoPublicId:${v.cloudinaryVideoPublicId || ''}`,
            `images:${vImages}`,
          ].join(';');
        });
        // All video URLs (product + variants)
        const productVideoUrls = [
          p.videoUrl,
          p.videoKitUrl,
          p.cloudinaryVideoPublicId
            ? `https://res.cloudinary.com/${cloudName}/video/upload/${p.cloudinaryVideoPublicId}`
            : null,
        ].filter(Boolean);
        const variantVideoUrls = (p.variants || [])
          .map((v) => {
            if (v.videoUrl) return v.videoUrl;
            if (v.cloudinaryVideoPublicId) {
              return `https://res.cloudinary.com/${cloudName}/video/upload/${v.cloudinaryVideoPublicId}`;
            }
            return null;
          })
          .filter(Boolean);
        return {
          // Core identity
          ID: p.id,
          Name: p.name || '',
          Description: p.description || '',
          'Default SKU': p.defaultSku || '',
          Status: p.status || '',
          'Is Active': p.isActive ? 'Yes' : 'No',
          Views: p.views || 0,
          // Pricing & inventory
          'Base Price': p.basePrice != null ? Number(p.basePrice) : '',
          'Cost Price': p.costPrice != null ? Number(p.costPrice) : '',
          'Stock Quantity': p.stockQuantity != null ? p.stockQuantity : '',
          // Category
          'Category ID': p.categoryId || '',
          'Category Name': p.category ? p.category.name : '',
          'Subcategory ID': p.subcategoryId || '',
          // Display flags
          'Show In Featured Products': p.showInFeaturedProducts ? 'Yes' : 'No',
          'Show In Best Sellers': p.showInBestSellers ? 'Yes' : 'No',
          'Show In New Arrivals': p.showInNewArrivals ? 'Yes' : 'No',
          'Show In Premium Products': p.showInPremiumProducts ? 'Yes' : 'No',
          // Shipping dimensions
          Weight: p.weight != null ? Number(p.weight) : '',
          Length: p.length != null ? Number(p.length) : '',
          Breadth: p.breadth != null ? Number(p.breadth) : '',
          Height: p.height != null ? Number(p.height) : '',
          // Product-level video / audio
          'Video URL': p.videoUrl || '',
          'VideoKit URL': p.videoKitUrl || '',
          'Cloudinary Video Public ID': p.cloudinaryVideoPublicId || '',
          'Cloudinary Audio Public ID': p.cloudinaryAudioPublicId || '',
          'Audio Mode': p.audioMode || '',
          'Audio Script': p.audioScript || '',
          'Audio Language': p.audioLanguage || '',
          'Voice Gender': p.voiceGender || '',
          'Video Length': p.videoLength != null ? p.videoLength : '',
          'Custom Audio URL': p.customAudioUrl || '',
          'Recorded Audio URL': p.recordedAudioUrl || '',
          // Aggregated media (pipe / comma separated for easy import parsing)
          'Product Image URLs': productImages.join(' | '),
          'All Product Video URLs': productVideoUrls.join(' | '),
          'All Variant Video URLs': variantVideoUrls.join(' | '),
          'Variant Count': (p.variants || []).length,
          'Variants Detail': variantDetails.join(' || '),
          // Timestamps
          'Created At': p.createdAt ? new Date(p.createdAt).toISOString() : '',
          'Updated At': p.updatedAt ? new Date(p.updatedAt).toISOString() : '',
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(rows);
      // Set reasonable column widths for readability
      const colWidths = Object.keys(rows[0] || {}).map((key) => {
        if (key.includes('Description') || key.includes('Script') || key.includes('Detail') || key.includes('URLs')) {
          return { wch: 50 };
        }
        if (key.includes('ID') || key.includes('SKU')) {
          return { wch: 36 };
        }
        return { wch: 18 };
      });
      worksheet['!cols'] = colWidths;
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
      // Generate .xls (BIFF8) buffer for maximum compatibility
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
