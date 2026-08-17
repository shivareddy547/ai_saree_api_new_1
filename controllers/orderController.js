const orderService = require('../services/orderService');

class OrderController {
  async createOrder(req, res, next) {
    try {
      const userId = req.user.id;
      const { shippingAddress, billingAddress, paymentMethod } = req.body;

      if (!shippingAddress) {
        const err = new Error('Shipping address is required');
        err.status = 400;
        throw err;
      }

      const order = await orderService.createOrder(
        userId,
        shippingAddress,
        paymentMethod,
        billingAddress || shippingAddress
      );

      res.status(201).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  async getOrders(req, res, next) {
    try {
      const userId = req.user.id;
      const orders = await orderService.getOrders(userId);
      res.status(200).json({ success: true, data: orders });
    } catch (error) {
      next(error);
    }
  }

  async getOrder(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const order = await orderService.getOrder(userId, id);
      res.status(200).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();
