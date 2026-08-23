const { Product, ProductVariant, ProductImage, Category, sequelize } = require('../models');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid');
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});
class ProductImportService {
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
  sanitizeVariantFolderName(variantSku, color, size) {
    const parts = [];
    const sku = variantSku.replace(/[^a-zA-Z0-9-]/g, '');
    parts.push(sku);
    if (color && color.trim() !== '') {
      const col = color.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (col) parts.push(col);
    }
    if (size && size.trim() !== '') {
      const sz = size.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (sz) parts.push(sz);
    }
    return parts.join('-');
  }
  extractZip(zipPath, destDir) {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    for (const entry of entries) {
      const entryName = entry.entryName;
      if (entryName.includes('..') || path.isAbsolute(entryName)) {
        throw new Error(`Unsafe ZIP entry: ${entryName}`);
      }
    }
    zip.extractAllTo(destDir, true);
  }
  findExcelFile(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const found = this.findExcelFile(fullPath);
        if (found) return found;
      } else if (file.match(/\.(xls|xlsx)$/i)) {
        return fullPath;
      }
    }
    return null;
  }
  async getOrCreateCategory(name, parentId = null) {
    if (!name) return null;
    const where = { name: name.trim() };
    if (parentId) where.parentId = parentId;
    else where.parentId = null;
    let category = await Category.findOne({ where });
    if (!category) {
      category = await Category.create({
        name: name.trim(),
        parentId: parentId || null,
        order: 0,
        isActive: true,
        showInCategoryGrid: true,
        showInHero: false,
      });
    }
    return category;
  }
  async uploadToCloudinary(filePath, resourceType = 'image') {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(filePath, {
        resource_type: resourceType,
        folder: 'products_import',
      }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }
  async processImport(file, importType, userId) {
    const tempDir = path.join(__dirname, '../temp_import', uuidv4());
    await fs.ensureDir(tempDir);
    let excelPath = null;
    let extractedDir = null;
    const isZip = importType !== 'excel';
    try {
      if (isZip) {
        const zipPath = path.join(tempDir, 'upload.zip');
        await fs.move(file.path, zipPath, { overwrite: true });
        const extractDir = path.join(tempDir, 'extracted');
        await fs.ensureDir(extractDir);
        this.extractZip(zipPath, extractDir);
        extractedDir = extractDir;
        excelPath = this.findExcelFile(extractDir);
        if (!excelPath) {
          throw new Error('No Excel file (.xls or .xlsx) found in the ZIP');
        }
      } else {
        excelPath = file.path;
        extractedDir = tempDir;
      }
      // Parse Excel
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(excelPath);
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        throw new Error('Excel file has no worksheet');
      }
      const headerRow = worksheet.getRow(1);
      const headerMap = {};
      headerRow.eachCell((cell, colNumber) => {
        headerMap[colNumber] = String(cell.value).trim();
      });
      const colIndex = (name) => {
        for (const [idx, val] of Object.entries(headerMap)) {
          if (val === name) return parseInt(idx);
        }
        return -1;
      };
      const idxRowType = colIndex('Row Type');
      const idxProductSku = colIndex('Product SKU');
      const idxProductName = colIndex('Product Name');
      const idxVariantSku = colIndex('Variant SKU');
      const idxSize = colIndex('Size');
      const idxColor = colIndex('Color');
      const idxPrice = colIndex('Price');
      const idxStock = colIndex('Stock');
      const idxCategory = colIndex('Category');
      const idxSubcategory = colIndex('Subcategory');
      const idxShowFeatured = colIndex('Show In Featured Products (Yes/No)');
      const idxShowBestSellers = colIndex('Show In Best Sellers (Yes/No)');
      const idxShowNewArrivals = colIndex('Show In New Arrivals (Yes/No)');
      const idxShowPremium = colIndex('Show In Premium Products (Yes/No)');
      const idxWeight = colIndex('Weight');
      const idxLength = colIndex('Length');
      const idxBreadth = colIndex('Breadth');
      const idxHeight = colIndex('Height');
      const idxImageUrls = colIndex('Image URLs');
      const idxVideoUrls = colIndex('Video URLs');
      if (idxRowType === -1 || idxProductSku === -1) {
        throw new Error('Excel missing required columns: Row Type, Product SKU');
      }
      const includeImages = importType === 'excel_images' || importType === 'excel_images_videos';
      const includeVideos = importType === 'excel_videos' || importType === 'excel_images_videos';
      let importedProducts = 0, updatedProducts = 0;
      let importedVariants = 0, updatedVariants = 0;
      let importedImages = 0, importedVideos = 0;
      const warnings = [];
      // We'll store rows first to process sequentially with awaits
      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const getCell = (idx) => {
          const cell = row.getCell(idx);
          return cell.value !== undefined && cell.value !== null ? String(cell.value).trim() : '';
        };
        rows.push({
          rowNumber,
          rowType: getCell(idxRowType),
          productSku: getCell(idxProductSku),
          productName: getCell(idxProductName),
          variantSku: getCell(idxVariantSku),
          size: getCell(idxSize),
          color: getCell(idxColor),
          price: parseFloat(getCell(idxPrice)) || null,
          stock: parseInt(getCell(idxStock)) || 0,
          category: getCell(idxCategory),
          subcategory: getCell(idxSubcategory),
          showFeatured: getCell(idxShowFeatured).toLowerCase() === 'yes',
          showBestSellers: getCell(idxShowBestSellers).toLowerCase() === 'yes',
          showNewArrivals: getCell(idxShowNewArrivals).toLowerCase() === 'yes',
          showPremium: getCell(idxShowPremium).toLowerCase() === 'yes',
          weight: parseFloat(getCell(idxWeight)) || null,
          length: parseFloat(getCell(idxLength)) || null,
          breadth: parseFloat(getCell(idxBreadth)) || null,
          height: parseFloat(getCell(idxHeight)) || null,
        });
      });
      let currentProduct = null;
      let currentProductSku = null;
      let productName = '';
      for (const row of rows) {
        if (row.rowType === 'Product') {
          if (!row.productSku) {
            warnings.push(`Row ${row.rowNumber}: Product SKU missing, skipping`);
            continue;
          }
          const sku = row.productSku;
          const name = row.productName || sku;
          const price = row.price;
          const categoryName = row.category;
          const subcategoryName = row.subcategory;
          const weight = row.weight;
          const length = row.length;
          const breadth = row.breadth;
          const height = row.height;
          const showFeatured = row.showFeatured;
          const showBestSellers = row.showBestSellers;
          const showNewArrivals = row.showNewArrivals;
          const showPremium = row.showPremium;
          let categoryId = null, subcategoryId = null;
          if (categoryName) {
            const cat = await this.getOrCreateCategory(categoryName);
            categoryId = cat.id;
            if (subcategoryName) {
              const sub = await this.getOrCreateCategory(subcategoryName, cat.id);
              subcategoryId = sub.id;
            }
          }
          let product = await Product.findOne({ where: { defaultSku: sku } });
          if (product) {
            await product.update({
              name: name || product.name,
              basePrice: price !== null ? price : product.basePrice,
              categoryId: categoryId !== null ? categoryId : product.categoryId,
              subcategoryId: subcategoryId !== null ? subcategoryId : product.subcategoryId,
              weight: weight !== null ? weight : product.weight,
              length: length !== null ? length : product.length,
              breadth: breadth !== null ? breadth : product.breadth,
              height: height !== null ? height : product.height,
              showInFeaturedProducts: showFeatured,
              showInBestSellers: showBestSellers,
              showInNewArrivals: showNewArrivals,
              showInPremiumProducts: showPremium,
              isActive: true,
            });
            updatedProducts++;
          } else {
            product = await Product.create({
              defaultSku: sku,
              name: name,
              basePrice: price,
              categoryId: categoryId,
              subcategoryId: subcategoryId,
              weight: weight || 0.5,
              length: length || 30,
              breadth: breadth || 25,
              height: height || 5,
              showInFeaturedProducts: showFeatured,
              showInBestSellers: showBestSellers,
              showInNewArrivals: showNewArrivals,
              showInPremiumProducts: showPremium,
              isActive: true,
              userId: userId,
            });
            importedProducts++;
          }
          currentProduct = product;
          currentProductSku = sku;
          productName = product.name || sku;
          // Process product media if ZIP and include options
          if (isZip && (includeImages || includeVideos) && extractedDir) {
            const productFolder = this.sanitizeProductFolderName(productName, currentProductSku);
            const productDir = path.join(extractedDir, 'images', productFolder);
            // Product images
            if (includeImages) {
              const imgDir = path.join(productDir, 'product');
              if (fs.existsSync(imgDir)) {
                const files = fs.readdirSync(imgDir).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
                for (const file of files) {
                  const position = parseInt(file.split('.')[0]) || 0;
                  if (position > 0) {
                    const filePath = path.join(imgDir, file);
                    try {
                      const result = await this.uploadToCloudinary(filePath, 'image');
                      await ProductImage.create({
                        productId: product.id,
                        url: result.secure_url,
                        position: position,
                        variantId: null,
                      });
                      importedImages++;
                    } catch (err) {
                      warnings.push(`Failed to upload image ${file} for product ${sku}: ${err.message}`);
                    }
                  }
                }
              }
            }
            // Product videos
            if (includeVideos) {
              const videoDir = path.join(productDir, 'videos');
              if (fs.existsSync(videoDir)) {
                const files = fs.readdirSync(videoDir).filter(f => /\.(mp4|mov|webm|m4v)$/i.test(f));
                for (const file of files) {
                  const position = parseInt(file.split('.')[0]) || 0;
                  if (position > 0) {
                    const filePath = path.join(videoDir, file);
                    try {
                      const result = await this.uploadToCloudinary(filePath, 'video');
                      await product.update({
                        cloudinaryVideoPublicId: result.public_id,
                        videoUrl: result.secure_url,
                      });
                      importedVideos++;
                    } catch (err) {
                      warnings.push(`Failed to upload video ${file} for product ${sku}: ${err.message}`);
                    }
                  }
                }
              }
            }
          }
        } else if (row.rowType === 'Variant') {
          if (!currentProduct) {
            warnings.push(`Row ${row.rowNumber}: Variant without parent product, skipping`);
            continue;
          }
          const variantSku = row.variantSku;
          if (!variantSku) {
            warnings.push(`Row ${row.rowNumber}: Variant SKU missing, skipping`);
            continue;
          }
          const size = row.size || '';
          const color = row.color || '';
          const price = row.price || 0;
          const stock = row.stock || 0;
          let variant = await ProductVariant.findOne({
            where: { sku: variantSku, productId: currentProduct.id }
          });
          if (variant) {
            await variant.update({
              size: size || variant.size,
              color: color || variant.color,
              price: price,
              stockQuantity: stock,
            });
            updatedVariants++;
          } else {
            variant = await ProductVariant.create({
              productId: currentProduct.id,
              sku: variantSku,
              size: size,
              color: color,
              price: price,
              stockQuantity: stock,
            });
            importedVariants++;
          }
          // Variant media
          if (isZip && (includeImages || includeVideos) && extractedDir) {
            const productFolder = this.sanitizeProductFolderName(productName, currentProductSku);
            const variantFolder = this.sanitizeVariantFolderName(variantSku, color, size);
            const variantDir = path.join(extractedDir, 'images', productFolder, 'variants', variantFolder);
            if (fs.existsSync(variantDir)) {
              // Images
              if (includeImages) {
                const imgFiles = fs.readdirSync(variantDir).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
                for (const file of imgFiles) {
                  const position = parseInt(file.split('.')[0]) || 0;
                  if (position > 0) {
                    const filePath = path.join(variantDir, file);
                    try {
                      const result = await this.uploadToCloudinary(filePath, 'image');
                      await ProductImage.create({
                        productId: currentProduct.id,
                        variantId: variant.id,
                        url: result.secure_url,
                        position: position,
                      });
                      importedImages++;
                    } catch (err) {
                      warnings.push(`Failed to upload variant image ${file} for variant ${variantSku}: ${err.message}`);
                    }
                  }
                }
              }
              // Videos
              if (includeVideos) {
                const videoDir = path.join(variantDir, 'videos');
                if (fs.existsSync(videoDir)) {
                  const videoFiles = fs.readdirSync(videoDir).filter(f => /\.(mp4|mov|webm|m4v)$/i.test(f));
                  for (const file of videoFiles) {
                    const position = parseInt(file.split('.')[0]) || 0;
                    if (position > 0) {
                      const filePath = path.join(videoDir, file);
                      try {
                        const result = await this.uploadToCloudinary(filePath, 'video');
                        await variant.update({
                          cloudinaryVideoPublicId: result.public_id,
                          videoUrl: result.secure_url,
                        });
                        importedVideos++;
                      } catch (err) {
                        warnings.push(`Failed to upload variant video ${file} for variant ${variantSku}: ${err.message}`);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      // Cleanup
      await fs.remove(tempDir);
      return {
        importedProducts,
        updatedProducts,
        importedVariants,
        updatedVariants,
        importedImages,
        importedVideos,
        warnings,
      };
    } catch (error) {
      await fs.remove(tempDir);
      throw error;
    }
  }
}
module.exports = new ProductImportService();
