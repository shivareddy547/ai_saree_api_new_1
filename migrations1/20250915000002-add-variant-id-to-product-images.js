'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) =>
      typeof t === 'object' ? t.tableName : t
    );
    if (!tableList.includes('product_images')) return;
    if (!tableList.includes('product_variants')) return;

    const imageDesc = await queryInterface.describeTable('product_images');
    if (imageDesc.variantId) {
      return;
    }

    const variantDesc = await queryInterface.describeTable('product_variants');
    const variantIdType = (variantDesc.id && variantDesc.id.type) || 'UUID';
    const normalizedType = String(variantIdType).toUpperCase();
    const isUuid = normalizedType.includes('UUID');
    const isInteger = normalizedType.includes('INT');

    const columnType = isUuid
      ? Sequelize.UUID
      : isInteger
      ? Sequelize.INTEGER
      : Sequelize.STRING;

    await queryInterface.addColumn('product_images', 'variantId', {
      type: columnType,
      allowNull: true,
    });

    if (isUuid || isInteger) {
      try {
        await queryInterface.addConstraint('product_images', {
          fields: ['variantId'],
          type: 'foreign key',
          name: 'product_images_variantId_fkey',
          references: {
            table: 'product_variants',
            field: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        });
      } catch (fkErr) {
        console.warn(
          '[migration] Skipped FK on product_images.variantId:',
          fkErr.message
        );
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) =>
      typeof t === 'object' ? t.tableName : t
    );
    if (!tableList.includes('product_images')) return;

    const imageDesc = await queryInterface.describeTable('product_images');
    if (!imageDesc.variantId) return;

    try {
      await queryInterface.removeConstraint(
        'product_images',
        'product_images_variantId_fkey'
      );
    } catch (e) {
      // constraint not present
    }

    await queryInterface.removeColumn('product_images', 'variantId');
  },
};
