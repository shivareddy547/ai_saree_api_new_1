const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class WishlistItem extends Model {
    static associate(models) {
      WishlistItem.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      WishlistItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    }
  }
  WishlistItem.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
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
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id',
        },
      },
    },
    {
      sequelize,
      modelName: 'WishlistItem',
      tableName: 'wishlist_items',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['userId', 'productId'],
        },
      ],
    }
  );
  return WishlistItem;
};
