const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class Product extends Model {
    static associate(models) {
      Product.hasMany(models.ProductVariant, {
        foreignKey: 'productId',
        as: 'variants'
      });
      Product.hasMany(models.ProductImage, {
        foreignKey: 'productId',
        as: 'images'
      });
      Product.belongsTo(models.Category, {
        foreignKey: 'categoryId',
        as: 'category'
      });
      Product.belongsTo(models.Subcategory, {
        foreignKey: 'subcategoryId',
        as: 'subcategory'
      });
      Product.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      });
    }
  }
  Product.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    basePrice: {
      type: DataTypes.DECIMAL(10,2),
    },
    defaultSku: {
      type: DataTypes.STRING,
    },
    categoryId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subcategoryId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    videoUrl: {
      type: DataTypes.STRING,
    },
    videoKitUrl: {
      type: DataTypes.STRING,
    },
    audioMode: {
      type: DataTypes.ENUM('text', 'upload', 'record'),
      defaultValue: 'text',
    },
    audioScript: {
      type: DataTypes.TEXT,
    },
    audioLanguage: {
      type: DataTypes.STRING,
    },
    voiceGender: {
      type: DataTypes.ENUM('female', 'male'),
    },
    videoLength: {
      type: DataTypes.INTEGER,
    },
    customAudioUrl: {
      type: DataTypes.STRING,
    },
    recordedAudioUrl: {
      type: DataTypes.STRING,
    },
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('draft', 'published'),
      defaultValue: 'draft',
    },
    cloudinaryVideoPublicId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cloudinaryAudioPublicId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'Product',
    tableName: 'products',
  });
  return Product;
};
