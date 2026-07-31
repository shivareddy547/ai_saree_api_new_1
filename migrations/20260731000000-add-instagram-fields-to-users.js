'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // ADD COLUMN: instagramAccessToken to users table
    await queryInterface.addColumn('users', 'instagramAccessToken', {
      type: Sequelize.STRING,
      allowNull: true
    });
    // ADD COLUMN: instagramAccountId to users table
    await queryInterface.addColumn('users', 'instagramAccountId', {
      type: Sequelize.STRING,
      allowNull: true
    });
    // ADD COLUMN: instagramUsername to users table
    await queryInterface.addColumn('users', 'instagramUsername', {
      type: Sequelize.STRING,
      allowNull: true
    });
    // ADD COLUMN: instagramAccountType to users table
    await queryInterface.addColumn('users', 'instagramAccountType', {
      type: Sequelize.STRING,
      allowNull: true
    });
    // ADD COLUMN: instagramTokenExpiresAt to users table
    await queryInterface.addColumn('users', 'instagramTokenExpiresAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },
  down: async (queryInterface, Sequelize) => {
    // Reverse: Remove all Instagram fields from users table
    await queryInterface.removeColumn('users', 'instagramAccessToken');
    await queryInterface.removeColumn('users', 'instagramAccountId');
    await queryInterface.removeColumn('users', 'instagramUsername');
    await queryInterface.removeColumn('users', 'instagramAccountType');
    await queryInterface.removeColumn('users', 'instagramTokenExpiresAt');
  }
};
