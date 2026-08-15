const cartService = require('../services/cartService');
class CartController {
  async getCart(req, res, next) {
    try {
      const userId = req.userId || req.user?.id;
      if (!userId) {
        return res.status(200).json({ success: true, data: [] });
      }
      const items = await cartService.getCart(userId);
      res.status(200).json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }
  async addItem(req, res, next) {
    try {
      const userId = req.userId || req.user?.id;
      const { productId, variantId, quantity } = req.body;
      if (!productId) {
        const err = new Error('productId is required');
        err.status = 400;
        throw err;
      }
      const items = await cartService.addItem(
        userId,
        productId,
        variantId,
        quantity || 1
      );
      res.status(200).json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }
  async updateItem(req, res, next) {
    try {
      const userId = req.userId || req.user?.id;
      const { id } = req.params;
      const { quantity } = req.body;
      const items = await cartService.updateItem(userId, id, quantity);
      res.status(200).json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }
  async removeItem(req, res, next) {
    try {
      const userId = req.userId || req.user?.id;
      const { id } = req.params;
      const items = await cartService.removeItem(userId, id);
      res.status(200).json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }
  async clearCart(req, res, next) {
    try {
      const userId = req.userId || req.user?.id;
      await cartService.clearCart(userId);
      res.status(200).json({ success: true, data: [] });
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new CartController();
