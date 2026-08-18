const { Order, OrderItem, Product, ProductVariant, ProductImage, sequelize } = require('../models');
const cartService = require('./cartService');
const paymentService = require('./paymentService');
class OrderService {
  async createOrder(userId, shippingAddress, paymentMethod, billingAddress, paymentProviderId = null, redirectBaseUrl = null) {
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
      // Apply COD extra charge if applicable
      let paymentStatus = 'pending';
      let provider = null;
      let finalPaymentMethod = paymentMethod || 'COD';
      if (paymentProviderId) {
        provider = await paymentService.getProviderById(paymentProviderId);
        finalPaymentMethod = provider.provider_key || provider.name;
        if (provider.provider_key === 'cod') {
          const extra = parseFloat(provider.credentials?.extra_charge || 0);
          if (!isNaN(extra) && extra > 0) {
            total += extra;
          }
          const minAmt = parseFloat(provider.credentials?.min_order_amount || 0);
          const maxAmt = parseFloat(provider.credentials?.max_order_amount || 0);
          if (!isNaN(minAmt) && minAmt > 0 && total < minAmt) {
            const err = new Error(`Minimum order amount for Cash on Delivery is ₹${minAmt}`);
            err.status = 400;
            throw err;
          }
          if (!isNaN(maxAmt) && maxAmt > 0 && total > maxAmt) {
            const err = new Error(`Maximum order amount for Cash on Delivery is ₹${maxAmt}`);
            err.status = 400;
            throw err;
          }
          paymentStatus = 'cod';
        }
      } else if ((paymentMethod || '').toUpperCase() === 'COD') {
        paymentStatus = 'cod';
        finalPaymentMethod = 'COD';
      }
      const merchantOrderId = `ORD_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const order = await Order.create(
        {
          userId,
          total,
          status: 'pending',
          shippingAddress,
          billingAddress: billingAddress || shippingAddress,
          paymentMethod: finalPaymentMethod,
          paymentStatus,
          paymentProviderId: provider ? provider.id : null,
          merchantOrderId,
          paymentDetails: {},
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
      // For PhonePe: initiate payment after commit
      if (provider && provider.provider_key === 'phonepe') {
        const redirectUrl =
          redirectBaseUrl ||
          process.env.FRONTEND_URL ||
          'http://localhost:3001/store/checkout';
        const returnUrl = `${redirectUrl}?orderId=${order.id}&payment=phonepe`;
        try {
          const payResult = await paymentService.initiatePhonePePayment(
            order,
            provider,
            returnUrl
          );
          return {
            order,
            paymentRequired: true,
            redirectUrl: payResult.redirectUrl,
            merchantOrderId: payResult.merchantOrderId,
          };
        } catch (payErr) {
          // Mark failed but keep order
          await order.update({ paymentStatus: 'failed', paymentDetails: { error: payErr.message } });
          throw payErr;
        }
      }
      return {
        order,
        paymentRequired: false,
        redirectUrl: null,
      };
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
  async verifyPayment(userId, orderId) {
    const order = await this.getOrder(userId, orderId);
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'cod') {
      return { paid: true, state: order.paymentStatus, order };
    }
    if (!order.paymentProviderId) {
      return { paid: false, state: order.paymentStatus, order };
    }
    const provider = await paymentService.getProviderById(order.paymentProviderId);
    if (provider.provider_key === 'phonepe') {
      return await paymentService.verifyPhonePePayment(order);
    }
    return { paid: false, state: order.paymentStatus, order };
  }
}
module.exports = new OrderService();
