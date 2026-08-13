'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop the existing foreign key constraint from products.subcategoryId to subcategories.id
    // First, get the current constraint name (it might be auto-generated)
    // We'll try to drop using the standard naming convention or by querying information_schema
    // For simplicity, we'll attempt to drop and then add; if it fails, we'll catch and continue.
    try {
      await queryInterface.removeConstraint('products', 'products_subcategoryId_fkey');
    } catch (error) {
      console.log('Could not drop constraint products_subcategoryId_fkey, it may not exist.');
    }
    // Add new foreign key referencing categories.id
    await queryInterface.addConstraint('products', {
      fields: ['subcategoryId'],
      type: 'foreign key',
      name: 'products_subcategoryId_fkey',
      references: {
        table: 'categories',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },
  down: async (queryInterface, Sequelize) => {
    // Revert: drop the new constraint and restore the old one to subcategories
    try {
      await queryInterface.removeConstraint('products', 'products_subcategoryId_fkey');
    } catch (error) {
      console.log('Could not drop constraint products_subcategoryId_fkey, it may not exist.');
    }
    // Add back the original foreign key to subcategories
    await queryInterface.addConstraint('products', {
      fields: ['subcategoryId'],
      type: 'foreign key',
      name: 'products_subcategoryId_fkey',
      references: {
        table: 'subcategories',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  }
};
