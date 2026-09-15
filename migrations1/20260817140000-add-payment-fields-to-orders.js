'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('orders')) return;
    const d = await queryInterface.describeTable('orders');
    if (!d.paymentStatus) {
      await queryInterface.addColumn('orders', 'paymentStatus', {
        type: Sequelize.STRING, allowNull: false, defaultValue: 'pending',
      });
    }
    if (!d.paymentProviderId) {
      await queryInterface.addColumn('orders', 'paymentProviderId', {
        type: Sequelize.UUID, allowNull: true,
      });
    }
    if (!d.merchantOrderId) {
      await queryInterface.addColumn('orders', 'merchantOrderId', {
        type: Sequelize.STRING, allowNull: true,
      });
    }
    if (!d.paymentDetails) {
      await queryInterface.addColumn('orders', 'paymentDetails', {
        type: Sequelize.JSONB, allowNull: true, defaultValue: {},
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('orders')) return;
    const d = await queryInterface.describeTable('orders');
    for (const c of ['paymentStatus','paymentProviderId','merchantOrderId','paymentDetails']) {
      if (d[c]) await queryInterface.removeColumn('orders', c);
    }
  },
};
