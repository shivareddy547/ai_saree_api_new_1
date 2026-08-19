const orderService = require('../services/orderService');
const paymentService = require('../services/paymentService');
const shipmentService = require('../services/shipmentService');
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
        shippingAmount,
        estimatedDeliveryDays,
        shipmentProviderId,
        courierCompanyId,
        courierName,
        shippingAddressObj,
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
        redirectBaseUrl || null,
        {
          shippingAmount,
          estimatedDeliveryDays,
          shipmentProviderId,
          courierCompanyId,
          courierName,
          shippingAddressObj: shippingAddressObj || {},
        }
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
  async getShippingRates(req, res, next) {
    try {
      const { deliveryPincode, weight, cod, declaredValue } = req.body;
      const result = await shipmentService.getShippingRates({
        deliveryPincode,
        weight,
        cod: !!cod,
        declaredValue: declaredValue || 0,
      });
      res.status(200).json({
        success: true,
        data: result,
        message: 'Shipping rates fetched',
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
  async getAllOrdersAdmin(req, res, next) {
    try {
      const filters = {
        status: req.query.status || undefined,
        paymentStatus: req.query.paymentStatus || undefined,
        search: req.query.search || undefined,
        startDate: req.query.startDate || undefined,
        endDate: req.query.endDate || undefined,
        page: req.query.page || 1,
        limit: req.query.limit || 20,
      };
      const result = await orderService.getAllOrdersAdmin(filters);
      res.status(200).json({
        success: true,
        data: result.orders,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
  async getOrderAdmin(req, res, next) {
    try {
      const { id } = req.params;
      const order = await orderService.getOrderAdmin(id);
      res.status(200).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }
  async cancelOrderAdmin(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const order = await orderService.cancelOrderAdmin(id, reason);
      res.status(200).json({
        success: true,
        data: order,
        message: 'Order cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  }
  async shipOrderAdmin(req, res, next) {
    try {
      const { id } = req.params;
      const { trackingUrl } = req.body;
      const order = await orderService.shipOrderAdmin(id, trackingUrl);
      res.status(200).json({
        success: true,
        data: order,
        message: 'Order marked as shipped',
      });
    } catch (error) {
      next(error);
    }
  }
  async updateOrderStatusAdmin(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const order = await orderService.updateOrderStatusAdmin(id, status);
      res.status(200).json({
        success: true,
        data: order,
        message: 'Order status updated',
      });
    } catch (error) {
      next(error);
    }
  }
  async refreshShipmentStatus(req, res, next) {
    try {
      const { id } = req.params;
      const order = await orderService.refreshShipmentStatus(id);
      res.status(200).json({
        success: true,
        data: order,
        message: 'Shipment status refreshed',
      });
    } catch (error) {
      next(error);
    }
  }
  async cancelShipmentAdmin(req, res, next) {
    try {
      const { id } = req.params;
      const order = await orderService.cancelShipmentAdmin(id);
      res.status(200).json({
        success: true,
        data: order,
        message: 'Shipment cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  }
  async createShipmentAdmin(req, res, next) {
    try {
      const { id } = req.params;
      const {
        courierCompanyId,
        courierName,
        shipmentProviderId,
        shippingAmount,
        estimatedDeliveryDays,
        shippingAddressObj,
      } = req.body;
      const order = await orderService.createShipmentAdmin(id, {
        courierCompanyId,
        courierName,
        shipmentProviderId,
        shippingAmount,
        estimatedDeliveryDays,
        shippingAddressObj,
      });
      res.status(200).json({
        success: true,
        data: order,
        message: 'Shipment created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
  async getShipmentProviders(req, res, next) {
    try {
      const providers = await shipmentService.getEnabledShipmentProviders();
      res.status(200).json({
        success: true,
        data: providers,
        message: 'Shipment providers fetched',
      });
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new OrderController();
