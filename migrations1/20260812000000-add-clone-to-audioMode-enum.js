'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if the enum type exists and add 'clone' if not present
    const result = await queryInterface.sequelize.query(
      `SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_products_audioMode'
      );`
    );
    const enumExists = result[0][0].exists;
    if (enumExists) {
      // Add the value if not already present
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_products_audioMode" ADD VALUE IF NOT EXISTS 'clone';`
      );
    } else {
      // If enum doesn't exist, create it with the new value
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_products_audioMode" AS ENUM ('text', 'upload', 'record', 'clone');`
      );
    }
  },
  down: async (queryInterface, Sequelize) => {
    // Cannot remove enum value easily, so we just log a warning.
    // This down is a no-op to avoid breaking migrations.
    console.warn('Cannot revert addition of "clone" to enum_products_audioMode automatically.');
  }
};
