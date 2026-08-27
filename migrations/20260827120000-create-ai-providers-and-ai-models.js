'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ai_providers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      api_key: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      api_secret: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      endpoint: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      organization_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      project_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      region: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      default_provider: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      timeout: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 60,
      },
      max_retries: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
    await queryInterface.createTable('ai_models', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      ai_provider_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'ai_providers',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      model_identifier: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      model_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      context_window: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      max_output_tokens: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      supports_streaming: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      supports_function_calling: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      supports_json_mode: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      supports_vision: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
    await queryInterface.addIndex('ai_providers', ['provider']);
    await queryInterface.addIndex('ai_providers', ['enabled']);
    await queryInterface.addIndex('ai_providers', ['default_provider']);
    await queryInterface.addIndex('ai_models', ['ai_provider_id']);
    await queryInterface.addIndex('ai_models', ['model_type']);
    await queryInterface.addIndex('ai_models', ['enabled']);
    await queryInterface.addIndex('ai_models', ['is_default']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('ai_models');
    await queryInterface.dropTable('ai_providers');
  },
};
