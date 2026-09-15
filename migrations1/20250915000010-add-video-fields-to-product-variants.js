'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) =>
      typeof t === 'object' ? t.tableName : t
    );
    if (!tableList.includes('product_variants')) {
      return;
    }

    const description = await queryInterface.describeTable('product_variants');

    if (!description.videoUrl) {
      await queryInterface.addColumn('product_variants', 'videoUrl', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!description.cloudinaryVideoPublicId) {
      await queryInterface.addColumn(
        'product_variants',
        'cloudinaryVideoPublicId',
        {
          type: Sequelize.STRING,
          allowNull: true,
        }
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) =>
      typeof t === 'object' ? t.tableName : t
    );
    if (!tableList.includes('product_variants')) {
      return;
    }

    const description = await queryInterface.describeTable('product_variants');
    if (description.videoUrl) {
      await queryInterface.removeColumn('product_variants', 'videoUrl');
    }
    if (description.cloudinaryVideoPublicId) {
      await queryInterface.removeColumn(
        'product_variants',
        'cloudinaryVideoPublicId'
      );
    }
  },
};
