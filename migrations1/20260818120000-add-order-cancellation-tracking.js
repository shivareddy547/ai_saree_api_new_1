'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('orders')) return;
    const d = await queryInterface.describeTable('orders');
    if (!d.cancellationReason) {
      await queryInterface.addColumn('orders', 'cancellationReason', {
        type: Sequelize.TEXT, allowNull: true,
      });
    }
    if (!d.trackingUrl) {
      await queryInterface.addColumn('orders', 'trackingUrl', {
        type: Sequelize.STRING, allowNull: true,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('orders')) return;
    const d = await queryInterface.describeTable('orders');
    if (d.cancellationReason) await queryInterface.removeColumn('orders', 'cancellationReason');
    if (d.trackingUrl) await queryInterface.removeColumn('orders', 'trackingUrl');
  },
};
