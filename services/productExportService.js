const { Product, ProductVariant, ProductImage, Category, sequelize } = require('../models');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const path = require('path');
const archiver = require('archiver');
const axios = require('axios');
const { PassThrough } = require('stream');
class ProductExportService {
  // Helper: sanitize product folder name
  sanitizeProductFolderName(productName, productSku) {
    // Normalize product name: lowercase, replace spaces with -, remove special chars
    let name = productName.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // allow letters, numbers, spaces, hyphens
      .trim()
      .replace(/\s+/g, '-') // replace spaces with -
      .replace(/-+/g, '-') // collapse multiple hyphens
      .replace(/^-|-$/g, ''); // trim leading/trailing hyphens
    // Ensure SKU is safe
    const sku = productSku.replace(/[^a-zA-Z0-9-]/g, '');
    // Combine: name + '-' + sku
    let folder = `${name}-${sku}`;
    // If name is empty, just use sku
    if (!name) folder = sku;
    // Remove any unsafe characters that might remain
    folder = folder.replace(/[^a-zA-Z0-9-]/g, '');
    // Collapse multiple hyphens
    folder = folder.replace(/-+/g, '-').replace(/^-|-$/g, '');
    return folder;
  }
  // Helper: sanitize variant folder name: sku-color-size
  sanitizeVariantFolderName(variantSku, color, size) {
    const parts = [];
    // SKU is mandatory
    const sku = variantSku.replace(/[^a-zA-Z0-9-]/g, '');
    parts.push(sku);
    if (color && color.trim() !== '') {
      const col = color.trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      if (col) parts.push(col);
    }
    if (size && size.trim() !== '') {
      const sz = size.trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      if (sz) parts.push(sz);
    }
    return parts.join('-');
  }
  // Generate local path for image in ZIP with new folder structure
  getImageZipPath(productName, productSku, isVariant, variantSku, variantColor, variantSize, position, extension) {
    const productFolder = this.sanitizeProductFolderName(productName, productSku);
    const pos = String(position).padStart(2, '0');
    const filename = `${pos}.${extension}`;
    if (isVariant) {
      const variantFolder = this.sanitizeVariantFolderName(variantSku, variantColor, variantSize);
      return `images/${productFolder}/variants/${variantFolder}/${filename}`;
    } else {
      return `images/${productFolder}/product/${filename}`;
    }
  }
  // Get file extension from URL or content-type
  getExtensionFromUrl(url, contentType) {
    if (!url) return 'jpg';
    let ext = path.extname(url).toLowerCase().replace(/^\./, '');
    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return ext;
    }
    if (contentType) {
      const mimeToExt = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
      };
      const mime = contentType.split(';')[0].trim();
      if (mimeToExt[mime]) return mimeToExt[mime];
    }
    return 'jpg';
  }
  // Download an image and add to ZIP archive
  async addImageToZip(archive, imageUrl, zipPath) {
    try {
      const response = await axios({
        method: 'get',
        url: imageUrl,
        responseType: 'stream',
        timeout: 30000,
      });
      archive.append(response.data, { name: zipPath });
    } catch (error) {
      console.error(`Failed to download image ${imageUrl}: ${error.message}`);
    }
  }
  async generateExportZip(filters = {}) {
    const { search, status, categoryId } = filters;
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
        variantImagesMap[img.variantId].push(img);
      });
    }
    const formatBoolean = (value) => {
      if (value === null || value === undefined) return '';
      return value ? 'Yes' : 'No';
    };
    const getProductVideoUrlsList = (product) => {
      const urls = [];
      if (product.videoUrl) urls.push(product.videoUrl);
      if (product.cloudinaryVideoPublicId) {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name';
        urls.push(`https://res.cloudinary.com/${cloudName}/video/upload/${product.cloudinaryVideoPublicId}`);
      }
      return urls;
    };
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
    // Create archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    const archiveStream = new PassThrough();
    archive.pipe(archiveStream);
    const imageQueue = [];
    // Prepare Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products');
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
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;
    worksheet.views = [{ state: 'frozen', xSplit: 4 }];
    // Process each product
    for (const product of products) {
      const variants = product.variants || [];
      const categoryName = product.category ? product.category.name : '';
      const subcategoryName = product.subcategory ? product.subcategory.name : '';
      const productSku = product.defaultSku || product.id;
      const productName = product.name || 'product';
      // Product images
      const productImages = (product.images || []).filter(img => !img.variantId);
      const productImagePaths = [];
      for (const [idx, img] of productImages.entries()) {
        const position = (img.position !== null && img.position !== undefined) ? img.position : (idx + 1);
        const ext = this.getExtensionFromUrl(img.url);
        const zipPath = this.getImageZipPath(productName, productSku, false, null, null, null, position, ext);
        productImagePaths.push(zipPath);
        imageQueue.push({ url: img.url, zipPath });
      }
      const productVideoUrls = getProductVideoUrlsList(product);
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
        imageUrls: productImagePaths.join('; '),
        videoUrls: productVideoUrls.join('; ')
      };
      worksheet.addRow(productRowData);
      // Variants
      if (variants.length > 0) {
        for (const variant of variants) {
          const variantSku = variant.sku || `var-${variant.id}`;
          const variantColor = variant.color || '';
          const variantSize = variant.size || '';
          const varImages = variantImagesMap[variant.id] || [];
          const varImagePaths = [];
          for (const [idx, img] of varImages.entries()) {
            const position = (img.position !== null && img.position !== undefined) ? img.position : (idx + 1);
            const ext = this.getExtensionFromUrl(img.url);
            const zipPath = this.getImageZipPath(productName, productSku, true, variantSku, variantColor, variantSize, position, ext);
            varImagePaths.push(zipPath);
            imageQueue.push({ url: img.url, zipPath });
          }
          const variantVideoUrl = getVariantVideoUrl(variant);
          const variantRowData = {
            rowType: 'Variant',
            productSku: product.defaultSku || '',
            productName: '',
            variantSku: variant.sku || '',
            size: variant.size || '',
            color: variant.color || '',
            price: variant.price !== null ? Number(variant.price) : '',
            stock: variant.stockQuantity !== null ? Number(variant.stockQuantity) : '',
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
            imageUrls: varImagePaths.join('; '),
            videoUrls: variantVideoUrl
          };
          worksheet.addRow(variantRowData);
        }
      }
      worksheet.addRow({}); // empty separator
    }
    // Generate Excel buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();
    archive.append(excelBuffer, { name: 'products.xls' });
    // Download images with concurrency limit
    const concurrencyLimit = 10;
    let active = 0;
    let index = 0;
    const next = () => {
      if (index >= imageQueue.length) return Promise.resolve();
      const item = imageQueue[index++];
      return this.addImageToZip(archive, item.url, item.zipPath)
        .then(() => {
          active--;
          return next();
        })
        .catch((err) => {
          active--;
          console.error(`Download failed for ${item.url}:`, err.message);
          return next();
        });
    };
    const initialPromises = [];
    const initialCount = Math.min(concurrencyLimit, imageQueue.length);
    for (let i = 0; i < initialCount; i++) {
      active++;
      initialPromises.push(next());
    }
    await Promise.all(initialPromises);
    archive.finalize();
    return new Promise((resolve, reject) => {
      const chunks = [];
      archiveStream.on('data', chunk => chunks.push(chunk));
      archiveStream.on('end', () => resolve(Buffer.concat(chunks)));
      archiveStream.on('error', reject);
    });
  }
  async exportProducts(filters = {}) {
    return this.generateExportZip(filters);
  }
}
module.exports = new ProductExportService();
