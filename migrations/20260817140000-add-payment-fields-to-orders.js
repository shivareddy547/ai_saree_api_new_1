'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('orders', 'paymentStatus', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'pending',
    });
    await queryInterface.addColumn('orders', 'paymentProviderId', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'merchantOrderId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'paymentDetails', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('orders', 'paymentStatus');
    await queryInterface.removeColumn('orders', 'paymentProviderId');
    await queryInterface.removeColumn('orders', 'merchantOrderId');
    await queryInterface.removeColumn('orders', 'paymentDetails');
  },
};
