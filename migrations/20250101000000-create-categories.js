'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('categories', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
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

    await queryInterface.createTable('subcategories', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
      },
      categoryId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'categories',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
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

    await queryInterface.bulkInsert('categories', [
      { id: 'cat-sarees', name: 'Sarees', createdAt: new Date(), updatedAt: new Date() },
      { id: 'cat-lehengas', name: 'Lehengas', createdAt: new Date(), updatedAt: new Date() },
      { id: 'cat-suits', name: 'Suits & Kurtis', createdAt: new Date(), updatedAt: new Date() },
      { id: 'cat-accessories', name: 'Accessories', createdAt: new Date(), updatedAt: new Date() },
    ]);

    await queryInterface.bulkInsert('subcategories', [
      { id: 'sub-banarasi', categoryId: 'cat-sarees', name: 'Banarasi Silk', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sub-kanjeevaram', categoryId: 'cat-sarees', name: 'Kanjeevaram', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sub-cotton', categoryId: 'cat-sarees', name: 'Cotton Saree', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sub-georgette', categoryId: 'cat-sarees', name: 'Georgette', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sub-bridal', categoryId: 'cat-lehengas', name: 'Bridal Lehenga', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sub-designer', categoryId: 'cat-lehengas', name: 'Designer Lehenga', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sub-party', categoryId: 'cat-lehengas', name: 'Party Wear', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sub-anarkali', categoryId: 'cat-suits', name: 'Anarkali', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sub-straight', categoryId: 'cat-suits', name: 'Straight Cut', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sub-palazzo', categoryId: 'cat-suits', name: 'Palazzo Set', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sub-jewelry', categoryId: 'cat-accessories', name: 'Jewelry', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sub-bags', categoryId: 'cat-accessories', name: 'Handbags', createdAt: new Date(), updatedAt: new Date() },
      { id: 'sub-stoles', categoryId: 'cat-accessories', name: 'Stoles & Dupattas', createdAt: new Date(), updatedAt: new Date() },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('subcategories');
    await queryInterface.dropTable('categories');
  }
};
