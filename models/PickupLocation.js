const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class PickupLocation extends Model {
    static associate(models) {}
  }
  PickupLocation.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'name',
      },
      streetAddress: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'street_address',
      },
      apartment: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'apartment',
      },
      city: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'city',
      },
      state: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'state',
      },
      zipCode: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'zip_code',
      },
      country: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'India',
        field: 'country',
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'phone',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_default',
      },
    },
    {
      sequelize,
      modelName: 'PickupLocation',
      tableName: 'pickup_locations',
      timestamps: true,
      underscored: false,
    }
  );
  return PickupLocation;
};
