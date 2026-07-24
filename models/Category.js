const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Category extends Model {
    static associate(models) {
      Category.hasMany(models.Subcategory, {
        foreignKey: 'categoryId',
        as: 'subcategories'
      });
      Category.hasMany(models.Product, {
        foreignKey: 'categoryId',
        as: 'products'
      });
    }
  }
  Category.init({
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'Category',
    tableName: 'categories',
  });
  return Category;
};
