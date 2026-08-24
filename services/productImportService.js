const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');
const AdmZip = require('adm-zip');
const {
  Product,
  ProductVariant,
  ProductImage,
  Category,
  User,
  sequelize,
} = require('../models');
const { Op } = require('sequelize');
const { uploadFileToCloudinary } = require('../utils/cloudinary');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.avi', '.mkv']);
function normalizeSku(sku) {
  if (sku == null || sku === '') return '';
  return String(sku).trim();
}
function isImageFile(name) {
  return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
}
function isVideoFile(name) {
  return VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase());
}
/**
 * Extract position from filename if present.
 * Examples: 00.jpg → 0, Chandan-Maroon-1.jpg → 1, name_2_800x.jpg → 2
 * Returns null when no position found (caller uses sequential index).
 */
function parsePositionFromFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  // Prefer leading zero-padded index: 00, 01, 02
  let m = base.match(/^(\d+)$/);
  if (m) return parseInt(m[1], 10);
  // Common patterns: name-1, name_1, name 1, name(1), name_2_800x
  const patterns = [
    /[_\-\s](\d+)(?:[_\-\s]|$)/,
    /\((\d+)\)/,
    /(?:position|pos|p)[_\-\s]?(\d+)/i,
    /(\d+)$/,
  ];
  for (const re of patterns) {
    const match = base.match(re);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
  }
  return null;
}
function listFilesRecursive(dir) {
  const result = [];
  if (!dir || !fs.existsSync(dir)) return result;
  const walk = (d) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) result.push(full);
    }
  };
  walk(dir);
  return result;
}
function listImageFilesInDir(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => {
        try {
          return fs.statSync(path.join(dir, f)).isFile() && isImageFile(f);
        } catch {
          return false;
        }
      })
      .map((f) => path.join(dir, f))
      .sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true }));
  } catch {
    return [];
  }
}
function listVideoFilesInDir(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => {
        try {
          return fs.statSync(path.join(dir, f)).isFile() && isVideoFile(f);
        } catch {
          return false;
        }
      })
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}
/**
 * Build maps from extracted ZIP media tree:
 * images/
 *   {anything}-{PRODUCT_SKU}/
 *     product/          → product-level images
 *     variants/
 *       {VARIANT_SKU}/  → variant-level images
 * videos/ (optional, same layout)
 *
 * Matching is by SKU contained in folder name — no Excel URL validation.
 */
function buildMediaMaps(mediaRoot) {
  const productImages = {}; // productSku → [filePaths]
  const variantImages = {}; // variantSku → [filePaths]
  const productVideos = {}; // productSku → [filePaths]
  const variantVideos = {}; // variantSku → [filePaths]
  if (!mediaRoot || !fs.existsSync(mediaRoot)) {
    return { productImages, variantImages, productVideos, variantVideos };
  }
  // Find images/ and videos/ dirs (may be nested one level under zip root)
  const findNamedDir = (root, name) => {
    const direct = path.join(root, name);
    if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) return direct;
    try {
      for (const e of fs.readdirSync(root, { withFileTypes: true })) {
        if (e.isDirectory()) {
          const nested = path.join(root, e.name, name);
          if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) return nested;
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  };
  const imagesRoot = findNamedDir(mediaRoot, 'images');
  const videosRoot = findNamedDir(mediaRoot, 'videos');
  const processSkuFolders = (root, targetProductMap, targetVariantMap, listFn) => {
    if (!root) return;
    let productFolders;
    try {
      productFolders = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory());
    } catch {
      return;
    }
    for (const pf of productFolders) {
      const productFolderPath = path.join(root, pf.name);
      // Folder name often ends with -SKU (e.g. banarasi-pure-silk-saree-BAN-SILK-002)
      // We resolve SKU later by matching known product SKUs; also try last segment after last hyphen group.
      const productDir = path.join(productFolderPath, 'product');
      const variantsDir = path.join(productFolderPath, 'variants');
      // Store under folder name key as well so we can match by endsWith(sku)
      const folderKey = pf.name;
      const pFiles = listFn(productDir);
      if (pFiles.length) {
        if (!targetProductMap[folderKey]) targetProductMap[folderKey] = [];
        targetProductMap[folderKey].push(...pFiles);
      }
      if (fs.existsSync(variantsDir) && fs.statSync(variantsDir).isDirectory()) {
        let variantFolders;
        try {
          variantFolders = fs.readdirSync(variantsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
        } catch {
          variantFolders = [];
        }
        for (const vf of variantFolders) {
          const vSku = normalizeSku(vf.name);
          if (!vSku) continue;
          const vFiles = listFn(path.join(variantsDir, vf.name));
          if (vFiles.length) {
            if (!targetVariantMap[vSku]) targetVariantMap[vSku] = [];
            targetVariantMap[vSku].push(...vFiles);
          }
        }
      }
    }
  };
  processSkuFolders(imagesRoot, productImages, variantImages, listImageFilesInDir);
  processSkuFolders(videosRoot, productVideos, variantVideos, listVideoFilesInDir);
  return { productImages, variantImages, productVideos, variantVideos };
}
function findProductImageFiles(productImagesMap, productSku) {
  const sku = normalizeSku(productSku);
  if (!sku) return [];
  // Exact folder key or folder name ending with -SKU / SKU
  if (productImagesMap[sku]) return productImagesMap[sku];
  for (const key of Object.keys(productImagesMap)) {
    if (key === sku || key.endsWith('-' + sku) || key.endsWith(sku)) {
      return productImagesMap[key];
    }
  }
  return [];
}
async function resolveCategoryByName(name, transaction) {
  if (!name || !String(name).trim()) return null;
  const trimmed = String(name).trim();
  let cat = await Category.findOne({
    where: { name: { [Op.iLike]: trimmed }, parentId: null },
    transaction,
  });
  if (cat) return cat;
  cat = await Category.findOne({
    where: { name: { [Op.iLike]: trimmed } },
    transaction,
  });
  if (cat) return cat;
  // Create top-level category
  const permalink = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  cat = await Category.create(
    {
      name: trimmed,
      order: 0,
      isActive: true,
      showInCategoryGrid: true,
      showInHero: false,
      permalink: permalink || `cat-${Date.now()}`,
    },
    { transaction }
  );
  return cat;
}
async function resolveSubcategoryByName(name, parentCategoryId, transaction) {
  if (!name || !String(name).trim() || !parentCategoryId) return null;
  const trimmed = String(name).trim();
  let sub = await Category.findOne({
    where: {
      name: { [Op.iLike]: trimmed },
      parentId: parentCategoryId,
    },
    transaction,
  });
  if (sub) return sub;
  const permalink = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  sub = await Category.create(
    {
      name: trimmed,
      parentId: parentCategoryId,
      order: 0,
      isActive: true,
      showInCategoryGrid: true,
      showInHero: false,
      permalink: `${permalink || 'sub'}-${parentCategoryId}-${Date.now()}`,
    },
    { transaction }
  );
  return sub;
}
async function uploadImageFile(filePath, productId, warnings, skuLabel) {
  try {
    const uploaded = await uploadFileToCloudinary(filePath, {
      resource_type: 'image',
      folder: `products/${productId}`,
    });
    return uploaded.url;
  } catch (err) {
    // Local fallback so import still succeeds
    const uploadsDir = path.join(__dirname, '../uploads/products', String(productId));
    fs.mkdirSync(uploadsDir, { recursive: true });
    const destName = `${Date.now()}-${path.basename(filePath).replace(/\s+/g, '_')}`;
    const dest = path.join(uploadsDir, destName);
    fs.copyFileSync(filePath, dest);
    warnings.push(
      `SKU ${skuLabel}: Cloudinary upload failed for ${path.basename(filePath)}, saved locally (${err.message})`
    );
    return `/uploads/products/${productId}/${destName}`;
  }
}
async function uploadVideoFile(filePath, productId, warnings, skuLabel) {
  try {
    const uploaded = await uploadFileToCloudinary(filePath, {
      resource_type: 'video',
      folder: `products/${productId}/videos`,
    });
    return { url: uploaded.url, publicId: uploaded.publicId };
  } catch (err) {
    warnings.push(
      `SKU ${skuLabel}: video upload failed for ${path.basename(filePath)} – ${err.message}`
    );
    return null;
  }
}
/**
 * Replace all images for a product (variantId null) or a specific variant.
 * No validation against Excel Image URLs — only folder contents matter.
 * Position: from filename when present, otherwise sequential count-based index.
 */
async function replaceImages({ productId, variantId, imageFiles, transaction, warnings, skuLabel }) {
  if (!imageFiles || imageFiles.length === 0) return 0;
  const where = { productId };
  if (variantId) where.variantId = variantId;
  else where.variantId = null;
  await ProductImage.destroy({ where, transaction });
  let imported = 0;
  let nextFallback = 0;
  const usedPositions = new Set();
  for (let i = 0; i < imageFiles.length; i++) {
    const filePath = imageFiles[i];
    try {
      let position = parsePositionFromFilename(path.basename(filePath));
      if (position == null || usedPositions.has(position)) {
        while (usedPositions.has(nextFallback)) nextFallback += 1;
        position = nextFallback;
        nextFallback += 1;
      }
      usedPositions.add(position);
      const url = await uploadImageFile(filePath, productId, warnings, skuLabel);
      await ProductImage.create(
        {
          id: uuidv4(),
          productId,
          variantId: variantId || null,
          url,
          position,
        },
        { transaction }
      );
      imported += 1;
    } catch (e) {
      warnings.push(`SKU ${skuLabel}: failed image ${path.basename(filePath)} – ${e.message}`);
    }
  }
  return imported;
}
class ProductImportService {
  async importProducts(file, importType = 'excel', userId = null) {
    const warnings = [];
    let importedProducts = 0;
    let updatedProducts = 0;
    let importedVariants = 0;
    let updatedVariants = 0;
    let importedImages = 0;
    let importedVideos = 0;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'product-import-'));
    let excelPath = null;
    let mediaRoot = tempDir;
    try {
      const originalName = (file.originalname || '').toLowerCase();
      const isZip =
        importType !== 'excel' ||
        originalName.endsWith('.zip') ||
        (file.mimetype && (file.mimetype.includes('zip') || file.mimetype.includes('compressed')));
      if (isZip) {
        const zip = new AdmZip(file.path || file.buffer);
        zip.extractAllTo(tempDir, true);
        const findExcel = (dir) => {
          let entries;
          try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
          } catch {
            return null;
          }
          // Prefer .xlsx over .xls
          let xlsx = null;
          let xls = null;
          for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
              const found = findExcel(full);
              if (found) {
                if (found.endsWith('.xlsx')) return found;
                if (!xlsx && !xls) xls = found;
              }
            } else if (/\.xlsx$/i.test(e.name)) {
              xlsx = full;
            } else if (/\.xls$/i.test(e.name) && !/\.xlsx$/i.test(e.name)) {
              xls = full;
            }
          }
          return xlsx || xls;
        };
        excelPath = findExcel(tempDir);
        if (!excelPath) {
          const err = new Error('No Excel file (.xls/.xlsx) found inside the ZIP');
          err.status = 400;
          throw err;
        }
        mediaRoot = tempDir;
      } else {
        excelPath = file.path;
        if (!excelPath && file.buffer) {
          excelPath = path.join(tempDir, 'products.xlsx');
          fs.writeFileSync(excelPath, file.buffer);
        }
      }
      const workbook = XLSX.readFile(excelPath);
      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
      if (!rows || rows.length === 0) {
        const err = new Error('Excel file has no data rows');
        err.status = 400;
        throw err;
      }
      // Detect format: sample uses "Row Type" + "Product SKU"
      const firstKeys = Object.keys(rows[0] || {}).map((k) => k.toLowerCase());
      const isRowTypeFormat =
        firstKeys.includes('row type') ||
        firstKeys.some((k) => k === 'rowtype') ||
        rows.some((r) => {
          const rt = r['Row Type'] ?? r['row type'] ?? r.RowType;
          return rt && String(rt).toLowerCase() === 'product';
        });
      const mediaMaps =
        importType === 'excel_images' ||
        importType === 'excel_videos' ||
        importType === 'excel_images_videos'
          ? buildMediaMaps(mediaRoot)
          : {
              productImages: {},
              variantImages: {},
              productVideos: {},
              variantVideos: {},
            };
      // Resolve a userId for new products
      let resolvedUserId = userId;
      if (!resolvedUserId) {
        const anyUser = await User.findOne({ order: [['createdAt', 'ASC']] });
        if (anyUser) resolvedUserId = anyUser.id;
      }
      if (!resolvedUserId) {
        const err = new Error('No user available to attach products. Please authenticate.');
        err.status = 400;
        throw err;
      }
      const yes = (v) => ['yes', 'true', '1', 'y'].includes(String(v || '').trim().toLowerCase());
      const transaction = await sequelize.transaction();
      try {
        // ---------- ROW-TYPE FORMAT (sample ZIP) ----------
        if (isRowTypeFormat) {
          // Group: Product rows then following Variant rows until next Product
          let currentProduct = null;
          let currentProductSku = '';
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const get = (...keys) => {
              for (const k of keys) {
                if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
                  return row[k];
                }
              }
              // case-insensitive fallback
              const lowerMap = {};
              Object.keys(row).forEach((k) => {
                lowerMap[k.toLowerCase()] = row[k];
              });
              for (const k of keys) {
                const v = lowerMap[k.toLowerCase()];
                if (v !== undefined && v !== null && String(v).trim() !== '') return v;
              }
              return null;
            };
            const rowType = String(get('Row Type', 'rowType') || '').trim().toLowerCase();
            const productSku = normalizeSku(get('Product SKU', 'ProductSKU', 'product sku'));
            if (rowType === 'product') {
              if (!productSku) {
                warnings.push(`Row ${i + 2}: Product row missing Product SKU – skipped`);
                currentProduct = null;
                currentProductSku = '';
                continue;
              }
              const name = get('Product Name', 'Name', 'product name') || productSku;
              const price = parseFloat(get('Price', 'Base Price', 'basePrice')) || 0;
              const stock = parseInt(get('Stock', 'Stock Quantity', 'stockQuantity') || '0', 10) || 0;
              const categoryName = get('Category', 'Category Name');
              const subcategoryName = get('Subcategory', 'Subcategory Name');
              const weight = parseFloat(get('Weight', 'Weight')) || 0.5;
              const length = parseFloat(get('Length', 'length')) || 30;
              const breadth = parseFloat(get('Breadth', 'breadth')) || 25;
              const height = parseFloat(get('Height', 'height')) || 5;
              let categoryId = null;
              let subcategoryId = null;
              if (categoryName) {
                const cat = await resolveCategoryByName(categoryName, transaction);
                if (cat) {
                  categoryId = cat.id;
                  if (subcategoryName) {
                    const sub = await resolveSubcategoryByName(subcategoryName, cat.id, transaction);
                    if (sub) subcategoryId = sub.id;
                  }
                }
              }
              // UPSERT by defaultSku (Product SKU) — prevents duplicates
              let product = await Product.findOne({
                where: { defaultSku: productSku },
                transaction,
              });
              const payload = {
                name: String(name),
                description: product ? product.description : '',
                basePrice: price,
                stockQuantity: stock,
                defaultSku: productSku,
                categoryId,
                subcategoryId,
                status: 'published',
                showInFeaturedProducts: yes(get('Show In Featured Products (Yes/No)', 'Show In Featured Products')),
                showInBestSellers: yes(get('Show In Best Sellers (Yes/No)', 'Show In Best Sellers')),
                showInNewArrivals: yes(get('Show In New Arrivals (Yes/No)', 'Show In New Arrivals')),
                showInPremiumProducts: yes(get('Show In Premium Products (Yes/No)', 'Show In Premium Products')),
                weight,
                length,
                breadth,
                height,
                isActive: true,
              };
              if (product) {
                await product.update(payload, { transaction });
                updatedProducts += 1;
              } else {
                product = await Product.create(
                  { ...payload, userId: resolvedUserId },
                  { transaction }
                );
                importedProducts += 1;
              }
              currentProduct = product;
              currentProductSku = productSku;
              // Images from folder only (ignore Excel Image URLs / Video URLs completely)
              if (
                importType === 'excel_images' ||
                importType === 'excel_images_videos'
              ) {
                const pImgs = findProductImageFiles(mediaMaps.productImages, productSku);
                importedImages += await replaceImages({
                  productId: product.id,
                  variantId: null,
                  imageFiles: pImgs,
                  transaction,
                  warnings,
                  skuLabel: productSku,
                });
              }
              if (
                importType === 'excel_videos' ||
                importType === 'excel_images_videos'
              ) {
                const pVids = findProductImageFiles(mediaMaps.productVideos, productSku);
                if (pVids.length) {
                  const vid = await uploadVideoFile(pVids[0], product.id, warnings, productSku);
                  if (vid) {
                    await product.update(
                      {
                        videoUrl: vid.url,
                        cloudinaryVideoPublicId: vid.publicId,
                      },
                      { transaction }
                    );
                    importedVideos += 1;
                  }
                }
              }
            } else if (rowType === 'variant') {
              if (!currentProduct) {
                // Try attach by Product SKU on the row
                if (productSku) {
                  currentProduct = await Product.findOne({
                    where: { defaultSku: productSku },
                    transaction,
                  });
                  currentProductSku = productSku;
                }
              }
              if (!currentProduct) {
                warnings.push(`Row ${i + 2}: Variant without parent product – skipped`);
                continue;
              }
              const variantSku = normalizeSku(get('Variant SKU', 'VariantSKU', 'variant sku'));
              if (!variantSku) {
                warnings.push(`Row ${i + 2}: Variant missing Variant SKU – skipped`);
                continue;
              }
              const size = get('Size', 'size') || null;
              const color = get('Color', 'color') || null;
              const vPrice =
                get('Price', 'price') != null && String(get('Price', 'price')).trim() !== ''
                  ? parseFloat(get('Price', 'price'))
                  : Number(currentProduct.basePrice) || 0;
              const vStock = parseInt(get('Stock', 'stock', 'Stock Quantity') || '0', 10) || 0;
              let variant = await ProductVariant.findOne({
                where: {
                  productId: currentProduct.id,
                  sku: variantSku,
                },
                transaction,
              });
              const vPayload = {
                productId: currentProduct.id,
                sku: variantSku,
                size: size ? String(size) : null,
                color: color ? String(color) : null,
                price: vPrice,
                stockQuantity: vStock,
              };
              if (variant) {
                await variant.update(vPayload, { transaction });
                updatedVariants += 1;
              } else {
                variant = await ProductVariant.create(vPayload, { transaction });
                importedVariants += 1;
              }
              // Variant images from folder only — no Excel URL validation
              if (
                importType === 'excel_images' ||
                importType === 'excel_images_videos'
              ) {
                const vImgs = mediaMaps.variantImages[variantSku] || [];
                importedImages += await replaceImages({
                  productId: currentProduct.id,
                  variantId: variant.id,
                  imageFiles: vImgs,
                  transaction,
                  warnings,
                  skuLabel: variantSku,
                });
              }
              if (
                importType === 'excel_videos' ||
                importType === 'excel_images_videos'
              ) {
                const vVids = mediaMaps.variantVideos[variantSku] || [];
                if (vVids.length) {
                  const vid = await uploadVideoFile(
                    vVids[0],
                    currentProduct.id,
                    warnings,
                    variantSku
                  );
                  if (vid) {
                    await variant.update(
                      {
                        videoUrl: vid.url,
                        cloudinaryVideoPublicId: vid.publicId,
                      },
                      { transaction }
                    );
                    importedVideos += 1;
                  }
                }
              }
            } else {
              // Unknown row type – skip quietly
            }
          }
        } else {
          // ---------- LEGACY / EXPORT FORMAT (one product per row) ----------
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const get = (...keys) => {
              for (const k of keys) {
                if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
                  return row[k];
                }
              }
              return null;
            };
            const name = get('Name', 'name', 'Product Name');
            const defaultSku = normalizeSku(get('Default SKU', 'defaultSku', 'SKU', 'sku', 'Product SKU'));
            if (!name && !defaultSku) {
              warnings.push(`Row ${i + 2}: skipped (no Name or SKU)`);
              continue;
            }
            let product = null;
            if (defaultSku) {
              product = await Product.findOne({ where: { defaultSku }, transaction });
            }
            const basePrice = parseFloat(get('Base Price', 'basePrice', 'Price', 'price')) || 0;
            const stockQuantity = parseInt(get('Stock Quantity', 'stockQuantity', 'Stock') || '0', 10) || 0;
            const payload = {
              name: name || (product ? product.name : `Product ${defaultSku || i}`),
              description: get('Description', 'description') || (product ? product.description : ''),
              basePrice,
              stockQuantity,
              defaultSku: defaultSku || (product ? product.defaultSku : null),
              status: (get('Status', 'status') || 'draft').toString().toLowerCase() === 'published' ? 'published' : 'draft',
              isActive: true,
              weight: parseFloat(get('Weight', 'weight')) || 0.5,
              length: parseFloat(get('Length', 'length')) || 30,
              breadth: parseFloat(get('Breadth', 'breadth')) || 25,
              height: parseFloat(get('Height', 'height')) || 5,
            };
            if (product) {
              await product.update(payload, { transaction });
              updatedProducts += 1;
            } else {
              product = await Product.create(
                { ...payload, userId: resolvedUserId },
                { transaction }
              );
              importedProducts += 1;
            }
            // Images from folders only when import includes images
            if (
              (importType === 'excel_images' || importType === 'excel_images_videos') &&
              defaultSku
            ) {
              const pImgs = findProductImageFiles(mediaMaps.productImages, defaultSku);
              importedImages += await replaceImages({
                productId: product.id,
                variantId: null,
                imageFiles: pImgs,
                transaction,
                warnings,
                skuLabel: defaultSku,
              });
            }
          }
        }
        await transaction.commit();
      } catch (txErr) {
        await transaction.rollback();
        throw txErr;
      }
      return {
        success: true,
        importedProducts,
        updatedProducts,
        importedVariants,
        updatedVariants,
        importedImages,
        importedVideos,
        warnings,
      };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
      if (file && file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (_) {}
      }
    }
  }
}
module.exports = new ProductImportService();
