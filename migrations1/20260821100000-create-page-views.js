'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (list.includes('page_views')) return;
    await queryInterface.createTable('page_views', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      path: { type: Sequelize.STRING, allowNull: false, unique: true },
      totalViews: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      guestViews: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      providerViews: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('page_views', ['path'], {
      unique: true,
      name: 'page_views_path_unique',
    });
  },
  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (list.includes('page_views')) await queryInterface.dropTable('page_views');
  },
};
