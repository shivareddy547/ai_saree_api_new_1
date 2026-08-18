const orderService = require('../services/orderService');
const paymentService = require('../services/paymentService');
class OrderController {
  async createOrder(req, res, next) {
    try {
      const userId = req.user.id;
      const {
        shippingAddress,
        billingAddress,
        paymentMethod,
        paymentProviderId,
        redirectBaseUrl,
      } = req.body;
      if (!shippingAddress) {
        const err = new Error('Shipping address is required');
        err.status = 400;
        throw err;
      }
      const result = await orderService.createOrder(
        userId,
        shippingAddress,
        paymentMethod,
        billingAddress || shippingAddress,
        paymentProviderId || null,
        redirectBaseUrl || null
      );
      res.status(201).json({
        success: true,
        data: result.order,
        paymentRequired: result.paymentRequired || false,
        redirectUrl: result.redirectUrl || null,
        message: result.paymentRequired
          ? 'Order created. Redirect to payment gateway.'
          : 'Order placed successfully',
      });
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
  async getPaymentProviders(req, res, next) {
    try {
      const providers = await paymentService.getEnabledPaymentProviders();
      res.status(200).json({
        success: true,
        data: providers,
        message: 'Payment providers fetched',
      });
    } catch (error) {
      next(error);
    }
  }
  async verifyPayment(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const result = await orderService.verifyPayment(userId, id);
      res.status(200).json({
        success: true,
        data: {
          paid: result.paid,
          state: result.state,
          order: result.order,
        },
        message: result.paid ? 'Payment successful' : 'Payment not completed yet',
      });
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new OrderController();
