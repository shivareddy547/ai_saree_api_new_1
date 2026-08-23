const { Product, ProductVariant, ProductImage, sequelize } = require('../models');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
class ProductExportService {
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
    // Fetch products with variants and product-level images (variantId null)
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
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    // Get product IDs to fetch subcategory names via raw SQL
    const productIds = products.map(p => p.id);
    let subcategoryMap = {};
    if (productIds.length > 0) {
      const subcategoryRows = await sequelize.query(
        `SELECT p.id AS productId, s.name AS subcategoryName
         FROM products p
         LEFT JOIN subcategories s ON p."subcategoryId" = s.id
         WHERE p.id IN (:productIds)`,
        {
          replacements: { productIds },
          type: sequelize.QueryTypes.SELECT
        }
      );
      subcategoryRows.forEach(row => {
        subcategoryMap[row.productId] = row.subcategoryName || '';
      });
    }
    // Helper to format boolean to Yes/No
    const formatBoolean = (value) => {
      if (value === null || value === undefined) return '';
      return value ? 'Yes' : 'No';
    };
    // Helper to get product video URLs (videoUrl + cloudinary)
    const getProductVideoUrls = (product) => {
      const urls = [];
      if (product.videoUrl) urls.push(product.videoUrl);
      if (product.cloudinaryVideoPublicId) {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name';
        urls.push(`https://res.cloudinary.com/${cloudName}/video/upload/${product.cloudinaryVideoPublicId}`);
      }
      return urls.join(', ');
    };
    // Helper to get variant video URL
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
    // Define columns as per the requirement (21 columns)
    worksheet.columns = [
      { header: 'Row Type', key: 'rowType', width: 15 },
      { header: 'Product SKU', key: 'productSku', width: 20 },
      { header: 'Product Name', key: 'productName', width: 30 },
      { header: 'Variant SKU', key: 'variantSku', width: 20 },
      { header: 'Size', key: 'size', width: 15 },
      { header: 'Color', key: 'color', width: 15 },
      { header: 'Price', key: 'price', width: 15 },
      { header: 'Stock', key: 'stock', width: 15 },
      { header: 'Subcategory', key: 'subcategory', width: 20 },
      { header: 'Show In Featured Products (Yes/No)', key: 'showFeatured', width: 25 },
      { header: 'Show In Best Sellers (Yes/No)', key: 'showBestSellers', width: 25 },
      { header: 'Show In New Arrivals (Yes/No)', key: 'showNewArrivals', width: 25 },
      { header: 'Show In Premium Products (Yes/No)', key: 'showPremium', width: 25 },
      { header: 'Weight', key: 'weight', width: 15 },
      { header: 'Length', key: 'length', width: 15 },
      { header: 'Breadth', key: 'breadth', width: 15 },
      { header: 'Height', key: 'height', width: 15 },
      { header: 'Video URL', key: 'videoUrl', width: 30 },
      { header: 'Product Image URLs', key: 'productImageUrls', width: 40 },
      { header: 'All Product Video URLs', key: 'allProductVideoUrls', width: 40 },
      { header: 'All Variant Video URLs', key: 'allVariantVideoUrls', width: 40 }
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
      const subcategoryName = subcategoryMap[product.id] || '';
      // Collect product-level data
      const productImageUrls = (product.images || []).map(img => img.url).join(', ');
      const allProductVideoUrls = getProductVideoUrls(product);
      // Collect all variant video URLs
      const allVariantVideoUrls = variants.map(v => getVariantVideoUrl(v)).filter(url => url).join(', ');
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
        subcategory: subcategoryName,
        showFeatured: formatBoolean(product.showInFeaturedProducts),
        showBestSellers: formatBoolean(product.showInBestSellers),
        showNewArrivals: formatBoolean(product.showInNewArrivals),
        showPremium: formatBoolean(product.showInPremiumProducts),
        weight: product.weight !== null ? Number(product.weight) : '',
        length: product.length !== null ? Number(product.length) : '',
        breadth: product.breadth !== null ? Number(product.breadth) : '',
        height: product.height !== null ? Number(product.height) : '',
        videoUrl: product.videoUrl || '',
        productImageUrls: productImageUrls,
        allProductVideoUrls: allProductVideoUrls,
        allVariantVideoUrls: allVariantVideoUrls
      };
      // Add product row
      const productRow = worksheet.addRow(productRowData);
      productRow.font = { bold: true };
      productRow.alignment = { vertical: 'middle' };
      // Variant rows (if any) - only fill variant-specific fields; leave product-level fields empty
      if (variants.length > 0) {
        for (const variant of variants) {
          const variantRowData = {
            rowType: 'Variant',
            productSku: product.defaultSku || '',  // Keep product SKU for context
            productName: '',  // Leave blank
            variantSku: variant.sku || '',
            size: variant.size || '',
            color: variant.color || '',
            price: variant.price !== null ? Number(variant.price) : '',
            stock: variant.stockQuantity !== null ? Number(variant.stockQuantity) : '',
            // All product-level fields left empty
            subcategory: '',
            showFeatured: '',
            showBestSellers: '',
            showNewArrivals: '',
            showPremium: '',
            weight: '',
            length: '',
            breadth: '',
            height: '',
            videoUrl: '',
            productImageUrls: '',
            allProductVideoUrls: '',
            allVariantVideoUrls: ''
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
