'use strict';
// NOTE: generated_videos table is created by 20250915000005-create-generated-videos-table.js.
// Idempotent to avoid "relation already exists".
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (tableList.includes('generated_videos')) return;
    await queryInterface.createTable('generated_videos', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      userId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      title: { type: Sequelize.STRING, allowNull: true },
      videoUrl: { type: Sequelize.STRING, allowNull: true },
      thumbnailUrl: { type: Sequelize.STRING, allowNull: true },
      imageUrls: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      audioMode: { type: Sequelize.ENUM('none', 'upload', 'ai', 'recorded'), allowNull: false, defaultValue: 'none' },
      audioUrl: { type: Sequelize.STRING, allowNull: true },
      audioScript: { type: Sequelize.TEXT, allowNull: true },
      audioLanguage: { type: Sequelize.STRING, allowNull: true },
      voiceGender: { type: Sequelize.ENUM('male', 'female', 'neutral'), allowNull: true },
      durationSeconds: { type: Sequelize.INTEGER, allowNull: true },
      status: { type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'), allowNull: false, defaultValue: 'pending' },
      errorMessage: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableList = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (tableList.includes('generated_videos')) {
      await queryInterface.dropTable('generated_videos');
    }
  },
};
