'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Update all product_variants where price = 0 or NULL to use the product's basePrice
    await queryInterface.sequelize.query(`
      UPDATE product_variants pv
      SET price = COALESCE(
        (SELECT p."basePrice" FROM products p WHERE p.id = pv."productId"),
        0
      )
      WHERE pv.price IS NULL OR pv.price = 0;
    `);
    // Also set costPrice if NULL to NULL (already)
  },
  down: async (queryInterface, Sequelize) => {
    // Cannot revert easily, but we could set prices back to 0? Not safe.
    // No down operation.
  }
};
