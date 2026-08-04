'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, check if columns exist before adding them
    const tableInfo = await queryInterface.describeTable('categories');
    // Add subtitle column
    if (!tableInfo.subtitle) {
      await queryInterface.addColumn('categories', 'subtitle', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    // Add highlightText column
    if (!tableInfo.highlightText) {
      await queryInterface.addColumn('categories', 'highlightText', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    // Add description column
    if (!tableInfo.description) {
      await queryInterface.addColumn('categories', 'description', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    // Add imageUrl column
    if (!tableInfo.imageUrl) {
      await queryInterface.addColumn('categories', 'imageUrl', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    // Add bgGradient column
    if (!tableInfo.bgGradient) {
      await queryInterface.addColumn('categories', 'bgGradient', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'bg-gradient-to-r from-purple-500 to-indigo-500',
      });
    }
    // Add badgeText column
    if (!tableInfo.badgeText) {
      await queryInterface.addColumn('categories', 'badgeText', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    // Add badgeIcon column
    if (!tableInfo.badgeIcon) {
      await queryInterface.addColumn('categories', 'badgeIcon', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    // Add order column
    if (!tableInfo.order) {
      await queryInterface.addColumn('categories', 'order', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
    // Add isActive column
    if (!tableInfo.isActive) {
      await queryInterface.addColumn('categories', 'isActive', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
    // Add parentId column (FOREIGN KEY to categories table)
    if (!tableInfo.parentId) {
      await queryInterface.addColumn('categories', 'parentId', {
        type: Sequelize.UUID,
        allowNull: true,
      });
      // Add foreign key constraint
      await queryInterface.addConstraint('categories', {
        fields: ['parentId'],
        type: 'foreign key',
        name: 'categories_parentId_fkey',
        references: {
          table: 'categories',
          field: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
    // Add showInCategoryGrid column
    if (!tableInfo.showInCategoryGrid) {
      await queryInterface.addColumn('categories', 'showInCategoryGrid', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
    // Add showInHero column
    if (!tableInfo.showInHero) {
      await queryInterface.addColumn('categories', 'showInHero', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    // Add permalink column
    if (!tableInfo.permalink) {
      await queryInterface.addColumn('categories', 'permalink', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      });
    }
    // Add primaryButtonText column
    if (!tableInfo.primaryButtonText) {
      await queryInterface.addColumn('categories', 'primaryButtonText', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    // Add primaryButtonLink column
    if (!tableInfo.primaryButtonLink) {
      await queryInterface.addColumn('categories', 'primaryButtonLink', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    // Add secondaryButtonText column
    if (!tableInfo.secondaryButtonText) {
      await queryInterface.addColumn('categories', 'secondaryButtonText', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    // Add secondaryButtonLink column
    if (!tableInfo.secondaryButtonLink) {
      await queryInterface.addColumn('categories', 'secondaryButtonLink', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    // Update id column type from STRING to UUID if it's not already UUID
    if (tableInfo.id.type !== 'UUID') {
      // First create a new UUID column
      await queryInterface.addColumn('categories', 'new_id', {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      });
      // Copy data from old id to new id
      await queryInterface.sequelize.query(`
        UPDATE categories SET new_id = gen_random_uuid() WHERE new_id IS NULL;
      `);
      // Remove old primary key constraint
      await queryInterface.removeConstraint('categories', 'categories_pkey');
      // Drop old id column
      await queryInterface.removeColumn('categories', 'id');
      // Rename new_id to id
      await queryInterface.renameColumn('categories', 'new_id', 'id');
      // Add primary key constraint to new id
      await queryInterface.addConstraint('categories', {
        fields: ['id'],
        type: 'primary key',
        name: 'categories_pkey',
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    // Remove foreign key constraint first
    try {
      await queryInterface.removeConstraint('categories', 'categories_parentId_fkey');
    } catch (error) {
      // Constraint might not exist
    }
    // Remove columns in reverse order
    await queryInterface.removeColumn('categories', 'secondaryButtonLink');
    await queryInterface.removeColumn('categories', 'secondaryButtonText');
    await queryInterface.removeColumn('categories', 'primaryButtonLink');
    await queryInterface.removeColumn('categories', 'primaryButtonText');
    await queryInterface.removeColumn('categories', 'permalink');
    await queryInterface.removeColumn('categories', 'showInHero');
    await queryInterface.removeColumn('categories', 'showInCategoryGrid');
    await queryInterface.removeColumn('categories', 'parentId');
    await queryInterface.removeColumn('categories', 'isActive');
    await queryInterface.removeColumn('categories', 'order');
    await queryInterface.removeColumn('categories', 'badgeIcon');
    await queryInterface.removeColumn('categories', 'badgeText');
    await queryInterface.removeColumn('categories', 'bgGradient');
    await queryInterface.removeColumn('categories', 'imageUrl');
    await queryInterface.removeColumn('categories', 'description');
    await queryInterface.removeColumn('categories', 'highlightText');
    await queryInterface.removeColumn('categories', 'subtitle');
    // Revert id column change if needed
    const tableInfo = await queryInterface.describeTable('categories');
    if (tableInfo.id.type === 'UUID') {
      await queryInterface.addColumn('categories', 'old_id', {
        type: Sequelize.STRING,
      });
      await queryInterface.sequelize.query(`
        UPDATE categories SET old_id = id::text;
      `);
      await queryInterface.removeConstraint('categories', 'categories_pkey');
      await queryInterface.removeColumn('categories', 'id');
      await queryInterface.renameColumn('categories', 'old_id', 'id');
      await queryInterface.addConstraint('categories', {
        fields: ['id'],
        type: 'primary key',
        name: 'categories_pkey',
      });
    }
  }
};
