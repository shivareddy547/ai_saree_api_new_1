'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add showInCategoryGrid column
    await queryInterface.addColumn('categories', 'showInCategoryGrid', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    // Add showInHero column
    await queryInterface.addColumn('categories', 'showInHero', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    // Add permalink column with unique constraint
    await queryInterface.addColumn('categories', 'permalink', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });
    // Add primaryButtonText column
    await queryInterface.addColumn('categories', 'primaryButtonText', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    // Add primaryButtonLink column
    await queryInterface.addColumn('categories', 'primaryButtonLink', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    // Add secondaryButtonText column
    await queryInterface.addColumn('categories', 'secondaryButtonText', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    // Add secondaryButtonLink column
    await queryInterface.addColumn('categories', 'secondaryButtonLink', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    // Remove columns in reverse order
    await queryInterface.removeColumn('categories', 'secondaryButtonLink');
    await queryInterface.removeColumn('categories', 'secondaryButtonText');
    await queryInterface.removeColumn('categories', 'primaryButtonLink');
    await queryInterface.removeColumn('categories', 'primaryButtonText');
    await queryInterface.removeColumn('categories', 'permalink');
    await queryInterface.removeColumn('categories', 'showInHero');
    await queryInterface.removeColumn('categories', 'showInCategoryGrid');
  }
};
