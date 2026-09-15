'use strict';
// NOTE: isActive is already added by 20250915000001-add-missing-product-columns.js.
// This migration is intentionally idempotent / no-op to avoid "column already exists".
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('products')) return;
    const d = await queryInterface.describeTable('products');
    if (!d.isActive) {
      await queryInterface.addColumn('products', 'isActive', {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    // No-op — the column is owned by 20250915000001.
  },
};
