'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));

    if (!list.includes('users')) {
      await queryInterface.createTable('users', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        fullName: { type: Sequelize.STRING, allowNull: false },
        email: { type: Sequelize.STRING, allowNull: false, unique: true },
        password: { type: Sequelize.STRING, allowNull: false },
        phone: { type: Sequelize.STRING, allowNull: true },
        isEmailVerified: { type: Sequelize.BOOLEAN, defaultValue: false },
        otp: { type: Sequelize.STRING, allowNull: true },
        otpExpires: { type: Sequelize.DATE, allowNull: true },
        role: { type: Sequelize.ENUM('admin', 'user'), allowNull: false, defaultValue: 'user' },
        isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        instagramAccessToken: { type: Sequelize.STRING, allowNull: true },
        instagramAccountId: { type: Sequelize.STRING, allowNull: true },
        instagramUsername: { type: Sequelize.STRING, allowNull: true },
        instagramAccountType: { type: Sequelize.STRING, allowNull: true },
        instagramTokenExpiresAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('users', ['email'], { unique: true, name: 'users_email_unique_idx' });
    }

    if (!list.includes('categories')) {
      await queryInterface.createTable('categories', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: Sequelize.STRING, allowNull: false },
        subtitle: { type: Sequelize.STRING, allowNull: true },
        highlightText: { type: Sequelize.STRING, allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        imageUrl: { type: Sequelize.STRING, allowNull: true },
        bgGradient: { type: Sequelize.STRING, allowNull: true, defaultValue: 'bg-gradient-to-r from-purple-500 to-indigo-500' },
        badgeText: { type: Sequelize.STRING, allowNull: true },
        badgeIcon: { type: Sequelize.STRING, allowNull: true },
        order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        parentId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'categories', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        showInCategoryGrid: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        showInHero: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        permalink: { type: Sequelize.STRING, allowNull: true, unique: true },
        primaryButtonText: { type: Sequelize.STRING, allowNull: true },
        primaryButtonLink: { type: Sequelize.STRING, allowNull: true },
        secondaryButtonText: { type: Sequelize.STRING, allowNull: true },
        secondaryButtonLink: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('categories', ['parentId']);
      await queryInterface.addIndex('categories', ['order']);
      await queryInterface.addIndex('categories', ['isActive']);
      await queryInterface.addIndex('categories', ['permalink']);
    }

    if (!list.includes('products')) {
      await queryInterface.createTable('products', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        name: { type: Sequelize.STRING, allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        basePrice: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        costPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        stockQuantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        defaultSku: { type: Sequelize.STRING, allowNull: true },
        categoryId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'categories', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        subcategoryId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'categories', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        videoUrl: { type: Sequelize.STRING, allowNull: true },
        videoKitUrl: { type: Sequelize.STRING, allowNull: true },
        audioMode: { type: Sequelize.ENUM('text', 'upload', 'record', 'clone'), defaultValue: 'text' },
        audioScript: { type: Sequelize.TEXT, allowNull: true },
        audioLanguage: { type: Sequelize.STRING, allowNull: true },
        voiceGender: { type: Sequelize.ENUM('female', 'male'), allowNull: true },
        videoLength: { type: Sequelize.INTEGER, allowNull: true },
        customAudioUrl: { type: Sequelize.STRING, allowNull: true },
        recordedAudioUrl: { type: Sequelize.STRING, allowNull: true },
        status: { type: Sequelize.ENUM('draft', 'published'), defaultValue: 'draft' },
        views: { type: Sequelize.INTEGER, defaultValue: 0 },
        isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        cloudinaryVideoPublicId: { type: Sequelize.STRING, allowNull: true },
        cloudinaryAudioPublicId: { type: Sequelize.STRING, allowNull: true },
        weight: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0.5 },
        length: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 30 },
        breadth: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 25 },
        height: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 5 },
        showInFeaturedProducts: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        showInBestSellers: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        showInNewArrivals: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        showInPremiumProducts: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('products', ['userId']);
      await queryInterface.addIndex('products', ['categoryId']);
      await queryInterface.addIndex('products', ['isActive']);
    }

    if (!list.includes('product_variants')) {
      await queryInterface.createTable('product_variants', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        productId: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        sku: { type: Sequelize.STRING, allowNull: false },
        size: { type: Sequelize.STRING, allowNull: true },
        color: { type: Sequelize.STRING, allowNull: true },
        price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        costPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        stockQuantity: { type: Sequelize.INTEGER, defaultValue: 0 },
        videoUrl: { type: Sequelize.STRING, allowNull: true },
        cloudinaryVideoPublicId: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('product_variants', ['productId']);
    }

    if (!list.includes('product_images')) {
      await queryInterface.createTable('product_images', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
        productId: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        variantId: { type: Sequelize.UUID, allowNull: true, references: { model: 'product_variants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        url: { type: Sequelize.STRING, allowNull: false },
        position: { type: Sequelize.INTEGER, defaultValue: 0 },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('product_images', ['productId']);
      await queryInterface.addIndex('product_images', ['variantId']);
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('product_images');
    await queryInterface.dropTable('product_variants');
    await queryInterface.dropTable('products');
    await queryInterface.dropTable('categories');
    await queryInterface.dropTable('users');
  },
};
