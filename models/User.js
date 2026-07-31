const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Product, {
        foreignKey: 'userId',
        as: 'products'
      });
    }
  }
  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    otp: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    otpExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    instagramAccessToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    instagramAccountId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    instagramUsername: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    instagramAccountType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    instagramTokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
  });
  return User;
};
