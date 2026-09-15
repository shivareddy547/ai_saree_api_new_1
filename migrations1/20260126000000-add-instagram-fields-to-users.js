'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('users')) return;
    const d = await queryInterface.describeTable('users');
    const cols = [
      ['instagramAccessToken', Sequelize.STRING],
      ['instagramAccountId', Sequelize.STRING],
      ['instagramUsername', Sequelize.STRING],
      ['instagramAccountType', Sequelize.STRING],
      ['instagramTokenExpiresAt', Sequelize.DATE],
    ];
    for (const [name, type] of cols) {
      if (!d[name]) {
        await queryInterface.addColumn('users', name, { type, allowNull: true });
      }
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('users')) return;
    const d = await queryInterface.describeTable('users');
    for (const col of ['instagramAccessToken','instagramAccountId','instagramUsername','instagramAccountType','instagramTokenExpiresAt']) {
      if (d[col]) await queryInterface.removeColumn('users', col);
    }
  },
};
