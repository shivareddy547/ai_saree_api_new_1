'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (list.includes('categories')) return;
    await queryInterface.createTable('categories', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      subtitle: { type: Sequelize.STRING, allowNull: true },
      highlightText: { type: Sequelize.STRING, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      imageUrl: { type: Sequelize.STRING, allowNull: true },
      bgGradient: {
        type: Sequelize.STRING, allowNull: true,
        defaultValue: 'bg-gradient-to-r from-purple-500 to-indigo-500',
      },
      badgeText: { type: Sequelize.STRING, allowNull: true },
      badgeIcon: { type: Sequelize.STRING, allowNull: true },
      order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      parentId: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'categories', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      showInCategoryGrid: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      showInHero: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      permalink: { type: Sequelize.STRING, allowNull: true, unique: true },
      primaryButtonText: { type: Sequelize.STRING, allowNull: true },
      primaryButtonLink: { type: Sequelize.STRING, allowNull: true },
      secondaryButtonText: { type: Sequelize.STRING, allowNull: true },
      secondaryButtonLink: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('categories', ['parentId']);
    await queryInterface.addIndex('categories', ['order']);
    await queryInterface.addIndex('categories', ['isActive']);
    await queryInterface.addIndex('categories', ['permalink']);
  },
  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (list.includes('categories')) await queryInterface.dropTable('categories');
  },
};
