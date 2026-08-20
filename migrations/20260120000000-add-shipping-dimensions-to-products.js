'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add weight column with default 0.5
    await queryInterface.addColumn('products', 'weight', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.5,
    });
    // Add length column with default 30
    await queryInterface.addColumn('products', 'length', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 30,
    });
    // Add breadth column with default 25
    await queryInterface.addColumn('products', 'breadth', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 25,
    });
    // Add height column with default 5
    await queryInterface.addColumn('products', 'height', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 5,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('products', 'weight');
    await queryInterface.removeColumn('products', 'length');
    await queryInterface.removeColumn('products', 'breadth');
    await queryInterface.removeColumn('products', 'height');
  }
};
