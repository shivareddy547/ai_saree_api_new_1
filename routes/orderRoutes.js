const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
  next();
};
router.use(authMiddleware);
router.get('/payment-providers', orderController.getPaymentProviders);
router.post('/shipping-rates', orderController.getShippingRates);
router.get('/shipment-providers', requireAdmin, orderController.getShipmentProviders);
router.get('/admin/all', requireAdmin, orderController.getAllOrdersAdmin);
router.get('/admin/:id', requireAdmin, orderController.getOrderAdmin);
router.post('/admin/:id/cancel', requireAdmin, orderController.cancelOrderAdmin);
router.post('/admin/:id/ship', requireAdmin, orderController.shipOrderAdmin);
router.patch('/admin/:id/status', requireAdmin, orderController.updateOrderStatusAdmin);
router.post('/admin/:id/shipment/refresh', requireAdmin, orderController.refreshShipmentStatus);
router.post('/admin/:id/shipment/cancel', requireAdmin, orderController.cancelShipmentAdmin);
router.post('/admin/:id/shipment/create', requireAdmin, orderController.createShipmentAdmin);
router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrder);
router.post('/', orderController.createOrder);
router.post('/:id/verify-payment', orderController.verifyPayment);
module.exports = router;
