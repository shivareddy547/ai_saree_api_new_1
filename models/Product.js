const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class Product extends Model {
    static associate(models) {
      // associations defined in index
    }
  }
  Product.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
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
