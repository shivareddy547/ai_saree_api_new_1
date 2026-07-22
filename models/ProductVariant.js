const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ProductVariant extends Model {
    static associate(models) {
      // associations defined in index
    }
  }
  ProductVariant.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id',
      },
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    size: {
      type: DataTypes.STRING,
    },
    color: {
      type: DataTypes.STRING,
    },
    price: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
    },
    costPrice: {
      type: DataTypes.DECIMAL(10,2),
    },
    stockQuantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    sequelize,
    modelName: 'ProductVariant',
    tableName: 'product_variants',
  });
  return ProductVariant;
};
