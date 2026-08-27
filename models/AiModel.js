const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class AiModel extends Model {
    static associate(models) {
      AiModel.belongsTo(models.AiProvider, {
        foreignKey: 'ai_provider_id',
        as: 'provider',
      });
    }
  }
  AiModel.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      ai_provider_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      model_identifier: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      model_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      context_window: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      max_output_tokens: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      supports_streaming: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      supports_function_calling: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      supports_json_mode: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      supports_vision: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      sequelize,
      modelName: 'AiModel',
      tableName: 'ai_models',
    }
  );
  return AiModel;
};
