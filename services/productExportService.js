const { Product, ProductVariant, ProductImage, Category, sequelize } = require('../models');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const path = require('path');
class ProductExportService {
  // Helper: extract filenames from a list of URLs
  getFilenamesFromUrls(urls) {
    if (!urls) return '';
    const urlArray = Array.isArray(urls) ? urls : urls.split(',').map(u => u.trim());
    return urlArray
      .filter(u => u)
      .map(url => path.basename(url))
      .join(', ');
  }
  async generateExportExcel(filters = {}) {
    const { search, status, categoryId } = filters;
    // Build where clause for products
    const where = {};
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'deleted') {
      where.isActive = false;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { defaultSku: { [Op.iLike]: `%${search}%` } }
      ];
    }
    // Fetch products with variants, product-level images, category, and subcategory
    const products = await Product.findAll({
      where,
      include: [
        {
          model: ProductVariant,
          as: 'variants',
          required: false,
          order: [['sku', 'ASC']]
        },
        {
          model: ProductImage,
          as: 'images',
          required: false,
          where: { variantId: null },
          order: [['position', 'ASC']]
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name'],
          required: false
        },
        {
          model: Category,
          as: 'subcategory',
          attributes: ['id', 'name'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    // Get all variant IDs to fetch variant images
    const variantIds = [];
    products.forEach(p => {
      if (p.variants) {
        p.variants.forEach(v => variantIds.push(v.id));
      }
    });
    // Fetch variant images (variantId not null)
    let variantImagesMap = {};
    if (variantIds.length > 0) {
      const variantImages = await ProductImage.findAll({
        where: {
          variantId: { [Op.in]: variantIds }
        },
        order: [['position', 'ASC']]
      });
      variantImages.forEach(img => {
        if (!variantImagesMap[img.variantId]) {
          variantImagesMap[img.variantId] = [];
        }
        variantImagesMap[img.variantId].push(img.url);
      });
    }
    // Helper to format boolean to Yes/No
    const formatBoolean = (value) => {
      if (value === null || value === undefined) return '';
      return value ? 'Yes' : 'No';
    };
    // Helper to get product video URLs (full URLs) as array
    const getProductVideoUrlsList = (product) => {
      const urls = [];
      if (product.videoUrl) urls.push(product.videoUrl);
      if (product.cloudinaryVideoPublicId) {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name';
        urls.push(`https://res.cloudinary.com/${cloudName}/video/upload/${product.cloudinaryVideoPublicId}`);
      }
      return urls;
    };
    // Helper to get variant video URL (single)
    const getVariantVideoUrl = (variant) => {
      if (variant.cloudinaryVideoPublicId) {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name';
        return `https://res.cloudinary.com/${cloudName}/video/upload/${variant.cloudinaryVideoPublicId}`;
      }
      if (variant.videoUrl) {
        return variant.videoUrl;
      }
      return '';
    };
    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products');
    // Define columns (22 columns: Category and Subcategory)
    worksheet.columns = [
      { header: 'Row Type', key: 'rowType', width: 15 },
      { header: 'Product SKU', key: 'productSku', width: 20 },
      { header: 'Product Name', key: 'productName', width: 30 },
      { header: 'Variant SKU', key: 'variantSku', width: 20 },
      { header: 'Size', key: 'size', width: 15 },
      { header: 'Color', key: 'color', width: 15 },
      { header: 'Price', key: 'price', width: 15 },
      { header: 'Stock', key: 'stock', width: 15 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Subcategory', key: 'subcategory', width: 20 },
      { header: 'Show In Featured Products (Yes/No)', key: 'showFeatured', width: 25 },
      { header: 'Show In Best Sellers (Yes/No)', key: 'showBestSellers', width: 25 },
      { header: 'Show In New Arrivals (Yes/No)', key: 'showNewArrivals', width: 25 },
      { header: 'Show In Premium Products (Yes/No)', key: 'showPremium', width: 25 },
      { header: 'Weight', key: 'weight', width: 15 },
      { header: 'Length', key: 'length', width: 15 },
      { header: 'Breadth', key: 'breadth', width: 15 },
      { header: 'Height', key: 'height', width: 15 },
      { header: 'Image URLs', key: 'imageUrls', width: 50 },
      { header: 'Video URLs', key: 'videoUrls', width: 50 }
    ];
    // Style the header row (indigo background, white bold text)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' } // Indigo-600
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;
    // Process each product
    for (const product of products) {
      const variants = product.variants || [];
      const categoryName = product.category ? product.category.name : '';
      const subcategoryName = product.subcategory ? product.subcategory.name : '';
      // Product-level image URLs (product images) - get filenames only
      const productImageUrls = (product.images || []).map(img => img.url);
      const productImageFilenames = this.getFilenamesFromUrls(productImageUrls);
      // Product video URLs - get filenames only
      const productVideoUrls = getProductVideoUrlsList(product);
      const productVideoFilenames = this.getFilenamesFromUrls(productVideoUrls);
      // Build product row data (fill product-level fields)
      const productRowData = {
        rowType: 'Product',
        productSku: product.defaultSku || '',
        productName: product.name || '',
        variantSku: '',
        size: '',
        color: '',
        price: product.basePrice !== null ? Number(product.basePrice) : '',
        stock: '',
        category: categoryName,
        subcategory: subcategoryName,
        showFeatured: formatBoolean(product.showInFeaturedProducts),
        showBestSellers: formatBoolean(product.showInBestSellers),
        showNewArrivals: formatBoolean(product.showInNewArrivals),
        showPremium: formatBoolean(product.showInPremiumProducts),
        weight: product.weight !== null ? Number(product.weight) : '',
        length: product.length !== null ? Number(product.length) : '',
        breadth: product.breadth !== null ? Number(product.breadth) : '',
        height: product.height !== null ? Number(product.height) : '',
        imageUrls: productImageFilenames,
        videoUrls: productVideoFilenames
      };
      // Add product row
      const productRow = worksheet.addRow(productRowData);
      productRow.font = { bold: true };
      productRow.alignment = { vertical: 'middle' };
      // Variant rows
      if (variants.length > 0) {
        for (const variant of variants) {
          // Variant image URLs - get filenames only
          const variantImageUrls = variantImagesMap[variant.id] || [];
          const variantImageFilenames = this.getFilenamesFromUrls(variantImageUrls);
          // Variant video URL - get filename only
          const variantVideoUrl = getVariantVideoUrl(variant);
          const variantVideoFilenames = this.getFilenamesFromUrls(variantVideoUrl ? [variantVideoUrl] : []);
          const variantRowData = {
            rowType: 'Variant',
            productSku: product.defaultSku || '',
            productName: '',
            variantSku: variant.sku || '',
            size: variant.size || '',
            color: variant.color || '',
            price: variant.price !== null ? Number(variant.price) : '',
            stock: variant.stockQuantity !== null ? Number(variant.stockQuantity) : '',
            // Product-level fields left empty
            category: '',
            subcategory: '',
            showFeatured: '',
            showBestSellers: '',
            showNewArrivals: '',
            showPremium: '',
            weight: '',
            length: '',
            breadth: '',
            height: '',
            imageUrls: variantImageFilenames,
            videoUrls: variantVideoFilenames
          };
          const variantRow = worksheet.addRow(variantRowData);
          variantRow.alignment = { vertical: 'middle' };
        }
      }
      // Add an empty row after each product group (including variants)
      worksheet.addRow({});
    }
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
  // Alias method to match controller expectation
  async exportProducts(filters = {}) {
    return this.generateExportExcel(filters);
  }
}
module.exports = new ProductExportService();
