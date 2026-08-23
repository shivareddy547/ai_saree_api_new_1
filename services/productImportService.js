const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');
const AdmZip = require('adm-zip');
const { Op } = require('sequelize');
const {
  Product,
  ProductImage,
  ProductVariant,
  Category,
  sequelize,
} = require('../models');
const { uploadFileToCloudinary } = require('../utils/cloudinary');

function normalizeKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getCell(row, possibleKeys) {
  const map = {};
  for (const k of Object.keys(row || {})) {
    map[normalizeKey(k)] = row[k];
  }
  for (const key of possibleKeys) {
    const val = map[normalizeKey(key)];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return val;
    }
  }
  return null;
}

function parseYesNo(val) {
  if (val === true || val === 1) return true;
  if (val === false || val === 0) return false;
  const s = String(val || '').trim().toLowerCase();
  return s === 'yes' || s === 'true' || s === '1';
}

function parseNumber(val, fallback = null) {
  if (val === undefined || val === null || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function splitMediaUrls(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Build index of all image files under extractDir for fast lookup */
function buildMediaIndex(rootDir) {
  const byRel = new Map(); // normalized relative path -> absolute path
  const byBasename = new Map(); // basename -> [absolute paths]
  const imageExt = /\.(jpe?g|png|webp|gif|bmp)$/i;

  function walk(dir, relBase = '') {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        walk(full, rel);
      } else if (ent.isFile() && imageExt.test(ent.name)) {
        const norm = rel.replace(/\\/g, '/').toLowerCase();
        byRel.set(norm, full);
        // also without leading "images/"
        if (norm.startsWith('images/')) {
          byRel.set(norm.slice('images/'.length), full);
        }
        const base = ent.name.toLowerCase();
        if (!byBasename.has(base)) byBasename.set(base, []);
        byBasename.get(base).push(full);
      }
    }
  }

  walk(rootDir);
  return { byRel, byBasename };
}

function resolveMediaPath(mediaIndex, relativePath) {
  if (!relativePath) return null;
  let rel = String(relativePath).trim().replace(/\\/g, '/');
  if (rel.startsWith('/')) rel = rel.slice(1);
  if (rel.startsWith('./')) rel = rel.slice(2);
  const norm = rel.toLowerCase();

  if (mediaIndex.byRel.has(norm)) return mediaIndex.byRel.get(norm);
  if (mediaIndex.byRel.has('images/' + norm)) {
    return mediaIndex.byRel.get('images/' + norm);
  }

  // Match by last 2–3 path segments
  const parts = norm.split('/').filter(Boolean);
  for (let n = Math.min(3, parts.length); n >= 2; n--) {
    const suffix = parts.slice(-n).join('/');
    for (const [key, full] of mediaIndex.byRel.entries()) {
      if (key.endsWith(suffix) || key.endsWith('/' + suffix)) return full;
    }
  }

  // Basename fallback (only if unique)
  const base = parts[parts.length - 1];
  const candidates = mediaIndex.byBasename.get(base) || [];
  if (candidates.length === 1) return candidates[0];

  return null;
}

async function ensureCategory(categoryName, subcategoryName, transaction) {
  let categoryId = null;
  let subcategoryId = null;

  if (categoryName) {
    let cat = await Category.findOne({
      where: { name: { [Op.iLike]: String(categoryName).trim() } },
      transaction,
    });
    if (!cat) {
      cat = await Category.create(
        {
          name: String(categoryName).trim(),
          order: 0,
          isActive: true,
          showInCategoryGrid: true,
          showInHero: false,
        },
        { transaction }
      );
    }
    categoryId = cat.id;

    if (subcategoryName) {
      let sub = await Category.findOne({
        where: {
          name: { [Op.iLike]: String(subcategoryName).trim() },
          parentId: categoryId,
        },
        transaction,
      });
      if (!sub) {
        sub = await Category.findOne({
          where: { name: { [Op.iLike]: String(subcategoryName).trim() } },
          transaction,
        });
      }
      if (!sub) {
        sub = await Category.create(
          {
            name: String(subcategoryName).trim(),
            parentId: categoryId,
            order: 0,
            isActive: true,
            showInCategoryGrid: false,
            showInHero: false,
          },
          { transaction }
        );
      }
      subcategoryId = sub.id;
    }
  }

  return { categoryId, subcategoryId };
}

async function uploadOneImage(localPath, folder, warnings) {
  try {
    const result = await uploadFileToCloudinary(localPath, {
      resource_type: 'image',
      folder,
    });
    return result;
  } catch (err) {
    const msg = `Cloudinary upload failed for ${path.basename(localPath)}: ${err.message}`;
    warnings.push(msg);
    console.error(msg, err);
    return null;
  }
}

class ProductImportService {
  async importFromFile({ filePath, originalName, importType = 'excel', userId }) {
    const warnings = [];
    let extractDir = null;
    let excelPath = filePath;
    let mediaIndex = null;

    const isZip =
      (originalName && originalName.toLowerCase().endsWith('.zip')) ||
      (filePath && filePath.toLowerCase().endsWith('.zip'));

    try {
      if (isZip) {
        extractDir = path.join(os.tmpdir(), `product-import-${uuidv4()}`);
        fs.mkdirSync(extractDir, { recursive: true });

        const zip = new AdmZip(filePath);
        zip.extractAllTo(extractDir, true);

        excelPath = this.findExcelFile(extractDir);
        if (!excelPath) {
          throw new Error(
            'ZIP must contain products.xls or products.xlsx'
          );
        }

        // Always index images if present in ZIP
        mediaIndex = buildMediaIndex(extractDir);
        const imageCount = mediaIndex.byRel.size;
        console.log(`[import] Extracted ZIP. Excel: ${excelPath}, image files indexed: ${imageCount}`);
        if (imageCount === 0) {
          warnings.push(
            'ZIP extracted but no image files (.jpg/.png/.webp) were found under images/'
          );
        }
      } else if (
        importType === 'excel_images' ||
        importType === 'excel_images_videos'
      ) {
        warnings.push(
          'Images requested but file is not a ZIP. Only Excel data imported.'
        );
      }

      // Process images whenever we have media in the ZIP
      // (do not rely only on importType — UI may send "excel" with a ZIP)
      const processImages = !!mediaIndex && mediaIndex.byRel.size > 0;

      if (isZip && !processImages) {
        warnings.push(
          'No processable images in ZIP. Check that paths in Image URLs match files inside the ZIP.'
        );
      }

      const workbook = XLSX.readFile(excelPath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!rows.length) {
        throw new Error('Excel file has no data rows');
      }

      // Log headers for debugging
      console.log('[import] Excel headers:', Object.keys(rows[0] || {}));

      const groups = new Map();
      for (const row of rows) {
        const rowType = String(
          getCell(row, ['Row Type', 'rowtype', 'type']) || ''
        )
          .trim()
          .toLowerCase();
        const productSku = String(
          getCell(row, ['Product SKU', 'ProductSKU', 'SKU', 'defaultSku']) ||
            ''
        ).trim();
        if (!productSku) continue;

        if (!groups.has(productSku)) {
          groups.set(productSku, { productRow: null, variantRows: [] });
        }
        const g = groups.get(productSku);

        if (rowType === 'product') {
          g.productRow = row;
        } else if (rowType === 'variant') {
          g.variantRows.push(row);
        } else if (!g.productRow && getCell(row, ['Product Name', 'name'])) {
          g.productRow = row;
        } else {
          g.variantRows.push(row);
        }
      }

      let importedProducts = 0;
      let updatedProducts = 0;
      let importedVariants = 0;
      let updatedVariants = 0;
      let importedImages = 0;
      let importedVideos = 0;

      for (const [productSku, group] of groups.entries()) {
        const transaction = await sequelize.transaction();
        try {
          const prow = group.productRow || group.variantRows[0];
          if (!prow) {
            await transaction.rollback();
            continue;
          }

          const name =
            String(getCell(prow, ['Product Name', 'name']) || productSku).trim() ||
            productSku;
          const basePrice = parseNumber(
            getCell(prow, ['Price', 'basePrice', 'Base Price']),
            0
          );
          const categoryName = getCell(prow, ['Category']);
          const subcategoryName = getCell(prow, ['Subcategory']);
          const { categoryId, subcategoryId } = await ensureCategory(
            categoryName,
            subcategoryName,
            transaction
          );

          const productPayload = {
            name,
            description: getCell(prow, ['Description']) || null,
            basePrice,
            defaultSku: productSku,
            categoryId,
            subcategoryId,
            userId,
            isActive: true,
            stockQuantity:
              parseNumber(getCell(prow, ['Stock', 'stockQuantity']), 0) || 0,
            showInFeaturedProducts: parseYesNo(
              getCell(prow, [
                'Show In Featured Products (Yes/No)',
                'Show In Featured Products',
                'showInFeaturedProducts',
              ])
            ),
            showInBestSellers: parseYesNo(
              getCell(prow, [
                'Show In Best Sellers (Yes/No)',
                'Show In Best Sellers',
                'showInBestSellers',
              ])
            ),
            showInNewArrivals: parseYesNo(
              getCell(prow, [
                'Show In New Arrivals (Yes/No)',
                'Show In New Arrivals',
                'showInNewArrivals',
              ])
            ),
            showInPremiumProducts: parseYesNo(
              getCell(prow, [
                'Show In Premium Products (Yes/No)',
                'Show In Premium Products',
                'showInPremiumProducts',
              ])
            ),
            weight: parseNumber(getCell(prow, ['Weight']), 0) || 0,
            length: parseNumber(getCell(prow, ['Length']), 0) || 0,
            breadth: parseNumber(getCell(prow, ['Breadth']), 0) || 0,
            height: parseNumber(getCell(prow, ['Height']), 0) || 0,
          };

          const productVideoRaw = getCell(prow, [
            'Video URLs',
            'Video URL',
            'videoUrl',
          ]);
          if (productVideoRaw && String(productVideoRaw).startsWith('http')) {
            productPayload.videoUrl = String(productVideoRaw)
              .split(/[;|]/)[0]
              .trim();
          }

          let product = await Product.findOne({
            where: { defaultSku: productSku, userId },
            transaction,
          });

          if (product) {
            await product.update(productPayload, { transaction });
            updatedProducts += 1;
          } else {
            product = await Product.create(
              { ...productPayload, id: uuidv4() },
              { transaction }
            );
            importedProducts += 1;
          }

          // ---------- Product-level images ----------
          if (processImages) {
            // Replace existing product-level images on re-import
            await ProductImage.destroy({
              where: { productId: product.id, variantId: null },
              transaction,
            });

            const imageRaws = splitMediaUrls(
              getCell(prow, [
                'Image URLs',
                'Image URL',
                'Product Image URLs',
              ])
            );

            console.log(
              `[import] ${productSku} product Image URLs count: ${imageRaws.length}`
            );

            if (imageRaws.length === 0) {
              warnings.push(
                `No Image URLs on product row for ${productSku}`
              );
            }

            let position = 0;
            for (const rel of imageRaws) {
              if (/^https?:\/\//i.test(rel)) {
                await ProductImage.create(
                  {
                    id: uuidv4(),
                    productId: product.id,
                    variantId: null,
                    url: rel,
                    position: position++,
                  },
                  { transaction }
                );
                importedImages += 1;
                continue;
              }

              const local = resolveMediaPath(mediaIndex, rel);
              if (!local) {
                warnings.push(
                  `Product image not found in ZIP for ${productSku}: ${rel}`
                );
                continue;
              }

              const uploaded = await uploadOneImage(
                local,
                `products/${productSku}`,
                warnings
              );
              if (!uploaded) continue;

              await ProductImage.create(
                {
                  id: uuidv4(),
                  productId: product.id,
                  variantId: null,
                  url: uploaded.url,
                  position: position++,
                },
                { transaction }
              );
              importedImages += 1;
            }
          }

          // ---------- Variants ----------
          for (const vrow of group.variantRows) {
            const variantSku = String(
              getCell(vrow, ['Variant SKU', 'VariantSKU', 'sku']) || ''
            ).trim();
            if (!variantSku) continue;

            const variantPayload = {
              sku: variantSku,
              size: getCell(vrow, ['Size']) || null,
              color: getCell(vrow, ['Color']) || null,
              price: parseNumber(
                getCell(vrow, ['Price']),
                product.basePrice || 0
              ),
              stockQuantity: parseNumber(
                getCell(vrow, ['Stock', 'stockQuantity']),
                0
              ),
              productId: product.id,
            };

            const vVideo = getCell(vrow, [
              'Video URLs',
              'Video URL',
              'videoUrl',
            ]);
            if (vVideo && String(vVideo).startsWith('http')) {
              variantPayload.videoUrl = String(vVideo)
                .split(/[;|]/)[0]
                .trim();
            }

            let variant = await ProductVariant.findOne({
              where: { sku: variantSku, productId: product.id },
              transaction,
            });

            if (variant) {
              await variant.update(variantPayload, { transaction });
              updatedVariants += 1;
            } else {
              variant = await ProductVariant.create(
                { ...variantPayload, id: uuidv4() },
                { transaction }
              );
              importedVariants += 1;
            }

            if (processImages) {
              await ProductImage.destroy({
                where: {
                  productId: product.id,
                  variantId: variant.id,
                },
                transaction,
              });

              const vImageRaws = splitMediaUrls(
                getCell(vrow, ['Image URLs', 'Image URL'])
              );

              let vPos = 0;
              for (const rel of vImageRaws) {
                if (/^https?:\/\//i.test(rel)) {
                  await ProductImage.create(
                    {
                      id: uuidv4(),
                      productId: product.id,
                      variantId: variant.id,
                      url: rel,
                      position: vPos++,
                    },
                    { transaction }
                  );
                  importedImages += 1;
                  continue;
                }

                const local = resolveMediaPath(mediaIndex, rel);
                if (!local) {
                  warnings.push(
                    `Variant image not found in ZIP for ${variantSku}: ${rel}`
                  );
                  continue;
                }

                const uploaded = await uploadOneImage(
                  local,
                  `products/${productSku}/variants/${variantSku}`,
                  warnings
                );
                if (!uploaded) continue;

                await ProductImage.create(
                  {
                    id: uuidv4(),
                    productId: product.id,
                    variantId: variant.id,
                    url: uploaded.url,
                    position: vPos++,
                  },
                  { transaction }
                );
                importedImages += 1;
              }
            }
          }

          await transaction.commit();
        } catch (err) {
          await transaction.rollback();
          warnings.push(
            `Failed to import product ${productSku}: ${err.message}`
          );
          console.error(`Import error for ${productSku}:`, err);
        }
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
        debug: {
          processImages,
          mediaFilesIndexed: mediaIndex ? mediaIndex.byRel.size : 0,
          isZip: !!isZip,
          importType,
        },
      };
    } finally {
      if (extractDir && fs.existsSync(extractDir)) {
        try {
          fs.rmSync(extractDir, { recursive: true, force: true });
        } catch (e) {
          console.warn('Failed to cleanup extract dir:', e.message);
        }
      }
    }
  }

  findExcelFile(rootDir) {
    const preferred = [
      'products.xls',
      'products.xlsx',
      'Products.xls',
      'Products.xlsx',
    ];
    for (const name of preferred) {
      const p = path.join(rootDir, name);
      if (fs.existsSync(p)) return p;
    }
    let found = null;
    function walk(dir) {
      if (found) return;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full);
        else if (/\.xlsx?$/i.test(ent.name) && /product/i.test(ent.name)) {
          found = full;
          return;
        }
      }
      if (!found) {
        for (const ent of entries) {
          if (!ent.isDirectory() && /\.xlsx?$/i.test(ent.name)) {
            found = path.join(dir, ent.name);
            return;
          }
        }
      }
    }
    walk(rootDir);
    return found;
  }
}

module.exports = new ProductImportService();
