'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('orders')) return;
    const d = await queryInterface.describeTable('orders');
    const cols = [
      ['shippingAmount',       { type: Sequelize.DECIMAL(10, 2), allowNull: true, defaultValue: 0 }],
      ['estimatedDeliveryDays',{ type: Sequelize.INTEGER, allowNull: true }],
      ['shipmentProviderId',   { type: Sequelize.UUID, allowNull: true }],
      ['courierCompanyId',     { type: Sequelize.STRING, allowNull: true }],
      ['courierName',          { type: Sequelize.STRING, allowNull: true }],
      ['shiprocketOrderId',    { type: Sequelize.STRING, allowNull: true }],
      ['shiprocketShipmentId', { type: Sequelize.STRING, allowNull: true }],
      ['awbCode',              { type: Sequelize.STRING, allowNull: true }],
      ['shipmentStatus',       { type: Sequelize.STRING, allowNull: true }],
      ['shipmentDetails',      { type: Sequelize.JSONB, allowNull: true, defaultValue: {} }],
    ];
    for (const [name, def] of cols) {
      if (!d[name]) {
        await queryInterface.addColumn('orders', name, def);
      }
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('orders')) return;
    const d = await queryInterface.describeTable('orders');
    for (const c of ['shippingAmount','estimatedDeliveryDays','shipmentProviderId','courierCompanyId','courierName','shiprocketOrderId','shiprocketShipmentId','awbCode','shipmentStatus','shipmentDetails']) {
      if (d[c]) await queryInterface.removeColumn('orders', c);
    }
  },
};
