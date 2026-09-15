const { Product, ProductImage, ProductVariant, Category, sequelize } = require('../models');
const { Op } = require('sequelize');
const XLSX = require('xlsx');
// Helper to sanitize numeric fields: convert empty string to null (or default value for required fields)
const sanitizeNumeric = (value, defaultValue = null) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};
// Helper to generate video URL from Cloudinary public ID if videoUrl is not set
const getVideoUrl = (product) => {
  if (product.videoUrl) return product.videoUrl;
  if (product.cloudinaryVideoPublicId) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    if (cloudName) {
      return `https://res.cloudinary.com/${cloudName}/video/upload/${product.cloudinaryVideoPublicId}`;
    }
  }
  return null;
};
// Helper to normalize image items (supports both string URLs and {url, variantId, position} objects)
const normalizeImageItem = (item, index) => {
  if (typeof item === 'string') {
    return {
      url: item,
      variantId: null,
      position: index,
    };
  }
  if (item && typeof item === 'object') {
    return {
      url: item.url,
      variantId: item.variantId || null,
      position: item.position !== undefined ? item.position : index,
    };
  }
  return null;
};
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
          {
            model: Category,
            as: 'subcategory',
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
  async createProduct(data) {
    const transaction = await sequelize.transaction();
    try {
      // Sanitize numeric fields
      const basePrice = sanitizeNumeric(data.price || data.basePrice);
      const costPrice = sanitizeNumeric(data.costPrice);
      const stockQuantity = sanitizeNumeric(data.stockQuantity, 0);
      const videoLength = sanitizeNumeric(data.videoLength);
      const weight = sanitizeNumeric(data.weight, 0.5);
      const lengthVal = sanitizeNumeric(data.length, 30);
      const breadth = sanitizeNumeric(data.breadth, 25);
      const height = sanitizeNumeric(data.height, 5);
      // Determine customAudioUrl / recordedAudioUrl based on audioMode and incoming audioUrl
      let customAudioUrl = data.customAudioUrl;
      let recordedAudioUrl = data.recordedAudioUrl;
      if (data.audioUrl && !customAudioUrl && data.audioMode !== 'record') {
        customAudioUrl = data.audioUrl;
      }
      if (data.audioUrl && data.audioMode === 'record' && !recordedAudioUrl) {
        recordedAudioUrl = data.audioUrl;
      }
      const productData = {
        userId: data.userId,
        name: data.name,
        description: data.description,
        basePrice: basePrice,
        costPrice: costPrice,
        stockQuantity: stockQuantity,
        defaultSku: data.sku || data.defaultSku,
        categoryId: data.categoryId ? parseInt(data.categoryId, 10) : null,
        subcategoryId: data.subcategoryId ? parseInt(data.subcategoryId, 10) : null,
        videoUrl: data.videoUrl,
        videoKitUrl: data.videoKitUrl || data.videoUrl,
        audioMode: data.audioMode || 'text',
        audioScript: data.audioScript,
        audioLanguage: data.audioLanguage,
        voiceGender: data.voiceGender,
        videoLength: videoLength,
        customAudioUrl: customAudioUrl,
        recordedAudioUrl: recordedAudioUrl,
        status: data.status || 'draft',
        cloudinaryVideoPublicId: data.cloudinaryVideoPublicId,
        cloudinaryAudioPublicId: data.cloudinaryAudioPublicId,
        showInFeaturedProducts: data.showInFeaturedProducts || false,
        showInBestSellers: data.showInBestSellers || false,
        showInNewArrivals: data.showInNewArrivals || false,
        showInPremiumProducts: data.showInPremiumProducts || false,
        weight: weight,
        length: lengthVal,
        breadth: breadth,
        height: height,
        isActive: data.isActive !== undefined ? data.isActive : true,
      };
      const product = await Product.create(productData, { transaction });
      // Ensure at least one variant
      let variants = data.variants || [];
      if (variants.length === 0) {
        variants = [{
          sku: data.sku || data.defaultSku || 'default',
          size: '',
          color: '',
          price: basePrice || 0,
          costPrice: costPrice,
          stockQuantity: stockQuantity,
        }];
      }
      const variantData = variants.map(v => {
        const price = sanitizeNumeric(v.price, 0);
        const costPriceVar = sanitizeNumeric(v.costPrice);
        const stockQuantityVar = sanitizeNumeric(v.stockQuantity, 0);
        return {
          productId: product.id,
          sku: v.sku || '',
          size: v.size || '',
          color: v.color || '',
          price: price,
          costPrice: costPriceVar,
          stockQuantity: stockQuantityVar,
          videoUrl: v.videoUrl || null,
          cloudinaryVideoPublicId: v.cloudinaryVideoPublicId || null,
        };
      });
      await ProductVariant.bulkCreate(variantData, { transaction });
      // Handle images (supports both string URLs and {url, variantId, position} objects)
      if (data.images && data.images.length > 0) {
        const imageData = data.images
          .map((item, index) => normalizeImageItem(item, index))
          .filter(img => img && img.url)
          .map(img => ({
            productId: product.id,
            url: img.url,
            variantId: img.variantId,
            position: img.position,
          }));
        if (imageData.length > 0) {
          await ProductImage.bulkCreate(imageData, { transaction });
        }
      }
      await transaction.commit();
      const fullProduct = await Product.findByPk(product.id, {
        include: [
          { model: ProductVariant, as: 'variants' },
          { model: ProductImage, as: 'images' },
          { model: Category, as: 'category' },
          { model: Category, as: 'subcategory' },
        ],
      });
      if (fullProduct) {
        fullProduct.videoUrl = getVideoUrl(fullProduct);
      }
      return fullProduct;
    } catch (error) {
      if (transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
        await transaction.rollback();
      }
      throw error;
    }
  }
  async updateProduct(id, data) {
    const transaction = await sequelize.transaction();
    try {
      const product = await Product.findByPk(id);
      if (!product) {
        if (transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
          await transaction.rollback();
        }
        const err = new Error('Product not found');
        err.status = 404;
        throw err;
      }
      // Sanitize numeric fields
      const basePrice = sanitizeNumeric(data.price || data.basePrice);
      const costPrice = sanitizeNumeric(data.costPrice);
      const stockQuantity = sanitizeNumeric(data.stockQuantity, 0);
      const videoLength = sanitizeNumeric(data.videoLength);
      const weight = sanitizeNumeric(data.weight, 0.5);
      const lengthVal = sanitizeNumeric(data.length, 30);
      const breadth = sanitizeNumeric(data.breadth, 25);
      const height = sanitizeNumeric(data.height, 5);
      // Determine customAudioUrl / recordedAudioUrl based on audioMode and incoming audioUrl
      let customAudioUrl = data.customAudioUrl !== undefined ? data.customAudioUrl : product.customAudioUrl;
      let recordedAudioUrl = data.recordedAudioUrl !== undefined ? data.recordedAudioUrl : product.recordedAudioUrl;
      if (data.audioUrl !== undefined) {
        if (data.audioMode === 'record') {
          recordedAudioUrl = data.audioUrl;
        } else {
          customAudioUrl = data.audioUrl;
        }
      }
      const productData = {
        name: data.name !== undefined ? data.name : product.name,
        description: data.description !== undefined ? data.description : product.description,
        basePrice: basePrice !== null ? basePrice : product.basePrice,
        costPrice: costPrice !== null ? costPrice : product.costPrice,
        stockQuantity: stockQuantity !== null ? stockQuantity : product.stockQuantity,
        defaultSku: data.sku || data.defaultSku || product.defaultSku,
        categoryId: data.categoryId !== undefined ? (data.categoryId ? parseInt(data.categoryId, 10) : null) : product.categoryId,
        subcategoryId: data.subcategoryId !== undefined ? (data.subcategoryId ? parseInt(data.subcategoryId, 10) : null) : product.subcategoryId,
        videoUrl: data.videoUrl !== undefined ? data.videoUrl : product.videoUrl,
        videoKitUrl: data.videoKitUrl || data.videoUrl || product.videoKitUrl,
        audioMode: data.audioMode || product.audioMode,
        audioScript: data.audioScript !== undefined ? data.audioScript : product.audioScript,
        audioLanguage: data.audioLanguage !== undefined ? data.audioLanguage : product.audioLanguage,
        voiceGender: data.voiceGender !== undefined ? data.voiceGender : product.voiceGender,
        videoLength: videoLength !== null ? videoLength : product.videoLength,
        customAudioUrl: customAudioUrl,
        recordedAudioUrl: recordedAudioUrl,
        status: data.status || product.status,
        cloudinaryVideoPublicId: data.cloudinaryVideoPublicId !== undefined ? data.cloudinaryVideoPublicId : product.cloudinaryVideoPublicId,
        cloudinaryAudioPublicId: data.cloudinaryAudioPublicId !== undefined ? data.cloudinaryAudioPublicId : product.cloudinaryAudioPublicId,
        showInFeaturedProducts: data.showInFeaturedProducts !== undefined ? data.showInFeaturedProducts : product.showInFeaturedProducts,
        showInBestSellers: data.showInBestSellers !== undefined ? data.showInBestSellers : product.showInBestSellers,
        showInNewArrivals: data.showInNewArrivals !== undefined ? data.showInNewArrivals : product.showInNewArrivals,
        showInPremiumProducts: data.showInPremiumProducts !== undefined ? data.showInPremiumProducts : product.showInPremiumProducts,
        weight: weight !== null ? weight : product.weight,
        length: lengthVal !== null ? lengthVal : product.length,
        breadth: breadth !== null ? breadth : product.breadth,
        height: height !== null ? height : product.height,
        isActive: data.isActive !== undefined ? data.isActive : product.isActive,
      };
      await product.update(productData, { transaction });
      if (data.variants !== undefined) {
        await ProductVariant.destroy({
          where: { productId: id },
          transaction,
        });
        let variants = data.variants || [];
        if (variants.length === 0) {
          variants = [{
            sku: product.defaultSku || 'default',
            size: '',
            color: '',
            price: product.basePrice || 0,
            costPrice: product.costPrice,
            stockQuantity: product.stockQuantity || 0,
          }];
        }
        const variantData = variants.map(v => {
          const price = sanitizeNumeric(v.price, 0);
          const costPriceVar = sanitizeNumeric(v.costPrice);
          const stockQuantityVar = sanitizeNumeric(v.stockQuantity, 0);
          return {
            productId: id,
            sku: v.sku || '',
            size: v.size || '',
            color: v.color || '',
            price: price,
            costPrice: costPriceVar,
            stockQuantity: stockQuantityVar,
            videoUrl: v.videoUrl || null,
            cloudinaryVideoPublicId: v.cloudinaryVideoPublicId || null,
          };
        });
        await ProductVariant.bulkCreate(variantData, { transaction });
      }
      if (data.images !== undefined) {
        await ProductImage.destroy({
          where: { productId: id },
          transaction,
        });
        if (data.images && data.images.length > 0) {
          const imageData = data.images
            .map((item, index) => normalizeImageItem(item, index))
            .filter(img => img && img.url)
            .map(img => ({
              productId: id,
              url: img.url,
              variantId: img.variantId,
              position: img.position,
            }));
          if (imageData.length > 0) {
            await ProductImage.bulkCreate(imageData, { transaction });
          }
        }
      }
      await transaction.commit();
      const fullProduct = await Product.findByPk(id, {
        include: [
          { model: ProductVariant, as: 'variants' },
          { model: ProductImage, as: 'images' },
          { model: Category, as: 'category' },
          { model: Category, as: 'subcategory' },
        ],
      });
      if (fullProduct) {
        fullProduct.videoUrl = getVideoUrl(fullProduct);
      }
      return fullProduct;
    } catch (error) {
      if (transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
        await transaction.rollback();
      }
      throw error;
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
        const productImages = (p.images || [])
          .filter((img) => !img.variantId)
          .sort((a, b) => (a.position || 0) - (b.position || 0))
          .map((img) => img.url)
          .filter(Boolean);
        const variantImageMap = {};
        (p.images || [])
          .filter((img) => img.variantId)
          .forEach((img) => {
            if (!variantImageMap[img.variantId]) {
              variantImageMap[img.variantId] = [];
            }
            variantImageMap[img.variantId].push(img.url);
          });
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
          ID: p.id,
          Name: p.name || '',
          Description: p.description || '',
          'Default SKU': p.defaultSku || '',
          Status: p.status || '',
          'Is Active': p.isActive ? 'Yes' : 'No',
          Views: p.views || 0,
          'Base Price': p.basePrice != null ? Number(p.basePrice) : '',
          'Cost Price': p.costPrice != null ? Number(p.costPrice) : '',
          'Stock Quantity': p.stockQuantity != null ? p.stockQuantity : '',
          'Category ID': p.categoryId || '',
          'Category Name': p.category ? p.category.name : '',
          'Subcategory ID': p.subcategoryId || '',
          'Show In Featured Products': p.showInFeaturedProducts ? 'Yes' : 'No',
          'Show In Best Sellers': p.showInBestSellers ? 'Yes' : 'No',
          'Show In New Arrivals': p.showInNewArrivals ? 'Yes' : 'No',
          'Show In Premium Products': p.showInPremiumProducts ? 'Yes' : 'No',
          Weight: p.weight != null ? Number(p.weight) : '',
          Length: p.length != null ? Number(p.length) : '',
          Breadth: p.breadth != null ? Number(p.breadth) : '',
          Height: p.height != null ? Number(p.height) : '',
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
          'Product Image URLs': productImages.join(' | '),
          'All Product Video URLs': productVideoUrls.join(' | '),
          'All Variant Video URLs': variantVideoUrls.join(' | '),
          'Variant Count': (p.variants || []).length,
          'Variants Detail': variantDetails.join(' || '),
          'Created At': p.createdAt ? new Date(p.createdAt).toISOString() : '',
          'Updated At': p.updatedAt ? new Date(p.updatedAt).toISOString() : '',
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(rows);
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
