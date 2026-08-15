const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class Provider extends Model {
    static associate(models) {}
  }
  Provider.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      provider_type: {
        type: DataTypes.ENUM('smtp', 'sms'),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      provider_key: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      is_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      credentials: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      sequelize,
      modelName: 'Provider',
      tableName: 'providers',
    }
  );
  return Provider;
};
