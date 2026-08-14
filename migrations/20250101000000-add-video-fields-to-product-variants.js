'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('product_variants', 'videoUrl', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('product_variants', 'cloudinaryVideoPublicId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('product_variants', 'videoUrl');
    await queryInterface.removeColumn('product_variants', 'cloudinaryVideoPublicId');
  }
};
