'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('users')) return;
    const d = await queryInterface.describeTable('users');
    if (!d.isActive) {
      await queryInterface.addColumn('users', 'isActive', {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('users')) return;
    const d = await queryInterface.describeTable('users');
    if (d.isActive) await queryInterface.removeColumn('users', 'isActive');
  },
};
