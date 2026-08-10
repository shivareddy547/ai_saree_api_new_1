'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('products', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
      },
      basePrice: {
        type: Sequelize.DECIMAL(10,2),
      },
      defaultSku: {
        type: Sequelize.STRING,
      },
      categoryId: {
        type: Sequelize.STRING,
        allowNull: true,
        // references removed – will be added later by fix migration
      },
      subcategoryId: {
        type: Sequelize.STRING,
        allowNull: true,
        // references removed – will be added later by fix migration
      },
      videoUrl: {
        type: Sequelize.STRING,
      },
      videoKitUrl: {
        type: Sequelize.STRING,
      },
      audioMode: {
        type: Sequelize.ENUM('text', 'upload', 'record'),
        defaultValue: 'text',
      },
      audioScript: {
        type: Sequelize.TEXT,
      },
      audioLanguage: {
        type: Sequelize.STRING,
      },
      voiceGender: {
        type: Sequelize.ENUM('female', 'male'),
      },
      videoLength: {
        type: Sequelize.INTEGER,
      },
      customAudioUrl: {
        type: Sequelize.STRING,
      },
      recordedAudioUrl: {
        type: Sequelize.STRING,
      },
      status: {
        type: Sequelize.ENUM('draft', 'published'),
        defaultValue: 'draft',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable('product_variants', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sku: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      size: {
        type: Sequelize.STRING,
      },
      color: {
        type: Sequelize.STRING,
      },
      price: {
        type: Sequelize.DECIMAL(10,2),
        allowNull: false,
      },
      costPrice: {
        type: Sequelize.DECIMAL(10,2),
      },
      stockQuantity: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable('product_images', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      url: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      position: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('product_images');
    await queryInterface.dropTable('product_variants');
    await queryInterface.dropTable('products');
  }
};
