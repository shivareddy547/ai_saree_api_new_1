'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // ADD COLUMN: isActive to products table with default true
    await queryInterface.addColumn('products', 'isActive', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    // Reverse: remove isActive column
    await queryInterface.removeColumn('products', 'isActive');
  }
};
