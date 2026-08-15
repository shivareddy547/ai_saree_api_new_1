const { Cart, CartItem, Product, ProductVariant, ProductImage } = require('../models');
class CartService {
  async getOrCreateCart(userId) {
    let cart = await Cart.findOne({ where: { userId } });
    if (!cart) {
      cart = await Cart.create({ userId });
    }
    return cart;
  }
  async getCart(userId) {
    if (!userId) return [];
    const cart = await this.getOrCreateCart(userId);
    const items = await CartItem.findAll({
      where: { cartId: cart.id },
      include: [
        {
          model: Product,
          as: 'product',
          include: [
            {
              model: ProductImage,
              as: 'images',
              limit: 1,
              attributes: ['url'],
            },
          ],
        },
        {
          model: ProductVariant,
          as: 'variant',
        },
      ],
      order: [['createdAt', 'ASC']],
    });
    return items;
  }
  async addItem(userId, productId, variantId, quantity = 1) {
    const cart = await this.getOrCreateCart(userId);
    let resolvedVariantId = variantId;
    if (!resolvedVariantId) {
      const firstVariant = await ProductVariant.findOne({
        where: { productId },
        order: [['createdAt', 'ASC']],
      });
      if (!firstVariant) {
        const err = new Error('Product has no variants');
        err.status = 400;
        throw err;
      }
      resolvedVariantId = firstVariant.id;
    }
    const existing = await CartItem.findOne({
      where: {
        cartId: cart.id,
        productId,
        variantId: resolvedVariantId,
      },
    });
    if (existing) {
      existing.quantity = (existing.quantity || 0) + quantity;
      await existing.save();
    } else {
      await CartItem.create({
        cartId: cart.id,
        productId,
        variantId: resolvedVariantId,
        quantity,
      });
    }
    return this.getCart(userId);
  }
  async updateItem(userId, itemId, quantity) {
    const cart = await this.getOrCreateCart(userId);
    const item = await CartItem.findOne({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) {
      const err = new Error('Cart item not found');
      err.status = 404;
      throw err;
    }
    if (quantity <= 0) {
      await item.destroy();
    } else {
      item.quantity = quantity;
      await item.save();
    }
    return this.getCart(userId);
  }
  async removeItem(userId, itemId) {
    const cart = await this.getOrCreateCart(userId);
    const item = await CartItem.findOne({
      where: { id: itemId, cartId: cart.id },
    });
    if (item) {
      await item.destroy();
    }
    return this.getCart(userId);
  }
  async clearCart(userId) {
    const cart = await Cart.findOne({ where: { userId } });
    if (cart) {
      await CartItem.destroy({ where: { cartId: cart.id } });
    }
    return [];
  }
}
module.exports = new CartService();
