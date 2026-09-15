'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (list.includes('cart_items')) return;
    await queryInterface.createTable('cart_items', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      cartId: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'carts', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      productId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      variantId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'product_variants', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (list.includes('cart_items')) await queryInterface.dropTable('cart_items');
  },
};
