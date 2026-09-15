'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create subcategories table if it doesn't exist
    await queryInterface.createTable('subcategories', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      categoryId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'categories',
          key: 'id',
        },
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    // 2. Drop existing foreign key constraints on products (if they exist) to avoid conflicts
    await queryInterface.sequelize.query(`
      ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_categoryId_fkey";
      ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_subcategoryId_fkey";
    `);
    // 3. Convert categoryId and subcategoryId from VARCHAR to INTEGER using a CASE expression
    //    to handle non-numeric values (set them to NULL)
    await queryInterface.sequelize.query(`
      ALTER TABLE "products"
      ALTER COLUMN "categoryId" TYPE INTEGER
      USING (
        CASE
          WHEN "categoryId"::text ~ '^[0-9]+$' THEN "categoryId"::text::INTEGER
          ELSE NULL
        END
      );
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "products"
      ALTER COLUMN "subcategoryId" TYPE INTEGER
      USING (
        CASE
          WHEN "subcategoryId"::text ~ '^[0-9]+$' THEN "subcategoryId"::text::INTEGER
          ELSE NULL
        END
      );
    `);
    // 4. Re-add foreign key constraints
    await queryInterface.addConstraint('products', {
      fields: ['categoryId'],
      type: 'foreign key',
      name: 'products_categoryId_fkey',
      references: {
        table: 'categories',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
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
  },
  down: async (queryInterface, Sequelize) => {
    // Remove foreign keys
    await queryInterface.removeConstraint('products', 'products_categoryId_fkey');
    await queryInterface.removeConstraint('products', 'products_subcategoryId_fkey');
    // Revert columns back to VARCHAR
    await queryInterface.sequelize.query(`
      ALTER TABLE "products"
      ALTER COLUMN "categoryId" TYPE VARCHAR
      USING ("categoryId"::VARCHAR)
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "products"
      ALTER COLUMN "subcategoryId" TYPE VARCHAR
      USING ("subcategoryId"::VARCHAR)
    `);
    // Drop subcategories table
    await queryInterface.dropTable('subcategories');
  }
};
