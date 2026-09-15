'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (list.includes('page_view_logs')) return;
    await queryInterface.createTable('page_view_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      path: { type: Sequelize.STRING, allowNull: false },
      ipAddress: { type: Sequelize.STRING, allowNull: true },
      city: { type: Sequelize.STRING, allowNull: true },
      region: { type: Sequelize.STRING, allowNull: true },
      country: { type: Sequelize.STRING, allowNull: true },
      countryCode: { type: Sequelize.STRING, allowNull: true },
      isGuest: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      provider: { type: Sequelize.STRING, allowNull: true },
      userAgent: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('page_view_logs', ['path']);
    await queryInterface.addIndex('page_view_logs', ['createdAt']);
    await queryInterface.addIndex('page_view_logs', ['ipAddress']);
  },
  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (list.includes('page_view_logs')) await queryInterface.dropTable('page_view_logs');
  },
};
