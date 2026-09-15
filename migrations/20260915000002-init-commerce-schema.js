'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const list = tables.map((t) => (typeof t === 'object' ? t.tableName : t));

    if (!list.includes('carts')) {
      await queryInterface.createTable('carts', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    if (!list.includes('cart_items')) {
      await queryInterface.createTable('cart_items', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        cartId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'carts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        productId: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        variantId: { type: Sequelize.UUID, allowNull: false, references: { model: 'product_variants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('cart_items', ['cartId']);
    }

    if (!list.includes('orders')) {
      await queryInterface.createTable('orders', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        total: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        status: { type: Sequelize.ENUM('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'), defaultValue: 'pending' },
        shippingAddress: { type: Sequelize.TEXT, allowNull: true },
        billingAddress: { type: Sequelize.TEXT, allowNull: true },
        paymentMethod: { type: Sequelize.STRING, allowNull: true },
        paymentStatus: { type: Sequelize.STRING, allowNull: false, defaultValue: 'pending' },
        paymentProviderId: { type: Sequelize.UUID, allowNull: true },
        merchantOrderId: { type: Sequelize.STRING, allowNull: true },
        paymentDetails: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
        cancellationReason: { type: Sequelize.TEXT, allowNull: true },
        trackingUrl: { type: Sequelize.STRING, allowNull: true },
        shippingAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
        estimatedDeliveryDays: { type: Sequelize.INTEGER, allowNull: true },
        shipmentProviderId: { type: Sequelize.UUID, allowNull: true },
        courierCompanyId: { type: Sequelize.STRING, allowNull: true },
        courierName: { type: Sequelize.STRING, allowNull: true },
        shiprocketOrderId: { type: Sequelize.STRING, allowNull: true },
        shiprocketShipmentId: { type: Sequelize.STRING, allowNull: true },
        awbCode: { type: Sequelize.STRING, allowNull: true },
        shipmentStatus: { type: Sequelize.STRING, allowNull: true },
        shipmentDetails: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('orders', ['userId']);
      await queryInterface.addIndex('orders', ['status']);
    }

    if (!list.includes('order_items')) {
      await queryInterface.createTable('order_items', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        orderId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'orders', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        productId: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        variantId: { type: Sequelize.UUID, allowNull: false, references: { model: 'product_variants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        quantity: { type: Sequelize.INTEGER, allowNull: false },
        price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        costPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('order_items', ['orderId']);
    }

    if (!list.includes('wishlist_items')) {
      await queryInterface.createTable('wishlist_items', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        productId: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('wishlist_items', ['userId', 'productId'], { unique: true, name: 'wishlist_items_user_product_unique' });
    }

    if (!list.includes('addresses')) {
      await queryInterface.createTable('addresses', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        full_name: { type: Sequelize.STRING, allowNull: false },
        street_address: { type: Sequelize.STRING, allowNull: false },
        apartment: { type: Sequelize.STRING, allowNull: true },
        city: { type: Sequelize.STRING, allowNull: false },
        state: { type: Sequelize.STRING, allowNull: true },
        zip_code: { type: Sequelize.STRING, allowNull: true },
        country: { type: Sequelize.STRING, allowNull: false, defaultValue: 'India' },
        phone: { type: Sequelize.STRING, allowNull: true },
        is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('addresses', ['user_id']);
      await queryInterface.addIndex('addresses', ['user_id', 'is_default']);
    }

    if (!list.includes('pickup_locations')) {
      await queryInterface.createTable('pickup_locations', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        name: { type: Sequelize.STRING, allowNull: false },
        street_address: { type: Sequelize.STRING, allowNull: false },
        apartment: { type: Sequelize.STRING, allowNull: true },
        city: { type: Sequelize.STRING, allowNull: false },
        state: { type: Sequelize.STRING, allowNull: true },
        zip_code: { type: Sequelize.STRING, allowNull: true },
        country: { type: Sequelize.STRING, allowNull: false, defaultValue: 'India' },
        phone: { type: Sequelize.STRING, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('pickup_locations');
    await queryInterface.dropTable('addresses');
    await queryInterface.dropTable('wishlist_items');
    await queryInterface.dropTable('order_items');
    await queryInterface.dropTable('orders');
    await queryInterface.dropTable('cart_items');
    await queryInterface.dropTable('carts');
  },
};
