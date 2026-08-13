const cartService = require('../services/cartService');
const getCart = async (req, res) => {
  try {
    const cart = await cartService.getCart(req.user.id);
    res.json({
      success: true,
      data: cart,
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to get cart',
    });
  }
};
const addItem = async (req, res) => {
  try {
    const { productId, variantId, quantity } = req.body;
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'productId is required',
      });
    }
    const cart = await cartService.addItem(
      req.user.id,
      productId,
      variantId || null,
      quantity != null ? parseInt(quantity, 10) : 1
    );
    res.status(201).json({
      success: true,
      data: cart,
      message: 'Item added to cart',
    });
  } catch (error) {
    console.error('Add cart item error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to add item to cart',
    });
  }
};
const updateItem = async (req, res) => {
  try {
    const cartItemId = parseInt(req.params.id, 10);
    const { quantity } = req.body;
    if (quantity === undefined || quantity === null) {
      return res.status(400).json({
        success: false,
        message: 'quantity is required',
      });
    }
    const cart = await cartService.updateItemQuantity(
      req.user.id,
      cartItemId,
      parseInt(quantity, 10)
    );
    res.json({
      success: true,
      data: cart,
      message: 'Cart item updated',
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to update cart item',
    });
  }
};
const removeItem = async (req, res) => {
  try {
    const cartItemId = parseInt(req.params.id, 10);
    const cart = await cartService.removeItem(req.user.id, cartItemId);
    res.json({
      success: true,
      data: cart,
      message: 'Item removed from cart',
    });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to remove cart item',
    });
  }
};
const clearCart = async (req, res) => {
  try {
    const cart = await cartService.clearCart(req.user.id);
    res.json({
      success: true,
      data: cart,
      message: 'Cart cleared',
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to clear cart',
    });
  }
};
module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
};
