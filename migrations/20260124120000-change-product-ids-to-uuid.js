'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Drop foreign key constraints if they exist
    try {
      await queryInterface.removeConstraint('product_variants', 'product_variants_productId_fkey');
    } catch (error) {
      console.log('Constraint product_variants_productId_fkey does not exist, skipping...');
    }

    try {
      await queryInterface.removeConstraint('product_images', 'product_images_productId_fkey');
    } catch (error) {
      console.log('Constraint product_images_productId_fkey does not exist, skipping...');
    }

    // Step 2: Add a temporary UUID column to products
    await queryInterface.addColumn('products', 'temp_id', {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    });

    // Step 3: Populate temp_id with UUIDs for existing rows using gen_random_uuid()
    await queryInterface.sequelize.query(`
      UPDATE products SET temp_id = gen_random_uuid() WHERE temp_id IS NULL;
    `);

    // Step 4: Drop the old primary key constraint
    await queryInterface.removeConstraint('products', 'products_pkey');

    // Step 5: Drop the old id column
    await queryInterface.removeColumn('products', 'id');

    // Step 6: Rename temp_id to id
    await queryInterface.renameColumn('products', 'temp_id', 'id');

    // Step 7: Add primary key constraint to the new id column
    await queryInterface.addConstraint('products', {
      fields: ['id'],
      type: 'primary key',
      name: 'products_pkey',
    });

    // Step 8: Add temp columns to child tables
    await queryInterface.addColumn('product_variants', 'temp_product_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    await queryInterface.addColumn('product_images', 'temp_product_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    // Step 9: Populate temp_product_id with UUIDs from products table
    // Convert integer productId to text and join with products table
    await queryInterface.sequelize.query(`
      UPDATE product_variants 
      SET temp_product_id = products.id 
      FROM products 
      WHERE product_variants."productId"::text = products.id::text;
    `);

    await queryInterface.sequelize.query(`
      UPDATE product_images 
      SET temp_product_id = products.id 
      FROM products 
      WHERE product_images."productId"::text = products.id::text;
    `);

    // Step 10: Drop the old productId columns
    await queryInterface.removeColumn('product_variants', 'productId');
    await queryInterface.removeColumn('product_images', 'productId');

    // Step 11: Rename temp_product_id to productId
    await queryInterface.renameColumn('product_variants', 'temp_product_id', 'productId');
    await queryInterface.renameColumn('product_images', 'temp_product_id', 'productId');

    // Step 12: Make productId NOT NULL
    await queryInterface.changeColumn('product_variants', 'productId', {
      type: Sequelize.UUID,
      allowNull: false,
    });

    await queryInterface.changeColumn('product_images', 'productId', {
      type: Sequelize.UUID,
      allowNull: false,
    });

    // Step 13: Change product_variants.id from INTEGER to UUID
    await queryInterface.addColumn('product_variants', 'temp_id', {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    });

    await queryInterface.sequelize.query(`
      UPDATE product_variants SET temp_id = gen_random_uuid() WHERE temp_id IS NULL;
    `);

    await queryInterface.removeConstraint('product_variants', 'product_variants_pkey');
    await queryInterface.removeColumn('product_variants', 'id');
    await queryInterface.renameColumn('product_variants', 'temp_id', 'id');

    await queryInterface.addConstraint('product_variants', {
      fields: ['id'],
      type: 'primary key',
      name: 'product_variants_pkey',
    });

    // Step 14: Change product_images.id from INTEGER to UUID
    await queryInterface.addColumn('product_images', 'temp_id', {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    });

    await queryInterface.sequelize.query(`
      UPDATE product_images SET temp_id = gen_random_uuid() WHERE temp_id IS NULL;
    `);

    await queryInterface.removeConstraint('product_images', 'product_images_pkey');
    await queryInterface.removeColumn('product_images', 'id');
    await queryInterface.renameColumn('product_images', 'temp_id', 'id');

    await queryInterface.addConstraint('product_images', {
      fields: ['id'],
      type: 'primary key',
      name: 'product_images_pkey',
    });

    // Step 15: Re-add foreign key constraints
    await queryInterface.addConstraint('product_variants', {
      fields: ['productId'],
      type: 'foreign key',
      name: 'product_variants_productId_fkey',
      references: {
        table: 'products',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('product_images', {
      fields: ['productId'],
      type: 'foreign key',
      name: 'product_images_productId_fkey',
      references: {
        table: 'products',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop foreign key constraints
    try {
      await queryInterface.removeConstraint('product_variants', 'product_variants_productId_fkey');
    } catch (error) {
      console.log('Constraint product_variants_productId_fkey does not exist, skipping...');
    }

    try {
      await queryInterface.removeConstraint('product_images', 'product_images_productId_fkey');
    } catch (error) {
      console.log('Constraint product_images_productId_fkey does not exist, skipping...');
    }

    // Drop primary key constraints
    await queryInterface.removeConstraint('products', 'products_pkey');
    await queryInterface.removeConstraint('product_variants', 'product_variants_pkey');
    await queryInterface.removeConstraint('product_images', 'product_images_pkey');

    // Add back INTEGER id columns for products
    await queryInterface.addColumn('products', 'new_id', {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      allowNull: true,
    });

    // Generate sequential integers for new_id
    await queryInterface.sequelize.query(`
      UPDATE products SET new_id = row_number() OVER () FROM generate_series(1, (SELECT COUNT(*) FROM products)) AS gs(row_number);
    `);

    await queryInterface.changeColumn('products', 'new_id', {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    });

    // Add temp integer columns for child tables
    await queryInterface.addColumn('product_variants', 'temp_product_id_int', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn('product_images', 'temp_product_id_int', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Convert UUID to integer ID for child tables using string comparison
    await queryInterface.sequelize.query(`
      UPDATE product_variants 
      SET temp_product_id_int = products.new_id 
      FROM products 
      WHERE product_variants."productId"::text = products.id::text;
    `);

    await queryInterface.sequelize.query(`
      UPDATE product_images 
      SET temp_product_id_int = products.new_id 
      FROM products 
      WHERE product_images."productId"::text = products.id::text;
    `);

    // Drop UUID columns from child tables
    await queryInterface.removeColumn('product_variants', 'productId');
    await queryInterface.removeColumn('product_images', 'productId');

    // Rename integer columns
    await queryInterface.renameColumn('product_variants', 'temp_product_id_int', 'productId');
    await queryInterface.renameColumn('product_images', 'temp_product_id_int', 'productId');

    // Make productId NOT NULL
    await queryInterface.changeColumn('product_variants', 'productId', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    await queryInterface.changeColumn('product_images', 'productId', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    // Drop UUID id columns from child tables
    await queryInterface.removeColumn('product_variants', 'id');
    await queryInterface.removeColumn('product_images', 'id');

    // Add back integer id columns for child tables
    await queryInterface.addColumn('product_variants', 'id', {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    });

    await queryInterface.addColumn('product_images', 'id', {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    });

    // Rename new_id to id for products
    await queryInterface.renameColumn('products', 'new_id', 'id');

    // Add primary key constraints back
    await queryInterface.addConstraint('products', {
      fields: ['id'],
      type: 'primary key',
      name: 'products_pkey',
    });

    await queryInterface.addConstraint('product_variants', {
      fields: ['id'],
      type: 'primary key',
      name: 'product_variants_pkey',
    });

    await queryInterface.addConstraint('product_images', {
      fields: ['id'],
      type: 'primary key',
      name: 'product_images_pkey',
    });

    // Re-add foreign key constraints
    await queryInterface.addConstraint('product_variants', {
      fields: ['productId'],
      type: 'foreign key',
      name: 'product_variants_productId_fkey',
      references: {
        table: 'products',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('product_images', {
      fields: ['productId'],
      type: 'foreign key',
      name: 'product_images_productId_fkey',
      references: {
        table: 'products',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  }
};
