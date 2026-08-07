'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add ENUM type for role
    await queryInterface.sequelize.query(
      `CREATE TYPE "enum_users_role" AS ENUM ('admin', 'user');`
    );
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.ENUM('admin', 'user'),
      allowNull: false,
      defaultValue: 'user',
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'role');
    await queryInterface.sequelize.query(`DROP TYPE "enum_users_role";`);
  }
};
