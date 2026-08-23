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
    let name = productName.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const sku = productSku.replace(/[^a-zA-Z0-9-]/g, '');
    let folder = `${name}-${sku}`;
    if (!name) folder = sku;
    folder = folder.replace(/[^a-zA-Z0-9-]/g, '');
    folder = folder.replace(/-+/g, '-').replace(/^-|-$/g, '');
    return folder;
  }
  // Helper: sanitize variant folder name: sku-color-size
  sanitizeVariantFolderName(variantSku, color, size) {
    const parts = [];
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
  // Generate local path for image in ZIP
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
  // Generate local path for video in ZIP
  getVideoZipPath(productName, productSku, isVariant, variantSku, variantColor, variantSize, position, extension) {
    const productFolder = this.sanitizeProductFolderName(productName, productSku);
    const pos = String(position).padStart(2, '0');
    const filename = `${pos}.${extension}`;
    if (isVariant) {
      const variantFolder = this.sanitizeVariantFolderName(variantSku, variantColor, variantSize);
      return `images/${productFolder}/variants/${variantFolder}/videos/${filename}`;
    } else {
      return `images/${productFolder}/videos/${filename}`;
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
  // Get video file extension from URL or content-type
  getVideoExtensionFromUrl(url, contentType) {
    if (!url) return 'mp4';
    let ext = path.extname(url).toLowerCase().replace(/^\./, '');
    if (ext && ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'].includes(ext)) {
      return ext;
    }
    if (contentType) {
      const mimeToExt = {
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'video/webm': 'webm',
        'video/x-m4v': 'm4v',
        'video/avi': 'avi',
        'video/x-matroska': 'mkv',
      };
      const mime = contentType.split(';')[0].trim();
      if (mimeToExt[mime]) return mimeToExt[mime];
    }
    return 'mp4';
  }
  // Download a file and add to ZIP archive
  async addFileToZip(archive, fileUrl, zipPath, isVideo = false) {
    try {
      const timeout = isVideo ? 120000 : 30000;
      const response = await axios({
        method: 'get',
        url: fileUrl,
        responseType: 'stream',
        timeout: timeout,
      });
      archive.append(response.data, { name: zipPath });
    } catch (error) {
      console.error(`Failed to download ${isVideo ? 'video' : 'image'} ${fileUrl}: ${error.message}`);
    }
  }
  // Get Cloudinary video URL from public ID
  getCloudinaryVideoUrl(publicId) {
    if (!publicId) return null;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name';
    return `https://res.cloudinary.com/${cloudName}/video/upload/${publicId}`;
  }
  // Get product video URLs as array
  getProductVideoUrlsList(product) {
    const urls = [];
    if (product.videoUrl) urls.push(product.videoUrl);
    if (product.cloudinaryVideoPublicId) {
      const url = this.getCloudinaryVideoUrl(product.cloudinaryVideoPublicId);
      if (url) urls.push(url);
    }
    return urls;
  }
  // Get variant video URL (single)
  getVariantVideoUrl(variant) {
    if (variant.cloudinaryVideoPublicId) {
      const url = this.getCloudinaryVideoUrl(variant.cloudinaryVideoPublicId);
      if (url) return url;
    }
    if (variant.videoUrl) {
      return variant.videoUrl;
    }
    return '';
  }
  // Main export method with options
  async generateExportZip(filters = {}, options = {}) {
    const { includeImages = true, includeVideos = true, includeExcel = true } = options;
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
    if (variantIds.length > 0 && includeImages) {
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
    // Create archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    const archiveStream = new PassThrough();
    archive.pipe(archiveStream);
    const fileQueue = [];
    // Prepare Excel workbook if needed
    let excelBuffer = null;
    if (includeExcel) {
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
      // Process each product for Excel data (always need product data for rows, even if images/videos not included)
      for (const product of products) {
        const variants = product.variants || [];
        const categoryName = product.category ? product.category.name : '';
        const subcategoryName = product.subcategory ? product.subcategory.name : '';
        const productSku = product.defaultSku || product.id;
        const productName = product.name || 'product';
        // For Excel, we need image paths if includeImages, else empty
        let productImagePaths = [];
        if (includeImages) {
          const productImages = (product.images || []).filter(img => !img.variantId);
          for (const [idx, img] of productImages.entries()) {
            const position = (img.position !== null && img.position !== undefined) ? img.position : (idx + 1);
            const ext = this.getExtensionFromUrl(img.url);
            const zipPath = this.getImageZipPath(productName, productSku, false, null, null, null, position, ext);
            productImagePaths.push(zipPath);
            fileQueue.push({ url: img.url, zipPath, isVideo: false });
          }
        }
        // Product videos for Excel (always include the URLs, but we only download if includeVideos)
        const productVideoUrls = this.getProductVideoUrlsList(product);
        if (includeVideos) {
          for (const [idx, videoUrl] of productVideoUrls.entries()) {
            if (videoUrl) {
              const position = idx + 1;
              const ext = this.getVideoExtensionFromUrl(videoUrl);
              const zipPath = this.getVideoZipPath(productName, productSku, false, null, null, null, position, ext);
              fileQueue.push({ url: videoUrl, zipPath, isVideo: true });
            }
          }
        }
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
            let varImagePaths = [];
            if (includeImages) {
              const varImages = variantImagesMap[variant.id] || [];
              for (const [idx, img] of varImages.entries()) {
                const position = (img.position !== null && img.position !== undefined) ? img.position : (idx + 1);
                const ext = this.getExtensionFromUrl(img.url);
                const zipPath = this.getImageZipPath(productName, productSku, true, variantSku, variantColor, variantSize, position, ext);
                varImagePaths.push(zipPath);
                fileQueue.push({ url: img.url, zipPath, isVideo: false });
              }
            }
            // Variant videos
            const variantVideoUrl = this.getVariantVideoUrl(variant);
            if (includeVideos && variantVideoUrl) {
              const position = 1;
              const ext = this.getVideoExtensionFromUrl(variantVideoUrl);
              const zipPath = this.getVideoZipPath(productName, productSku, true, variantSku, variantColor, variantSize, position, ext);
              fileQueue.push({ url: variantVideoUrl, zipPath, isVideo: true });
            }
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
        worksheet.addRow({});
      }
      excelBuffer = await workbook.xlsx.writeBuffer();
    }
    // Now add excel file if included
    if (includeExcel && excelBuffer) {
      archive.append(excelBuffer, { name: 'products.xls' });
    }
    // Download files with concurrency limit (only if there are files to download)
    if (fileQueue.length > 0) {
      const concurrencyLimit = 5;
      let active = 0;
      let index = 0;
      const next = () => {
        if (index >= fileQueue.length) return Promise.resolve();
        const item = fileQueue[index++];
        return this.addFileToZip(archive, item.url, item.zipPath, item.isVideo)
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
      const initialCount = Math.min(concurrencyLimit, fileQueue.length);
      for (let i = 0; i < initialCount; i++) {
        active++;
        initialPromises.push(next());
      }
      await Promise.all(initialPromises);
    }
    archive.finalize();
    return new Promise((resolve, reject) => {
      const chunks = [];
      archiveStream.on('data', chunk => chunks.push(chunk));
      archiveStream.on('end', () => resolve(Buffer.concat(chunks)));
      archiveStream.on('error', reject);
    });
  }
  async exportProducts(filters = {}) {
    // Default behavior: include everything
    return this.generateExportZip(filters, { includeImages: true, includeVideos: true, includeExcel: true });
  }
}
module.exports = new ProductExportService();
