const { Order, OrderItem, Product, ProductVariant, ProductImage, sequelize } = require('../models');
const cartService = require('./cartService');

class OrderService {
  async createOrder(userId, shippingAddress, paymentMethod, billingAddress) {
    const transaction = await sequelize.transaction();
    try {
      const items = await cartService.getCart(userId);

      if (!items || items.length === 0) {
        const err = new Error('Cart is empty');
        err.status = 400;
        throw err;
      }

      let total = 0;
      const orderItemsData = [];
      const stockErrors = [];

      for (const item of items) {
        const productId = item.productId || item.product?.id;
        const variantId = item.variantId || item.variant?.id;
        const quantity = item.quantity || 1;

        const product = await Product.findByPk(productId, {
          include: [{ model: ProductVariant, as: 'variants' }],
          transaction,
        });

        if (!product) {
          stockErrors.push(`Product not found: ${item.product?.name || 'Unknown'}`);
          continue;
        }

        const variants = product.variants || [];
        const hasRealVariants =
          variants.length > 1 ||
          (variants.length === 1 && (variants[0].size || variants[0].color));

        let availableStock;
        let stockSource;

        if (hasRealVariants) {
          const variant = variants.find((v) => v.id === variantId);
          if (!variant) {
            stockErrors.push(`Variant not found for product: ${product.name}`);
            continue;
          }
          availableStock = variant.stockQuantity || 0;
          stockSource = variant;
        } else {
          availableStock = product.stockQuantity || 0;
          stockSource = product;
        }

        if (availableStock < quantity) {
          const productName = product.name || 'Product';
          let variantInfo = '';
          if (hasRealVariants) {
            const variant = stockSource;
            const color = variant.color || '';
            const size = variant.size || '';
            variantInfo =
              color && size
                ? ` (${color}, ${size})`
                : color || size
                ? ` (${color || size})`
                : '';
          }
          stockErrors.push(
            `"${productName}"${variantInfo} - available: ${availableStock}, requested: ${quantity}`
          );
          continue;
        }

        if (hasRealVariants) {
          const variant = stockSource;
          variant.stockQuantity = availableStock - quantity;
          await variant.save({ transaction });
        } else {
          product.stockQuantity = availableStock - quantity;
          await product.save({ transaction });
        }

        const price = hasRealVariants
          ? parseFloat(stockSource.price)
          : parseFloat(product.basePrice || 0);

        const costPrice = hasRealVariants
          ? stockSource.costPrice
            ? parseFloat(stockSource.costPrice)
            : null
          : product.costPrice
          ? parseFloat(product.costPrice)
          : null;

        const itemTotal = price * quantity;
        total += itemTotal;

        orderItemsData.push({
          productId,
          variantId,
          quantity,
          price,
          costPrice,
        });
      }

      if (stockErrors.length > 0) {
        const errorMessage = `Insufficient stock for the following items:\n${stockErrors.join(
          '\n'
        )}\nPlease remove these items from your cart and try again.`;
        const err = new Error(errorMessage);
        err.status = 400;
        throw err;
      }

      if (orderItemsData.length === 0) {
        const err = new Error('Cart is empty');
        err.status = 400;
        throw err;
      }

      const order = await Order.create(
        {
          userId,
          total,
          status: 'pending',
          shippingAddress,
          billingAddress: billingAddress || shippingAddress,
          paymentMethod,
        },
        { transaction }
      );

      for (const data of orderItemsData) {
        await OrderItem.create(
          {
            ...data,
            orderId: order.id,
          },
          { transaction }
        );
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
            {
              model: Product,
              as: 'product',
              include: [{ model: ProductImage, as: 'images' }],
            },
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
            {
              model: Product,
              as: 'product',
              include: [{ model: ProductImage, as: 'images' }],
            },
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
