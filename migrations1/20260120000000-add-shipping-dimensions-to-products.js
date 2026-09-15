'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('products')) return;
    const d = await queryInterface.describeTable('products');
    if (!d.weight) {
      await queryInterface.addColumn('products', 'weight', {
        type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0.5,
      });
    }
    if (!d.length) {
      await queryInterface.addColumn('products', 'length', {
        type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 30,
      });
    }
    if (!d.breadth) {
      await queryInterface.addColumn('products', 'breadth', {
        type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 25,
      });
    }
    if (!d.height) {
      await queryInterface.addColumn('products', 'height', {
        type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 5,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('products')) return;
    const d = await queryInterface.describeTable('products');
    for (const col of ['weight', 'length', 'breadth', 'height']) {
      if (d[col]) await queryInterface.removeColumn('products', col);
    }
  },
};
