'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // PostgreSQL: add new value to enum type
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_providers_provider_type" ADD VALUE IF NOT EXISTS 'social';`
    );
  },
  down: async (queryInterface, Sequelize) => {
    // PostgreSQL does not support removing enum values directly.
    // To revert, you would need to create a new type without 'social',
    // alter the column to use the new type, and drop the old type.
    // This is complex; we'll leave it as a no-op for down.
    // If needed, you can re-create the type without 'social'.
    // For simplicity, we do nothing.
  }
};
