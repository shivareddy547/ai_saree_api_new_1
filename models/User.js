const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Product, { foreignKey: 'userId', as: 'products' });
      User.hasOne(models.Cart, { foreignKey: 'userId', as: 'cart' });
      User.hasMany(models.Order, { foreignKey: 'userId', as: 'orders' });
      User.hasMany(models.WishlistItem, { foreignKey: 'userId', as: 'wishlist' });
      User.hasMany(models.UserVoice, { foreignKey: 'userId', as: 'voices' });
      if (models.Address) {
        User.hasMany(models.Address, { foreignKey: 'user_id', as: 'addresses' });
      }
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
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
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
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      defaultValue: 'user',
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    timestamps: true,
  });
  return User;
};
