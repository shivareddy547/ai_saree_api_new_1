const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
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
router.put('/profile', authMiddleware, userController.updateProfile);
router.put('/change-password', authMiddleware, userController.changePassword);
router.get('/admin/all', authMiddleware, requireAdmin, userController.getUsersAdmin);
router.get('/admin/:id', authMiddleware, requireAdmin, userController.getUserAdmin);
router.patch('/admin/:id/status', authMiddleware, requireAdmin, userController.updateUserStatusAdmin);
router.get('/admin/:id/orders', authMiddleware, requireAdmin, userController.getUserOrdersAdmin);
router.put('/admin/:id/addresses/:addressId', authMiddleware, requireAdmin, userController.updateAddressAdmin);
module.exports = router;
