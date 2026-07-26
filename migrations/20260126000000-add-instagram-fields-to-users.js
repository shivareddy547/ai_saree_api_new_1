'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add Instagram fields to users table
    await queryInterface.addColumn('users', 'instagramAccessToken', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'instagramAccountId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'instagramUsername', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'instagramAccountType', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'instagramTokenExpiresAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    // Remove Instagram fields
    await queryInterface.removeColumn('users', 'instagramAccessToken');
    await queryInterface.removeColumn('users', 'instagramAccountId');
    await queryInterface.removeColumn('users', 'instagramUsername');
    await queryInterface.removeColumn('users', 'instagramAccountType');
    await queryInterface.removeColumn('users', 'instagramTokenExpiresAt');
  }
};
