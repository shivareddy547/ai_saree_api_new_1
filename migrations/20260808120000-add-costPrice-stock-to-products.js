'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add costPrice column
    await queryInterface.addColumn('products', 'costPrice', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    // Add stockQuantity column
    await queryInterface.addColumn('products', 'stockQuantity', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('products', 'costPrice');
    await queryInterface.removeColumn('products', 'stockQuantity');
  }
};
