'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('products')) return;
    const d = await queryInterface.describeTable('products');
    if (!d.userId) {
      await queryInterface.addColumn('products', 'userId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      });
      await queryInterface.sequelize.query(
        `UPDATE products SET "userId" = (SELECT id FROM users LIMIT 1) WHERE "userId" IS NULL;`
      );
      await queryInterface.changeColumn('products', 'userId', {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('products')) return;
    const d = await queryInterface.describeTable('products');
    if (d.userId) await queryInterface.removeColumn('products', 'userId');
  },
};
