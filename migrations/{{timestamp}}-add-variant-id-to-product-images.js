'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add variantId column to product_images
    await queryInterface.addColumn('product_images', 'variantId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'product_variants',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    // Add index for foreign key
    await queryInterface.addIndex('product_images', ['variantId']);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('product_images', 'variantId');
  }
};
