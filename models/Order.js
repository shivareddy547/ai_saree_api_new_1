const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class Order extends Model {
    static associate(models) {
      Order.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      Order.hasMany(models.OrderItem, { foreignKey: 'orderId', as: 'items' });
    }
  }
  Order.init(
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
      total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
        defaultValue: 'pending',
      },
      shippingAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      billingAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      paymentMethod: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      paymentStatus: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
      paymentProviderId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      merchantOrderId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      paymentDetails: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      cancellationReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      trackingUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      shippingAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      estimatedDeliveryDays: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      shipmentProviderId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      courierCompanyId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      courierName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      shiprocketOrderId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      shiprocketShipmentId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      awbCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      shipmentStatus: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      shipmentDetails: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
    },
    {
      sequelize,
      modelName: 'Order',
      tableName: 'orders',
      timestamps: true,
    }
  );
  return Order;
};
