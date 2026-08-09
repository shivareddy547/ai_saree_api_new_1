const { Order, OrderItem, CartItem, Product, ProductVariant, sequelize } = require('../models');
const cartService = require('./cartService');
class OrderService {
  async createOrder(userId, shippingAddress, paymentMethod) {
    const transaction = await sequelize.transaction();
    try {
      const { items } = await cartService.getCart(userId);
      if (!items || items.length === 0) {
        const err = new Error('Cart is empty');
        err.status = 400;
        throw err;
      }
      let total = 0;
      const orderItemsData = [];
      const stockErrors = [];
      for (const item of items) {
        const product = await Product.findByPk(item.productId, {
          include: [{ model: ProductVariant, as: 'variants' }],
          transaction,
        });
        if (!product) {
          stockErrors.push(`Product not found: ${item.product?.name || 'Unknown'}`);
          continue;
        }
        // Determine if product has "real" variants (more than one, or one with size/color)
        const variants = product.variants || [];
        const hasRealVariants = variants.length > 1 || (variants.length === 1 && (variants[0].size || variants[0].color));
        let availableStock;
        let stockSource; // either variant or product
        if (hasRealVariants) {
          // Find the specific variant
          const variant = variants.find(v => v.id === item.variantId);
          if (!variant) {
            stockErrors.push(`Variant not found for product: ${product.name}`);
            continue;
          }
          availableStock = variant.stockQuantity || 0;
          stockSource = variant;
        } else {
          // No real variants: use product-level stock
          availableStock = product.stockQuantity || 0;
          stockSource = product;
        }
        if (availableStock < item.quantity) {
          const productName = product.name || 'Product';
          let variantInfo = '';
          if (hasRealVariants) {
            const variant = stockSource;
            const color = variant.color || '';
            const size = variant.size || '';
            variantInfo = color && size ? ` (${color}, ${size})` : color || size ? ` (${color || size})` : '';
          }
          stockErrors.push(
            `"${productName}"${variantInfo} - available: ${availableStock}, requested: ${item.quantity}`
          );
          continue;
        }
        // Deduct stock
        if (hasRealVariants) {
          const variant = stockSource;
          variant.stockQuantity = availableStock - item.quantity;
          await variant.save({ transaction });
        } else {
          product.stockQuantity = availableStock - item.quantity;
          await product.save({ transaction });
        }
        // Determine price for order item
        const price = hasRealVariants
          ? parseFloat(stockSource.price)
          : parseFloat(product.basePrice || 0);
        const costPrice = hasRealVariants
          ? (stockSource.costPrice ? parseFloat(stockSource.costPrice) : null)
          : (product.costPrice ? parseFloat(product.costPrice) : null);
        const itemTotal = price * item.quantity;
        total += itemTotal;
        orderItemsData.push({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          price: price,
          costPrice: costPrice,
        });
      }
      if (stockErrors.length > 0) {
        const errorMessage = `Insufficient stock for the following items:\n${stockErrors.join('\n')}\nPlease remove these items from your cart and try again.`;
        const err = new Error(errorMessage);
        err.status = 400;
        throw err;
      }
      const order = await Order.create({
        userId,
        total,
        status: 'pending',
        shippingAddress,
        paymentMethod,
      }, { transaction });
      for (const data of orderItemsData) {
        await OrderItem.create({
          ...data,
          orderId: order.id,
        }, { transaction });
      }
      await cartService.clearCart(userId);
      await transaction.commit();
      return order;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  async getOrders(userId) {
    return await Order.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            { model: Product, as: 'product' },
            { model: ProductVariant, as: 'variant' },
          ],
        },
      ],
    });
  }
  async getOrder(userId, orderId) {
    const order = await Order.findOne({
      where: { id: orderId, userId },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            { model: Product, as: 'product' },
            { model: ProductVariant, as: 'variant' },
          ],
        },
      ],
    });
    if (!order) {
      const err = new Error('Order not found');
      err.status = 404;
      throw err;
    }
    return order;
  }
}
module.exports = new OrderService();
