const cartService = require('../services/cartService');
class CartController {
  async getCart(req, res, next) {
    try {
      const userId = req.user.id;
      const cartData = await cartService.getCart(userId);
      res.status(200).json({ success: true, data: cartData });
    } catch (error) {
      next(error);
    }
  }
  async addItem(req, res, next) {
    try {
      const userId = req.user.id;
      const { productId, variantId, quantity } = req.body;
      if (!productId || !variantId) {
        const err = new Error('Product ID and Variant ID are required');
        err.status = 400;
        throw err;
      }
      const item = await cartService.addItem(userId, productId, variantId, quantity || 1);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
  async updateItem(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { quantity } = req.body;
      if (!quantity || quantity < 0) {
        const err = new Error('Valid quantity is required');
        err.status = 400;
        throw err;
      }
      const item = await cartService.updateItem(userId, id, quantity);
      res.status(200).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
  async removeItem(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      await cartService.removeItem(userId, id);
      res.status(200).json({ success: true, message: 'Item removed' });
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new CartController();
