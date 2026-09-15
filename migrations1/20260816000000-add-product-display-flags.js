'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('products')) return;
    const d = await queryInterface.describeTable('products');
    const flags = ['showInFeaturedProducts', 'showInBestSellers', 'showInNewArrivals', 'showInPremiumProducts'];
    for (const flag of flags) {
      if (!d[flag]) {
        await queryInterface.addColumn('products', flag, {
          type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
        });
      }
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('products')) return;
    const d = await queryInterface.describeTable('products');
    for (const flag of ['showInFeaturedProducts','showInBestSellers','showInNewArrivals','showInPremiumProducts']) {
      if (d[flag]) await queryInterface.removeColumn('products', flag);
    }
  },
};
