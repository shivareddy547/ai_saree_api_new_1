'use strict';
// NOTE: variantId on product_images is already added by
// 20250915000002-add-variant-id-to-product-images.js.
// This is intentionally a no-op to avoid "column already exists".
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // no-op
  },
  down: async (queryInterface, Sequelize) => {
    // no-op
  },
};
