'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('products')) return;
    const description = await queryInterface.describeTable('products');
    if (!description.views) {
      await queryInterface.addColumn('products', 'views', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: true,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('products')) return;
    const description = await queryInterface.describeTable('products');
    if (description.views) {
      await queryInterface.removeColumn('products', 'views');
    }
  },
};
