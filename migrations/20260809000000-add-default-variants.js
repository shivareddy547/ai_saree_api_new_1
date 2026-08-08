'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Find products with no variants
    const products = await queryInterface.sequelize.query(
      `SELECT p.id, p."basePrice", p."defaultSku"
       FROM products p
       LEFT JOIN product_variants pv ON p.id = pv."productId"
       WHERE pv.id IS NULL`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    for (const product of products) {
      const price = product.basePrice || 0;
      const sku = product.defaultSku || 'default';
      await queryInterface.bulkInsert('product_variants', [{
        id: require('uuid').v4(),
        productId: product.id,
        sku: sku,
        size: '',
        color: '',
        price: price,
        costPrice: null,
        stockQuantity: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);
    }
  },
  down: async (queryInterface, Sequelize) => {
    // Cannot easily revert without data loss, but we could delete all variants that have empty size/color?
    // We'll not implement down for safety.
  }
};
