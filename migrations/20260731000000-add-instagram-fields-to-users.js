'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableName = 'users';
    const tableDefinition = await queryInterface.describeTable(tableName);

    // Add instagramAccessToken if it doesn't exist
    if (!tableDefinition.instagramAccessToken) {
      await queryInterface.addColumn(tableName, 'instagramAccessToken', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    // Add instagramAccountId if it doesn't exist
    if (!tableDefinition.instagramAccountId) {
      await queryInterface.addColumn(tableName, 'instagramAccountId', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    // Add instagramUsername if it doesn't exist
    if (!tableDefinition.instagramUsername) {
      await queryInterface.addColumn(tableName, 'instagramUsername', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    // Add instagramAccountType if it doesn't exist
    if (!tableDefinition.instagramAccountType) {
      await queryInterface.addColumn(tableName, 'instagramAccountType', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    // Add instagramTokenExpiresAt if it doesn't exist
    if (!tableDefinition.instagramTokenExpiresAt) {
      await queryInterface.addColumn(tableName, 'instagramTokenExpiresAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  down: async (queryInterface) => {
    const tableName = 'users';
    const tableDefinition = await queryInterface.describeTable(tableName);

    if (tableDefinition.instagramAccessToken) {
      await queryInterface.removeColumn(
        tableName,
        'instagramAccessToken'
      );
    }

    if (tableDefinition.instagramAccountId) {
      await queryInterface.removeColumn(
        tableName,
        'instagramAccountId'
      );
    }

    if (tableDefinition.instagramUsername) {
      await queryInterface.removeColumn(
        tableName,
        'instagramUsername'
      );
    }

    if (tableDefinition.instagramAccountType) {
      await queryInterface.removeColumn(
        tableName,
        'instagramAccountType'
      );
    }

    if (tableDefinition.instagramTokenExpiresAt) {
      await queryInterface.removeColumn(
        tableName,
        'instagramTokenExpiresAt'
      );
    }
  }
};