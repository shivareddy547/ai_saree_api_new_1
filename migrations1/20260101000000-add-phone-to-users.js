'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) =>
      typeof t === 'object' ? t.tableName : t
    );
    if (!tableList.includes('users')) {
      return;
    }

    const description = await queryInterface.describeTable('users');
    if (!description.phone) {
      await queryInterface.addColumn('users', 'phone', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) =>
      typeof t === 'object' ? t.tableName : t
    );
    if (!tableList.includes('users')) {
      return;
    }

    const description = await queryInterface.describeTable('users');
    if (description.phone) {
      await queryInterface.removeColumn('users', 'phone');
    }
  },
};
