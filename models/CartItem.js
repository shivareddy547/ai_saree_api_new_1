const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class CartItem extends Model {
    static associate(models) {
      CartItem.belongsTo(models.Cart, { foreignKey: 'cartId', as: 'cart' });
      CartItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
      CartItem.belongsTo(models.ProductVariant, { foreignKey: 'variantId', as: 'variant' });
    }
  }
  CartItem.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    cartId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'carts',
        key: 'id',
      },
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
      allowNull: false,
      references: {
        model: 'product_variants',
        key: 'id',
      },
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  }, {
    sequelize,
    modelName: 'CartItem',
    tableName: 'cart_items',
    timestamps: true,
  });
  return CartItem;
};
