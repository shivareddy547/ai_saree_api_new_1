'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Find products that have no variants
    const [products] = await queryInterface.sequelize.query(
      `SELECT p.id, p."basePrice", p."defaultSku"
       FROM products p
       LEFT JOIN product_variants pv ON p.id = pv."productId"
       WHERE pv.id IS NULL`
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

    // Also update variants with price = 0 to use product basePrice
    await queryInterface.sequelize.query(`
      UPDATE product_variants pv
      SET price = COALESCE(
        (SELECT p."basePrice" FROM products p WHERE p.id = pv."productId"),
        0
      )
      WHERE pv.price IS NULL OR pv.price = 0;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Cannot revert safely
  }
};
