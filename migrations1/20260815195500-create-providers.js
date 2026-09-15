'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (list.includes('providers')) return;
    await queryInterface.createTable('providers', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      provider_type: { type: Sequelize.ENUM('smtp', 'sms'), allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      provider_key: { type: Sequelize.STRING, allowNull: true },
      is_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      credentials: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));
    if (list.includes('providers')) await queryInterface.dropTable('providers');
  },
};
