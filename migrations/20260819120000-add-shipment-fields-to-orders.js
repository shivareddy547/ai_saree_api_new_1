'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('orders', 'shippingAmount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('orders', 'estimatedDeliveryDays', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'shipmentProviderId', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'courierCompanyId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'courierName', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'shiprocketOrderId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'shiprocketShipmentId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'awbCode', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'shipmentStatus', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'shipmentDetails', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('orders', 'shippingAmount');
    await queryInterface.removeColumn('orders', 'estimatedDeliveryDays');
    await queryInterface.removeColumn('orders', 'shipmentProviderId');
    await queryInterface.removeColumn('orders', 'courierCompanyId');
    await queryInterface.removeColumn('orders', 'courierName');
    await queryInterface.removeColumn('orders', 'shiprocketOrderId');
    await queryInterface.removeColumn('orders', 'shiprocketShipmentId');
    await queryInterface.removeColumn('orders', 'awbCode');
    await queryInterface.removeColumn('orders', 'shipmentStatus');
    await queryInterface.removeColumn('orders', 'shipmentDetails');
  }
};
