'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('products')) return;
    const d = await queryInterface.describeTable('products');
    if (!d.costPrice) {
      await queryInterface.addColumn('products', 'costPrice', {
        type: Sequelize.DECIMAL(10, 2), allowNull: true,
      });
    }
    if (!d.stockQuantity) {
      await queryInterface.addColumn('products', 'stockQuantity', {
        type: Sequelize.INTEGER, allowNull: false, defaultValue: 0,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('products')) return;
    const d = await queryInterface.describeTable('products');
    if (d.costPrice) await queryInterface.removeColumn('products', 'costPrice');
    if (d.stockQuantity) await queryInterface.removeColumn('products', 'stockQuantity');
  },
};
