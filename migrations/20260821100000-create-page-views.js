'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // CREATE: page_views table for /store/* page view analytics
    await queryInterface.createTable('page_views', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      path: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      totalViews: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      guestViews: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      providerViews: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
    await queryInterface.addIndex('page_views', ['path'], {
      unique: true,
      name: 'page_views_path_unique',
    });
  },
  down: async (queryInterface, Sequelize) => {
    // Reverse: drop page_views table
    await queryInterface.dropTable('page_views');
  }
};
