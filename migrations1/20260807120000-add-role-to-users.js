'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('users')) return;
    const d = await queryInterface.describeTable('users');
    if (d.role) return;
    const [enumRows] = await queryInterface.sequelize.query(
      `SELECT 1 FROM pg_type WHERE typname = 'enum_users_role';`
    );
    if (!enumRows.length) {
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_users_role" AS ENUM ('admin', 'user');`
      );
    }
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.ENUM('admin', 'user'),
      allowNull: false,
      defaultValue: 'user',
    });
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (!tableList.includes('users')) return;
    const d = await queryInterface.describeTable('users');
    if (d.role) {
      await queryInterface.removeColumn('users', 'role');
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_users_role";`);
    }
  },
};
