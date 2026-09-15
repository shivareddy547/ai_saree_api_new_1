'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (list.includes('wishlist_items')) return;
    await queryInterface.createTable('wishlist_items', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      userId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      productId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('wishlist_items', ['userId', 'productId'], {
      unique: true,
      name: 'wishlist_items_user_product_unique',
    });
  },
  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (list.includes('wishlist_items')) await queryInterface.dropTable('wishlist_items');
  },
};
