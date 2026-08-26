'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // CREATE: page_view_logs table to store IP and location per view
    await queryInterface.createTable('page_view_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      path: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      ipAddress: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      region: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      countryCode: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      isGuest: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
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
    await queryInterface.addIndex('page_view_logs', ['path']);
    await queryInterface.addIndex('page_view_logs', ['createdAt']);
    await queryInterface.addIndex('page_view_logs', ['ipAddress']);
  },
  down: async (queryInterface, Sequelize) => {
    // Reverse: drop page_view_logs table
    await queryInterface.dropTable('page_view_logs');
  },
};
