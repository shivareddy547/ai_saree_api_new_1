const { Cart, CartItem, Product, ProductVariant, ProductImage, sequelize } = require('../models');
class CartService {
  async getOrCreateCart(userId) {
    let cart = await Cart.findOne({ where: { userId } });
    if (!cart) {
      cart = await Cart.create({ userId });
    }
    return cart;
  }
  async getCart(userId) {
    const cart = await this.getOrCreateCart(userId);
    const items = await CartItem.findAll({
      where: { cartId: cart.id },
      include: [
        {
          model: Product,
          as: 'product',
          include: [
            { model: ProductImage, as: 'images', limit: 1 },
          ],
        },
        {
          model: ProductVariant,
          as: 'variant',
        },
      ],
    });
    return { cart, items };
  }
  async addItem(userId, productId, variantId, quantity = 1) {
    const cart = await this.getOrCreateCart(userId);
    let existing = await CartItem.findOne({
      where: { cartId: cart.id, productId, variantId },
    });
    if (existing) {
      existing.quantity += quantity;
      await existing.save();
      return existing;
    } else {
      const item = await CartItem.create({
        cartId: cart.id,
        productId,
        variantId,
        quantity,
      });
      return item;
    }
  }
  async updateItem(userId, cartItemId, quantity) {
    const cart = await this.getOrCreateCart(userId);
    const item = await CartItem.findOne({
      where: { id: cartItemId, cartId: cart.id },
    });
    if (!item) {
      const err = new Error('Cart item not found');
      err.status = 404;
      throw err;
    }
    if (quantity <= 0) {
      await item.destroy();
      return null;
    }
    item.quantity = quantity;
    await item.save();
    return item;
  }
  async removeItem(userId, cartItemId) {
    const cart = await this.getOrCreateCart(userId);
    const item = await CartItem.findOne({
      where: { id: cartItemId, cartId: cart.id },
    });
    if (!item) {
      const err = new Error('Cart item not found');
      err.status = 404;
      throw err;
    }
    await item.destroy();
    return { success: true };
  }
  async clearCart(userId) {
    const cart = await this.getOrCreateCart(userId);
    await CartItem.destroy({ where: { cartId: cart.id } });
    return { success: true };
  }
}
module.exports = new CartService();
