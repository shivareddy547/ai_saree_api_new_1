const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class Category extends Model {
    static associate(models) {
      Category.hasMany(models.Category, {
        foreignKey: 'parentId',
        as: 'subCategories',
        constraints: false
      });
      Category.belongsTo(models.Category, {
        foreignKey: 'parentId',
        as: 'parentCategory',
        constraints: false
      });
      Category.hasMany(models.Product, {
        foreignKey: 'categoryId',
        as: 'products'
      });
    }
  }
  Category.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subtitle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    highlightText: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bgGradient: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'bg-gradient-to-r from-purple-500 to-indigo-500',
    },
    badgeText: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    badgeIcon: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'id',
      },
    },
    showInCategoryGrid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    showInHero: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    permalink: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    primaryButtonText: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    primaryButtonLink: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    secondaryButtonText: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    secondaryButtonLink: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'Category',
    tableName: 'categories',
    timestamps: true,
  });
  return Category;
};
