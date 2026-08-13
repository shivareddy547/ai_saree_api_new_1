const { Cart, CartItem, Product, ProductVariant, ProductImage, sequelize } = require('../models');
const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
};
/**
 * Resolve the price that should be used for a cart line:
 * 1) variant.price when > 0
 * 2) otherwise product.basePrice
 */
const resolvePrice = (variant, product) => {
  const variantPrice = toNumber(variant && variant.price);
  if (variantPrice > 0) return variantPrice;
  const basePrice = toNumber(product && product.basePrice);
  if (basePrice > 0) return basePrice;
  return variantPrice;
};
/**
 * Ensure the product has at least one variant.
 * For products with no variants (or only zero-price default rows),
 * create / update a default variant using product.basePrice.
 */
const ensureDefaultVariant = async (product, preferredVariantId = null) => {
  const variants = product.variants || [];
  // Prefer an explicitly requested variant that belongs to this product
  if (preferredVariantId) {
    const preferred = variants.find((v) => v.id === preferredVariantId);
    if (preferred) {
      const price = resolvePrice(preferred, product);
      if (toNumber(preferred.price) <= 0 && price > 0) {
        await preferred.update({ price });
        preferred.price = price;
      }
      return preferred;
    }
  }
  // Prefer any variant that already has a positive price
  const priced = variants.find((v) => toNumber(v.price) > 0);
  if (priced) return priced;
  // Prefer any existing variant (even if price is 0) and sync price from basePrice
  if (variants.length > 0) {
    const existing = variants[0];
    const price = resolvePrice(existing, product);
    if (toNumber(existing.price) <= 0 && price > 0) {
      await existing.update({ price });
      existing.price = price;
    }
    return existing;
  }
  // No variants at all — create a default one from product base data
  const price = toNumber(product.basePrice) || 0;
  const created = await ProductVariant.create({
    productId: product.id,
    sku: product.defaultSku || 'default',
    size: '',
    color: '',
    price,
    costPrice: product.costPrice != null ? product.costPrice : null,
    stockQuantity: product.stockQuantity != null ? product.stockQuantity : 0,
  });
  return created;
};
const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ where: { userId } });
  if (!cart) {
    cart = await Cart.create({ userId });
  }
  return cart;
};
const getCart = async (userId) => {
  const cart = await getOrCreateCart(userId);
  const fullCart = await Cart.findByPk(cart.id, {
    include: [
      {
        model: CartItem,
        as: 'items',
        include: [
          {
            model: Product,
            as: 'product',
            include: [{ model: ProductImage, as: 'images' }],
          },
          {
            model: ProductVariant,
            as: 'variant',
          },
        ],
      },
    ],
    order: [[{ model: CartItem, as: 'items' }, 'createdAt', 'DESC']],
  });
  // Normalize price on each item so clients always get a correct value
  if (fullCart && fullCart.items) {
    fullCart.items.forEach((item) => {
      const resolved = resolvePrice(item.variant, item.product);
      // Attach resolved price for API consumers (does not mutate DB)
      if (item.variant) {
        // Sequelize instance: set dataValues so JSON serialization picks it up
        item.variant.dataValues = item.variant.dataValues || {};
        item.variant.dataValues.price = resolved;
        item.variant.price = resolved;
      }
      item.dataValues = item.dataValues || {};
      item.dataValues.resolvedPrice = resolved;
    });
  }
  return fullCart;
};
const addItem = async (userId, productId, variantId, quantity = 1) => {
  if (!productId) {
    const err = new Error('productId is required');
    err.status = 400;
    throw err;
  }
  if (!quantity || quantity < 1) {
    const err = new Error('quantity must be at least 1');
    err.status = 400;
    throw err;
  }
  const product = await Product.findByPk(productId, {
    include: [{ model: ProductVariant, as: 'variants' }],
  });
  if (!product) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  // Always resolve to a real variant; for products without variants this
  // creates/updates a default variant using product.basePrice.
  const variant = await ensureDefaultVariant(product, variantId || null);
  if (!variant || !variant.id) {
    const err = new Error('Product has no available variant');
    err.status = 400;
    throw err;
  }
  // Final safety: if still zero, force-sync from basePrice when possible
  const finalPrice = resolvePrice(variant, product);
  if (toNumber(variant.price) <= 0 && finalPrice > 0) {
    await variant.update({ price: finalPrice });
    variant.price = finalPrice;
  }
  const cart = await getOrCreateCart(userId);
  // Merge quantity if the same product+variant is already in the cart
  let cartItem = await CartItem.findOne({
    where: {
      cartId: cart.id,
      productId: product.id,
      variantId: variant.id,
    },
  });
  if (cartItem) {
    cartItem.quantity = cartItem.quantity + quantity;
    await cartItem.save();
  } else {
    cartItem = await CartItem.create({
      cartId: cart.id,
      productId: product.id,
      variantId: variant.id,
      quantity,
    });
  }
  return getCart(userId);
};
const updateItemQuantity = async (userId, cartItemId, quantity) => {
  if (quantity <= 0) {
    return removeItem(userId, cartItemId);
  }
  const cart = await getOrCreateCart(userId);
  const cartItem = await CartItem.findOne({
    where: { id: cartItemId, cartId: cart.id },
  });
  if (!cartItem) {
    const err = new Error('Cart item not found');
    err.status = 404;
    throw err;
  }
  cartItem.quantity = quantity;
  await cartItem.save();
  return getCart(userId);
};
const removeItem = async (userId, cartItemId) => {
  const cart = await getOrCreateCart(userId);
  const cartItem = await CartItem.findOne({
    where: { id: cartItemId, cartId: cart.id },
  });
  if (!cartItem) {
    const err = new Error('Cart item not found');
    err.status = 404;
    throw err;
  }
  await cartItem.destroy();
  return getCart(userId);
};
const clearCart = async (userId) => {
  const cart = await Cart.findOne({ where: { userId } });
  if (cart) {
    await CartItem.destroy({ where: { cartId: cart.id } });
  }
  return getCart(userId);
};
module.exports = {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
};
