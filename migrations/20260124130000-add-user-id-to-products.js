'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add userId column to products table
    await queryInterface.addColumn('products', 'userId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    // After adding the column, we need to make it NOT NULL
    // But first, we need to populate it with a default user ID if there are existing products
    // For existing products, we'll set a default value (you may want to handle this differently)
    await queryInterface.sequelize.query(`
      UPDATE products SET "userId" = (SELECT id FROM users LIMIT 1) WHERE "userId" IS NULL;
    `);
    // Now make it NOT NULL
    await queryInterface.changeColumn('products', 'userId', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('products', 'userId');
  }
};
