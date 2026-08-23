const { Product, ProductVariant, ProductImage, Category } = require('../models');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
class ProductExportService {
  async exportProducts(filters = {}) {
    const { search, status, categoryId } = filters;
    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { defaultSku: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (status === 'active') {
      whereClause.isActive = true;
    } else if (status === 'deleted') {
      whereClause.isActive = false;
    }
    if (categoryId) {
      whereClause.categoryId = parseInt(categoryId, 10);
    }
    const products = await Product.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: ProductImage,
          as: 'images',
          where: { variantId: null },
          required: false,
          separate: true
        },
        {
          model: ProductVariant,
          as: 'variants',
          required: false,
          include: [
            {
              model: ProductImage,
              as: 'images',
              required: false,
              separate: true
            }
          ]
        }
      ]
    });
    const categoryIds = new Set();
    products.forEach((p) => {
      if (p.categoryId) categoryIds.add(p.categoryId);
      if (p.subcategoryId) categoryIds.add(p.subcategoryId);
    });
    const categories =
      categoryIds.size > 0
        ? await Category.findAll({
            where: { id: { [Op.in]: Array.from(categoryIds) } },
            attributes: ['id', 'name'],
            raw: true,
          })
        : [];
    const categoryMap = {};
    categories.forEach((c) => {
      categoryMap[c.id] = c.name;
    });
    let maxVariants = 0;
    products.forEach((product) => {
      const variantCount = product.variants ? product.variants.length : 0;
      if (variantCount > maxVariants) {
        maxVariants = variantCount;
      }
    });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AI Saree Admin';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Products', {
      properties: { defaultRowHeight: 20 },
    });
    const columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Name', key: 'name', width: 32 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Default SKU', key: 'defaultSku', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Is Active (Yes/No)', key: 'isActive', width: 20 },
      { header: 'Base Price', key: 'basePrice', width: 15 },
      { header: 'Cost Price', key: 'costPrice', width: 15 },
      { header: 'Stock Quantity', key: 'stockQuantity', width: 16 },
      { header: 'Category Name', key: 'categoryName', width: 22 },
      { header: 'Subcategory', key: 'subcategoryName', width: 22 },
      { header: 'Show In Featured Products (Yes/No)', key: 'showInFeaturedProducts', width: 36 },
      { header: 'Show In Best Sellers (Yes/No)', key: 'showInBestSellers', width: 32 },
      { header: 'Show In New Arrivals (Yes/No)', key: 'showInNewArrivals', width: 32 },
      { header: 'Show In Premium Products (Yes/No)', key: 'showInPremiumProducts', width: 36 },
      { header: 'Weight', key: 'weight', width: 12 },
      { header: 'Length', key: 'length', width: 12 },
      { header: 'Breadth', key: 'breadth', width: 12 },
      { header: 'Height', key: 'height', width: 12 },
      { header: 'Video URL', key: 'videoUrl', width: 40 },
      { header: 'Product Image URLs', key: 'productImageUrls', width: 50 },
      { header: 'All Product Video URLs', key: 'allProductVideoUrls', width: 50 },
      { header: 'All Variant Video URLs', key: 'allVariantVideoUrls', width: 50 },
      { header: 'Variant Count', key: 'variantCount', width: 15 },
    ];
    for (let i = 1; i <= maxVariants; i++) {
      columns.push(
        { header: `Variant ${i} SKU`, key: `variant_${i}_sku`, width: 20 },
        { header: `Variant ${i} Size`, key: `variant_${i}_size`, width: 15 },
        { header: `Variant ${i} Color`, key: `variant_${i}_color`, width: 15 },
        { header: `Variant ${i} Price`, key: `variant_${i}_price`, width: 15 },
        { header: `Variant ${i} Stock`, key: `variant_${i}_stock`, width: 15 },
        { header: `Variant ${i} Image URLs`, key: `variant_${i}_images`, width: 50 },
        { header: `Variant ${i} Video URL`, key: `variant_${i}_video`, width: 40 }
      );
    }
    columns.push(
      { header: 'Created At', key: 'createdAt', width: 22 },
      { header: 'Updated At', key: 'updatedAt', width: 22 }
    );
    worksheet.columns = columns;
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C3AED' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    headerRow.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
    const getFilename = (url) => {
      if (!url) return '';
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const parts = pathname.split('/');
        return decodeURIComponent(parts[parts.length - 1]);
      } catch (e) {
        const parts = url.split(/[\\/]/);
        return parts[parts.length - 1];
      }
    };
    products.forEach((product) => {
      const productVideoUrls = [
        product.videoUrl,
        product.videoKitUrl,
        product.cloudinaryVideoPublicId,
      ].filter(Boolean);
      const allProductVideoFilenames = productVideoUrls.map((v) => getFilename(v)).join(', ');
      const mainVideoUrl = product.cloudinaryVideoPublicId
        ? getFilename(product.cloudinaryVideoPublicId)
        : product.videoUrl
        ? getFilename(product.videoUrl)
        : product.videoKitUrl
        ? getFilename(product.videoKitUrl)
        : '';
      const productImages =
        product.images && product.images.length > 0
          ? product.images.map((img) => getFilename(img.url)).join(', ')
          : '';
      const variants = product.variants || [];
      const allVariantVideoFilenames = variants
        .flatMap((v) => {
          const vids = [v.videoUrl, v.cloudinaryVideoPublicId].filter(Boolean);
          return vids.map((vid) => getFilename(vid));
        })
        .join(', ');
      const rowData = {
        id: product.id,
        name: product.name || '',
        description: product.description || '',
        defaultSku: product.defaultSku || '',
        status: product.status || '',
        isActive: product.isActive ? 'Yes' : 'No',
        basePrice: product.basePrice !== null ? Number(product.basePrice) : 0,
        costPrice: product.costPrice !== null ? Number(product.costPrice) : 0,
        stockQuantity: product.stockQuantity || 0,
        categoryName: product.categoryId ? categoryMap[product.categoryId] || '' : '',
        subcategoryName: product.subcategoryId ? categoryMap[product.subcategoryId] || '' : '',
        showInFeaturedProducts: product.showInFeaturedProducts ? 'Yes' : 'No',
        showInBestSellers: product.showInBestSellers ? 'Yes' : 'No',
        showInNewArrivals: product.showInNewArrivals ? 'Yes' : 'No',
        showInPremiumProducts: product.showInPremiumProducts ? 'Yes' : 'No',
        weight: product.weight !== null ? Number(product.weight) : 0,
        length: product.length !== null ? Number(product.length) : 0,
        breadth: product.breadth !== null ? Number(product.breadth) : 0,
        height: product.height !== null ? Number(product.height) : 0,
        videoUrl: mainVideoUrl,
        productImageUrls: productImages,
        allProductVideoUrls: allProductVideoFilenames,
        allVariantVideoUrls: allVariantVideoFilenames,
        variantCount: variants.length,
        createdAt: product.createdAt ? new Date(product.createdAt).toLocaleString() : '',
        updatedAt: product.updatedAt ? new Date(product.updatedAt).toLocaleString() : '',
      };
      variants.forEach((variant, index) => {
        const i = index + 1;
        const variantImages =
          variant.images && variant.images.length > 0
            ? variant.images.map((img) => getFilename(img.url)).join(', ')
            : '';
        const variantVideo = variant.cloudinaryVideoPublicId
          ? getFilename(variant.cloudinaryVideoPublicId)
          : variant.videoUrl
          ? getFilename(variant.videoUrl)
          : '';
        rowData[`variant_${i}_sku`] = variant.sku || '';
        rowData[`variant_${i}_size`] = variant.size || '';
        rowData[`variant_${i}_color`] = variant.color || '';
        rowData[`variant_${i}_price`] = variant.price !== null ? Number(variant.price) : 0;
        rowData[`variant_${i}_stock`] = variant.stockQuantity || 0;
        rowData[`variant_${i}_images`] = variantImages;
        rowData[`variant_${i}_video`] = variantVideo;
      });
      const row = worksheet.addRow(rowData);
      row.alignment = { vertical: 'top', wrapText: false };
      row.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    if (products.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: products.length + 1, column: columns.length },
      };
    }
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}
module.exports = new ProductExportService();
