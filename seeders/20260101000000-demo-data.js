'use strict';
const bcrypt = require('bcryptjs');
const { User, Category, Product, ProductVariant, ProductImage, sequelize } = require('../models');
const { Op } = require('sequelize');
/**
 * Helper to find or create a category by name and parentId.
 * Returns the category instance.
 */
const findOrCreateCategory = async (name, parentId = null, extra = {}, transaction) => {
  const where = { name, parentId };
  let category = await Category.findOne({ where, transaction });
  if (!category) {
    category = await Category.create({
      name,
      parentId,
      ...extra,
      // Set defaults for required fields
      order: extra.order || 0,
      isActive: extra.isActive !== undefined ? extra.isActive : true,
      showInCategoryGrid: extra.showInCategoryGrid !== undefined ? extra.showInCategoryGrid : true,
      showInHero: extra.showInHero || false,
      description: extra.description || '',
    }, { transaction });
  }
  return category;
};
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await sequelize.transaction();
    try {
      // 1. Create users if they don't exist
      const hashedPassword = await bcrypt.hash('test123', 10);
      const userEmails = ['saree@gmail.com', 'saree1@gmail.com'];
      const users = [];
      for (const email of userEmails) {
        let user = await User.findOne({ where: { email }, transaction });
        if (!user) {
          user = await User.create({
            fullName: email === 'saree@gmail.com' ? 'Saree User' : 'Saree Admin',
            email,
            password: hashedPassword,
            isEmailVerified: true,
            role: email === 'saree1@gmail.com' ? 'admin' : 'user',
          }, { transaction });
        }
        users.push(user);
      }
      const userMap = {};
      users.forEach(u => { userMap[u.email] = u.id; });
      // 2. Create categories (top-level) if they don't exist
      const topCategories = [
        { name: 'Silk Sarees', description: 'Luxurious silk sarees for every occasion', showInHero: true, showInCategoryGrid: true, order: 1 },
        { name: 'Cotton Sarees', description: 'Comfortable and elegant cotton sarees', showInHero: false, showInCategoryGrid: true, order: 2 },
        { name: 'Designer Sarees', description: 'Trendy designer sarees for modern women', showInHero: true, showInCategoryGrid: true, order: 3 },
        { name: 'Bridal Collection', description: 'Exclusive bridal sarees and lehengas', showInHero: true, showInCategoryGrid: true, order: 4 },
        { name: 'Casual Wear', description: 'Everyday casual sarees for comfort', showInHero: false, showInCategoryGrid: true, order: 5 }
      ];
      const catMap = {};
      for (const cat of topCategories) {
        const { name, description, showInHero, showInCategoryGrid, order } = cat;
        const category = await findOrCreateCategory(name, null, {
          description,
          showInHero,
          showInCategoryGrid,
          order,
          isActive: true,
        }, transaction);
        catMap[name] = category.id;
      }
      // 3. Create subcategories if they don't exist
      const subCategories = [
        { name: 'Banarasi Silk', parentName: 'Silk Sarees', showInHero: false, showInCategoryGrid: true, order: 1 },
        { name: 'Kanjivaram Silk', parentName: 'Silk Sarees', showInHero: false, showInCategoryGrid: true, order: 2 },
        { name: 'Mysore Silk', parentName: 'Silk Sarees', showInHero: false, showInCategoryGrid: true, order: 3 },
        { name: 'Handloom Cotton', parentName: 'Cotton Sarees', showInHero: false, showInCategoryGrid: true, order: 1 },
        { name: 'Khadi Cotton', parentName: 'Cotton Sarees', showInHero: false, showInCategoryGrid: true, order: 2 },
        { name: 'Designer Wear', parentName: 'Designer Sarees', showInHero: false, showInCategoryGrid: true, order: 1 },
        { name: 'Fusion Sarees', parentName: 'Designer Sarees', showInHero: false, showInCategoryGrid: true, order: 2 },
        { name: 'Bridal Lehengas', parentName: 'Bridal Collection', showInHero: false, showInCategoryGrid: true, order: 1 },
        { name: 'Bridal Sarees', parentName: 'Bridal Collection', showInHero: false, showInCategoryGrid: true, order: 2 },
        { name: 'Daily Wear', parentName: 'Casual Wear', showInHero: false, showInCategoryGrid: true, order: 1 },
        { name: 'Office Wear', parentName: 'Casual Wear', showInHero: false, showInCategoryGrid: true, order: 2 }
      ];
      const subCatMap = {};
      for (const sub of subCategories) {
        const parentId = catMap[sub.parentName];
        if (!parentId) continue;
        const { name, showInHero, showInCategoryGrid, order } = sub;
        const category = await findOrCreateCategory(name, parentId, {
          description: '',
          showInHero,
          showInCategoryGrid,
          order,
          isActive: true,
        }, transaction);
        subCatMap[name] = category.id;
      }
      // 4. Define product data with a unique identifier (use defaultSku as key)
      const productData = [
        {
          name: 'Banarasi Silk Saree',
          description: 'Handwoven Banarasi silk saree with intricate zari work, perfect for weddings and festive occasions.',
          basePrice: 5999.00,
          costPrice: 4500.00,
          stockQuantity: 50,
          defaultSku: 'BAN-SILK-001',
          categoryName: 'Silk Sarees',
          subcategoryName: 'Banarasi Silk',
          audioMode: 'text',
          audioLanguage: 'en',
          voiceGender: 'female',
          videoLength: 30,
          status: 'published',
          showInFeaturedProducts: true,
          showInBestSellers: true,
          showInNewArrivals: false,
          showInPremiumProducts: true,
          variants: [
            { sku: 'BAN-SILK-001-RED', size: 'Free', color: 'Red', price: 5999.00, costPrice: 4500.00, stockQuantity: 20 },
            { sku: 'BAN-SILK-001-BLU', size: 'Free', color: 'Blue', price: 6299.00, costPrice: 4700.00, stockQuantity: 15 },
            { sku: 'BAN-SILK-001-GRN', size: 'Free', color: 'Green', price: 6499.00, costPrice: 4900.00, stockQuantity: 15 }
          ],
          images: [
            'https://images.unsplash.com/photo-1610030469983-9857967a0196?w=600',
            'https://images.unsplash.com/photo-1583391733956-37566673367c?w=600',
            'https://images.unsplash.com/photo-1610030469983-9857967a0196?w=600'
          ]
        },
        {
          name: 'Kanjivaram Silk Saree',
          description: 'Authentic Kanjivaram silk saree with traditional temple border and rich color combinations.',
          basePrice: 8999.00,
          costPrice: 6800.00,
          stockQuantity: 30,
          defaultSku: 'KAN-SILK-001',
          categoryName: 'Silk Sarees',
          subcategoryName: 'Kanjivaram Silk',
          audioMode: 'text',
          audioLanguage: 'en',
          voiceGender: 'female',
          videoLength: 30,
          status: 'published',
          showInFeaturedProducts: false,
          showInBestSellers: true,
          showInNewArrivals: true,
          showInPremiumProducts: false,
          variants: [
            { sku: 'KAN-SILK-001-PUR', size: 'Free', color: 'Purple', price: 8999.00, costPrice: 6800.00, stockQuantity: 30 }
          ],
          images: [
            'https://images.unsplash.com/photo-1610030469983-9857967a0196?w=600',
            'https://images.unsplash.com/photo-1583391733956-37566673367c?w=600'
          ]
        },
        {
          name: 'Handloom Cotton Saree',
          description: 'Pure handloom cotton saree with traditional weaves, perfect for daily wear and summer comfort.',
          basePrice: 2599.00,
          costPrice: 1800.00,
          stockQuantity: 80,
          defaultSku: 'HND-COT-001',
          categoryName: 'Cotton Sarees',
          subcategoryName: 'Handloom Cotton',
          audioMode: 'text',
          audioLanguage: 'en',
          voiceGender: 'female',
          videoLength: 30,
          status: 'published',
          showInFeaturedProducts: false,
          showInBestSellers: false,
          showInNewArrivals: true,
          showInPremiumProducts: false,
          variants: [
            { sku: 'HND-COT-001-WHT', size: 'Free', color: 'White', price: 2599.00, costPrice: 1800.00, stockQuantity: 40 },
            { sku: 'HND-COT-001-BLU', size: 'Free', color: 'Blue', price: 2799.00, costPrice: 1900.00, stockQuantity: 20 },
            { sku: 'HND-COT-001-PNK', size: 'Free', color: 'Pink', price: 2699.00, costPrice: 1850.00, stockQuantity: 20 }
          ],
          images: [
            'https://images.unsplash.com/photo-1610030469983-9857967a0196?w=600',
            'https://images.unsplash.com/photo-1583391733956-37566673367c?w=600'
          ]
        },
        {
          name: 'Designer Fusion Saree',
          description: 'Contemporary fusion saree blending traditional drapes with modern designs, ideal for parties and events.',
          basePrice: 4499.00,
          costPrice: 3200.00,
          stockQuantity: 40,
          defaultSku: 'DES-FUS-001',
          categoryName: 'Designer Sarees',
          subcategoryName: 'Fusion Sarees',
          audioMode: 'text',
          audioLanguage: 'en',
          voiceGender: 'female',
          videoLength: 30,
          status: 'published',
          showInFeaturedProducts: true,
          showInBestSellers: false,
          showInNewArrivals: true,
          showInPremiumProducts: false,
          variants: [
            { sku: 'DES-FUS-001-RED', size: 'Free', color: 'Red', price: 4499.00, costPrice: 3200.00, stockQuantity: 20 },
            { sku: 'DES-FUS-001-GLD', size: 'Free', color: 'Gold', price: 4799.00, costPrice: 3400.00, stockQuantity: 20 }
          ],
          images: [
            'https://images.unsplash.com/photo-1610030469983-9857967a0196?w=600',
            'https://images.unsplash.com/photo-1583391733956-37566673367c?w=600'
          ]
        },
        {
          name: 'Bridal Lehenga Saree',
          description: 'Exquisite bridal lehenga saree with heavy embroidery and rich fabrics, perfect for the big day.',
          basePrice: 14999.00,
          costPrice: 11000.00,
          stockQuantity: 10,
          defaultSku: 'BRI-LEH-001',
          categoryName: 'Bridal Collection',
          subcategoryName: 'Bridal Lehengas',
          audioMode: 'text',
          audioLanguage: 'en',
          voiceGender: 'female',
          videoLength: 30,
          status: 'published',
          showInFeaturedProducts: true,
          showInBestSellers: true,
          showInNewArrivals: false,
          showInPremiumProducts: true,
          variants: [
            { sku: 'BRI-LEH-001-RED', size: 'Free', color: 'Red', price: 14999.00, costPrice: 11000.00, stockQuantity: 10 }
          ],
          images: [
            'https://images.unsplash.com/photo-1610030469983-9857967a0196?w=600',
            'https://images.unsplash.com/photo-1583391733956-37566673367c?w=600',
            'https://images.unsplash.com/photo-1610030469983-9857967a0196?w=600'
          ]
        },
        {
          name: 'Daily Wear Cotton Saree',
          description: 'Lightweight and breathable cotton saree for everyday comfort and style.',
          basePrice: 1999.00,
          costPrice: 1400.00,
          stockQuantity: 100,
          defaultSku: 'DAY-COT-001',
          categoryName: 'Casual Wear',
          subcategoryName: 'Daily Wear',
          audioMode: 'text',
          audioLanguage: 'en',
          voiceGender: 'female',
          videoLength: 30,
          status: 'published',
          showInFeaturedProducts: false,
          showInBestSellers: false,
          showInNewArrivals: true,
          showInPremiumProducts: false,
          variants: [
            { sku: 'DAY-COT-001-BLU', size: 'Free', color: 'Blue', price: 1999.00, costPrice: 1400.00, stockQuantity: 50 },
            { sku: 'DAY-COT-001-GRN', size: 'Free', color: 'Green', price: 2099.00, costPrice: 1450.00, stockQuantity: 30 },
            { sku: 'DAY-COT-001-YLW', size: 'Free', color: 'Yellow', price: 1899.00, costPrice: 1350.00, stockQuantity: 20 }
          ],
          images: [
            'https://images.unsplash.com/photo-1610030469983-9857967a0196?w=600',
            'https://images.unsplash.com/photo-1583391733956-37566673367c?w=600'
          ]
        },
        {
          name: 'Mysore Silk Saree',
          description: 'Pure Mysore silk saree with elegant minimalistic design, suitable for formal occasions.',
          basePrice: 6999.00,
          costPrice: 5200.00,
          stockQuantity: 25,
          defaultSku: 'MYS-SILK-001',
          categoryName: 'Silk Sarees',
          subcategoryName: 'Mysore Silk',
          audioMode: 'text',
          audioLanguage: 'en',
          voiceGender: 'female',
          videoLength: 30,
          status: 'published',
          showInFeaturedProducts: false,
          showInBestSellers: true,
          showInNewArrivals: false,
          showInPremiumProducts: true,
          variants: [
            { sku: 'MYS-SILK-001-PUR', size: 'Free', color: 'Purple', price: 6999.00, costPrice: 5200.00, stockQuantity: 15 },
            { sku: 'MYS-SILK-001-ORG', size: 'Free', color: 'Orange', price: 7299.00, costPrice: 5400.00, stockQuantity: 10 }
          ],
          images: [
            'https://images.unsplash.com/photo-1610030469983-9857967a0196?w=600',
            'https://images.unsplash.com/photo-1583391733956-37566673367c?w=600'
          ]
        },
        {
          name: 'Khadi Cotton Saree',
          description: 'Sustainable khadi cotton saree with natural dyes and handwoven texture.',
          basePrice: 3299.00,
          costPrice: 2400.00,
          stockQuantity: 60,
          defaultSku: 'KHA-COT-001',
          categoryName: 'Cotton Sarees',
          subcategoryName: 'Khadi Cotton',
          audioMode: 'text',
          audioLanguage: 'en',
          voiceGender: 'female',
          videoLength: 30,
          status: 'published',
          showInFeaturedProducts: false,
          showInBestSellers: false,
          showInNewArrivals: true,
          showInPremiumProducts: false,
          variants: [
            { sku: 'KHA-COT-001-BRO', size: 'Free', color: 'Brown', price: 3299.00, costPrice: 2400.00, stockQuantity: 30 },
            { sku: 'KHA-COT-001-BLK', size: 'Free', color: 'Black', price: 3499.00, costPrice: 2550.00, stockQuantity: 30 }
          ],
          images: [
            'https://images.unsplash.com/photo-1610030469983-9857967a0196?w=600',
            'https://images.unsplash.com/photo-1583391733956-37566673367c?w=600'
          ]
        },
        {
          name: 'Designer Wear Saree',
          description: 'Stylish designer saree with modern prints and contemporary draping style.',
          basePrice: 3999.00,
          costPrice: 2800.00,
          stockQuantity: 35,
          defaultSku: 'DES-WEAR-001',
          categoryName: 'Designer Sarees',
          subcategoryName: 'Designer Wear',
          audioMode: 'text',
          audioLanguage: 'en',
          voiceGender: 'female',
          videoLength: 30,
          status: 'published',
          showInFeaturedProducts: true,
          showInBestSellers: false,
          showInNewArrivals: true,
          showInPremiumProducts: false,
          variants: [
            { sku: 'DES-WEAR-001-PNK', size: 'Free', color: 'Pink', price: 3999.00, costPrice: 2800.00, stockQuantity: 20 },
            { sku: 'DES-WEAR-001-BLU', size: 'Free', color: 'Blue', price: 4299.00, costPrice: 3000.00, stockQuantity: 15 }
          ],
          images: [
            'https://images.unsplash.com/photo-1610030469983-9857967a0196?w=600',
            'https://images.unsplash.com/photo-1583391733956-37566673367c?w=600'
          ]
        },
        {
          name: 'Office Wear Saree',
          description: 'Professional and elegant saree perfect for office wear with subtle design and comfort.',
          basePrice: 2999.00,
          costPrice: 2100.00,
          stockQuantity: 45,
          defaultSku: 'OFF-WEAR-001',
          categoryName: 'Casual Wear',
          subcategoryName: 'Office Wear',
          audioMode: 'text',
          audioLanguage: 'en',
          voiceGender: 'female',
          videoLength: 30,
          status: 'published',
          showInFeaturedProducts: false,
          showInBestSellers: false,
          showInNewArrivals: false,
          showInPremiumProducts: false,
          variants: [
            { sku: 'OFF-WEAR-001-GRY', size: 'Free', color: 'Grey', price: 2999.00, costPrice: 2100.00, stockQuantity: 25 },
            { sku: 'OFF-WEAR-001-NAV', size: 'Free', color: 'Navy', price: 3199.00, costPrice: 2200.00, stockQuantity: 20 }
          ],
          images: [
            'https://images.unsplash.com/photo-1610030469983-9857967a0196?w=600',
            'https://images.unsplash.com/photo-1583391733956-37566673367c?w=600'
          ]
        }
      ];
      // 5. Create products, variants, images idempotently
      const userId = userMap['saree@gmail.com'];
      for (const pData of productData) {
        // Check if product exists by defaultSku
        let product = await Product.findOne({ where: { defaultSku: pData.defaultSku }, transaction });
        if (!product) {
          // Get category and subcategory IDs
          const categoryId = catMap[pData.categoryName];
          const subcategoryId = subCatMap[pData.subcategoryName];
          if (!categoryId || !subcategoryId) {
            console.warn(`Skipping product ${pData.name}: category or subcategory not found`);
            continue;
          }
          product = await Product.create({
            userId: userId,
            name: pData.name,
            description: pData.description,
            basePrice: pData.basePrice,
            costPrice: pData.costPrice,
            stockQuantity: pData.stockQuantity,
            defaultSku: pData.defaultSku,
            categoryId: categoryId,
            subcategoryId: subcategoryId,
            audioMode: pData.audioMode,
            audioLanguage: pData.audioLanguage,
            voiceGender: pData.voiceGender,
            videoLength: pData.videoLength,
            status: pData.status,
            showInFeaturedProducts: pData.showInFeaturedProducts,
            showInBestSellers: pData.showInBestSellers,
            showInNewArrivals: pData.showInNewArrivals,
            showInPremiumProducts: pData.showInPremiumProducts,
            videoUrl: null,
            videoKitUrl: null,
            customAudioUrl: null,
            recordedAudioUrl: null,
            cloudinaryVideoPublicId: null,
            cloudinaryAudioPublicId: null
          }, { transaction });
        }
        // Handle variants: delete existing and re-create? Or skip if exist? We'll skip if variant SKU exists.
        // We'll use findOrCreate for variants.
        for (const vData of pData.variants) {
          const [variant, created] = await ProductVariant.findOrCreate({
            where: { productId: product.id, sku: vData.sku },
            defaults: {
              size: vData.size,
              color: vData.color,
              price: vData.price,
              costPrice: vData.costPrice,
              stockQuantity: vData.stockQuantity,
            },
            transaction
          });
          // Optionally update if exists? We'll skip.
        }
        // Handle images: delete existing and re-create? We'll skip if image already exists by URL.
        for (let i = 0; i < pData.images.length; i++) {
          const url = pData.images[i];
          const [image, created] = await ProductImage.findOrCreate({
            where: { productId: product.id, url },
            defaults: { position: i },
            transaction
          });
        }
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
  down: async (queryInterface, Sequelize) => {
    const transaction = await sequelize.transaction();
    try {
      // Delete only the records we created: based on known emails and SKUs
      // We can delete products with defaultSku in the list
      const skus = [
        'BAN-SILK-001', 'KAN-SILK-001', 'HND-COT-001', 'DES-FUS-001',
        'BRI-LEH-001', 'DAY-COT-001', 'MYS-SILK-001', 'KHA-COT-001',
        'DES-WEAR-001', 'OFF-WEAR-001'
      ];
      const products = await Product.findAll({ where: { defaultSku: skus }, transaction });
      const productIds = products.map(p => p.id);
      // Delete images and variants for these products
      await ProductImage.destroy({ where: { productId: productIds }, transaction });
      await ProductVariant.destroy({ where: { productId: productIds }, transaction });
      await Product.destroy({ where: { id: productIds }, transaction });
      // Delete categories we created: by name and parentId
      const categoryNames = ['Silk Sarees', 'Cotton Sarees', 'Designer Sarees', 'Bridal Collection', 'Casual Wear'];
      const subCategoryNames = [
        'Banarasi Silk', 'Kanjivaram Silk', 'Mysore Silk',
        'Handloom Cotton', 'Khadi Cotton',
        'Designer Wear', 'Fusion Sarees',
        'Bridal Lehengas', 'Bridal Sarees',
        'Daily Wear', 'Office Wear'
      ];
      // Delete subcategories first
      await Category.destroy({ where: { name: subCategoryNames, parentId: { [Op.ne]: null } }, transaction });
      // Delete top categories
      await Category.destroy({ where: { name: categoryNames, parentId: null }, transaction });
      // Delete users
      await User.destroy({ where: { email: ['saree@gmail.com', 'saree1@gmail.com'] }, transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
