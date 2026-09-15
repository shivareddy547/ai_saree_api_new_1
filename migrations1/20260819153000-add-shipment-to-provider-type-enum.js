'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'shipment' value to the existing provider_type ENUM
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_providers_provider_type" ADD VALUE IF NOT EXISTS 'shipment';
    `);
  },
  down: async (queryInterface, Sequelize) => {
    // ENUM value removal is not supported safely in PostgreSQL without recreating the type.
    // Leave as no-op to avoid data loss.
  }
};
