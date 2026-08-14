const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class ProductImage extends Model {
    static associate(models) {
      ProductImage.belongsTo(models.Product, {
        foreignKey: 'productId',
        as: 'product'
      });
      ProductImage.belongsTo(models.ProductVariant, {
        foreignKey: 'variantId',
        as: 'variant'
      });
    }
  }
  ProductImage.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id',
      },
    },
    variantId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'product_variants',
        key: 'id',
      },
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'ProductImage',
    tableName: 'product_images',
  });
  return ProductImage;
};
