'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_providers_provider_type" ADD VALUE IF NOT EXISTS 'payment';
    `);
  },
  down: async (queryInterface, Sequelize) => {
    // ENUM value removal is not straightforward in PostgreSQL; leave as-is for safety
  }
};
