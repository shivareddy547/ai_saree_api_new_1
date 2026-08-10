'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add all product display flag columns in one migration
    await queryInterface.addColumn('products', 'showInFeaturedProducts', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('products', 'showInBestSellers', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('products', 'showInNewArrivals', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('products', 'showInPremiumProducts', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('products', 'showInFeaturedProducts');
    await queryInterface.removeColumn('products', 'showInBestSellers');
    await queryInterface.removeColumn('products', 'showInNewArrivals');
    await queryInterface.removeColumn('products', 'showInPremiumProducts');
  }
};
