const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class Subcategory extends Model {
    static associate(models) {
      Subcategory.belongsTo(models.Category, {
        foreignKey: 'categoryId',
        as: 'category'
      });
      Subcategory.hasMany(models.Product, {
        foreignKey: 'subcategoryId',
        as: 'products'
      });
    }
  }
  Subcategory.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'categories',
        key: 'id',
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'Subcategory',
    tableName: 'subcategories',
    timestamps: true,
  });
  return Subcategory;
};
