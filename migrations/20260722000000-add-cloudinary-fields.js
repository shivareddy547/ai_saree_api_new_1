'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add cloudinaryVideoPublicId column
    await queryInterface.addColumn('products', 'cloudinaryVideoPublicId', {
      type: Sequelize.STRING,
      allowNull: true
    });
    // Add cloudinaryAudioPublicId column
    await queryInterface.addColumn('products', 'cloudinaryAudioPublicId', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('products', 'cloudinaryVideoPublicId');
    await queryInterface.removeColumn('products', 'cloudinaryAudioPublicId');
  }
};
