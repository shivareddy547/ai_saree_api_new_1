'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'clone' value to the enum type "enum_products_audioMode"
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_products_audioMode" ADD VALUE 'clone';`
    );
  },
  down: async (queryInterface, Sequelize) => {
    // PostgreSQL does not support removing enum values directly.
    // The safest approach is to recreate the enum without 'clone'.
    // We'll provide a down that renames the old type and creates a new one.
    // For simplicity, we'll not implement a full rollback here, but we'll provide a warning.
    // However, we cannot remove a value from enum without recreating the type.
    // So we'll just throw an error or log a message.
    throw new Error('Cannot revert adding enum value. Please handle manually.');
  }
};
