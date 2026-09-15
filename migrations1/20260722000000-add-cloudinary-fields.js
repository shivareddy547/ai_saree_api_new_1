'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('products')) return;
    const d = await queryInterface.describeTable('products');
    if (!d.cloudinaryVideoPublicId) {
      await queryInterface.addColumn('products', 'cloudinaryVideoPublicId', {
        type: Sequelize.STRING, allowNull: true,
      });
    }
    if (!d.cloudinaryAudioPublicId) {
      await queryInterface.addColumn('products', 'cloudinaryAudioPublicId', {
        type: Sequelize.STRING, allowNull: true,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('products')) return;
    const d = await queryInterface.describeTable('products');
    if (d.cloudinaryVideoPublicId) await queryInterface.removeColumn('products', 'cloudinaryVideoPublicId');
    if (d.cloudinaryAudioPublicId) await queryInterface.removeColumn('products', 'cloudinaryAudioPublicId');
  },
};
