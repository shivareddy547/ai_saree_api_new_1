'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) =>
      typeof t === 'object' ? t.tableName : t
    );
    if (!tableList.includes('products')) return;

    const description = await queryInterface.describeTable('products');

    if (!description.isActive) {
      await queryInterface.addColumn('products', 'isActive', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
    if (!description.weight) {
      await queryInterface.addColumn('products', 'weight', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.5,
      });
    }
    if (!description.length) {
      await queryInterface.addColumn('products', 'length', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 30,
      });
    }
    if (!description.breadth) {
      await queryInterface.addColumn('products', 'breadth', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 25,
      });
    }
    if (!description.height) {
      await queryInterface.addColumn('products', 'height', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 5,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) =>
      typeof t === 'object' ? t.tableName : t
    );
    if (!tableList.includes('products')) return;

    const description = await queryInterface.describeTable('products');
    const cols = ['isActive', 'weight', 'length', 'breadth', 'height'];
    for (const col of cols) {
      if (description[col]) {
        await queryInterface.removeColumn('products', col);
      }
    }
  },
};
