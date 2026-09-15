'use strict';
// NOTE: user_voices table is created by 20250915000004-create-user-voices-table.js.
// This migration is intentionally idempotent to avoid "relation already exists".
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (tableList.includes('user_voices')) return;
    await queryInterface.createTable('user_voices', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      userId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      sampleAudioUrl: { type: Sequelize.STRING, allowNull: true },
      voiceProviderData: { type: Sequelize.JSON, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (tableList.includes('user_voices')) {
      await queryInterface.dropTable('user_voices');
    }
  },
};
