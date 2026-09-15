'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('orders')) return;
    const d = await queryInterface.describeTable('orders');
    if (!d.billingAddress) {
      await queryInterface.addColumn('orders', 'billingAddress', {
        type: Sequelize.TEXT, allowNull: true,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('orders')) return;
    const d = await queryInterface.describeTable('orders');
    if (d.billingAddress) await queryInterface.removeColumn('orders', 'billingAddress');
  },
};
