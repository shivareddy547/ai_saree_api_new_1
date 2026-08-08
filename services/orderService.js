const { Order, OrderItem, CartItem, Product, ProductVariant, sequelize } = require('../models');
const cartService = require('./cartService');
class OrderService {
  async createOrder(userId, shippingAddress, paymentMethod) {
    const transaction = await sequelize.transaction();
    try {
      const { items } = await cartService.getCart(userId);
      if (!items || items.length === 0) {
        const err = new Error('Cart is empty');
        err.status = 400;
        throw err;
      }
      let total = 0;
      const orderItemsData = [];
      for (const item of items) {
        const variant = item.variant;
        const price = parseFloat(variant.price);
        const costPrice = variant.costPrice ? parseFloat(variant.costPrice) : null;
        const itemTotal = price * item.quantity;
        total += itemTotal;
        orderItemsData.push({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          price: price,
          costPrice: costPrice,
        });
      }
      const order = await Order.create({
        userId,
        total,
        status: 'pending',
        shippingAddress,
        paymentMethod,
      }, { transaction });
      for (const data of orderItemsData) {
        await OrderItem.create({
          ...data,
          orderId: order.id,
        }, { transaction });
      }
      await cartService.clearCart(userId);
      await transaction.commit();
      return order;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  async getOrders(userId) {
    return await Order.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            { model: Product, as: 'product' },
            { model: ProductVariant, as: 'variant' },
          ],
        },
      ],
    });
  }
  async getOrder(userId, orderId) {
    const order = await Order.findOne({
      where: { id: orderId, userId },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            { model: Product, as: 'product' },
            { model: ProductVariant, as: 'variant' },
          ],
        },
      ],
    });
    if (!order) {
      const err = new Error('Order not found');
      err.status = 404;
      throw err;
    }
    return order;
  }
}
module.exports = new OrderService();
