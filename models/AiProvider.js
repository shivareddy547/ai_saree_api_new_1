const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class AiProvider extends Model {
    static associate(models) {
      AiProvider.hasMany(models.AiModel, {
        foreignKey: 'ai_provider_id',
        as: 'models',
      });
    }
  }
  AiProvider.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      api_key: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      api_secret: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      endpoint: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      organization_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      project_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      region: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      default_provider: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      timeout: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 60,
      },
      max_retries: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      sequelize,
      modelName: 'AiProvider',
      tableName: 'ai_providers',
    }
  );
  return AiProvider;
};
