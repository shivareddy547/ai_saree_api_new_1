const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class Address extends Model {
    static associate(models) {
      Address.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
    }
  }
  Address.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      fullName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'full_name',
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
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_default',
      },
    },
    {
      sequelize,
      modelName: 'Address',
      tableName: 'addresses',
      timestamps: true,
      underscored: false,
    }
  );
  return Address;
};
