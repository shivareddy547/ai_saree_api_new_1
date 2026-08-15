const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const authMiddleware = require('../middleware/authMiddleware');
const { optionalAuthMiddleware } = require('../middleware/authMiddleware');
/**
 * GET /api/cart
 * PUBLIC (optional auth):
 * - Logged in → user's cart
 * - Guest → empty cart (no 401)
 */
router.get('/', optionalAuthMiddleware, (req, res, next) => {
  if (!req.userId) {
    return res.status(200).json({
      success: true,
      data: [],
    });
  }
  return cartController.getCart(req, res, next);
});
// Mutations require auth
router.post('/items', authMiddleware, cartController.addItem);
router.put('/items/:id', authMiddleware, cartController.updateItem);
router.delete('/items/:id', authMiddleware, cartController.removeItem);
router.delete('/', authMiddleware, cartController.clearCart);
module.exports = router;
