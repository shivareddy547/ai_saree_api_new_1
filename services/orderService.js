const { Order, OrderItem, Product, ProductVariant, ProductImage, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const cartService = require('./cartService');
const paymentService = require('./paymentService');
const shipmentService = require('./shipmentService');
class OrderService {
  async createOrder(
    userId,
    shippingAddress,
    paymentMethod,
    billingAddress,
    paymentProviderId = null,
    redirectBaseUrl = null,
    shipmentOptions = {}
  ) {
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
      // Shipping amount from selected courier
      const shippingAmount = parseFloat(shipmentOptions.shippingAmount) || 0;
      total += shippingAmount;
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
          shippingAmount,
          estimatedDeliveryDays: shipmentOptions.estimatedDeliveryDays
            ? parseInt(shipmentOptions.estimatedDeliveryDays, 10)
            : null,
          shipmentProviderId: shipmentOptions.shipmentProviderId || null,
          courierCompanyId: shipmentOptions.courierCompanyId
            ? String(shipmentOptions.courierCompanyId)
            : null,
          courierName: shipmentOptions.courierName || null,
          shipmentStatus: shipmentOptions.courierName ? 'pending' : null,
          shipmentDetails: shipmentOptions.shipmentDetails || {},
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
      if (!provider || provider.provider_key !== 'phonepe') {
        await cartService.clearCart(userId);
      }
      await transaction.commit();
      // Create Shiprocket shipment after local order is committed (non-blocking for payment flow)
      if (shipmentOptions.courierCompanyId || shipmentOptions.courierName) {
        try {
          const fullOrder = await Order.findByPk(order.id, {
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
          const addrObj = shipmentOptions.shippingAddressObj || {};
          const srResult = await shipmentService.createShiprocketOrder(
            fullOrder,
            fullOrder.items,
            addrObj,
            {
              courierCompanyId: shipmentOptions.courierCompanyId,
              courierName: shipmentOptions.courierName,
            }
          );
          await fullOrder.update({
            shiprocketOrderId: srResult.shiprocketOrderId,
            shiprocketShipmentId: srResult.shiprocketShipmentId,
            awbCode: srResult.awbCode,
            shipmentStatus: srResult.status || 'created',
            shipmentDetails: {
              ...(fullOrder.shipmentDetails || {}),
              shiprocket: srResult.raw || srResult,
            },
          });
        } catch (srErr) {
          console.error('Shiprocket order creation failed (order still placed):', srErr.message);
        }
      }
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
          await order.update({
            paymentStatus: 'failed',
            paymentDetails: { error: payErr.message },
          });
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
  async getAllOrdersAdmin(filters = {}) {
    const {
      status,
      paymentStatus,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = filters;
    const where = {};
    if (status) {
      where.status = status;
    }
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = end;
      }
    }
    if (search) {
      const searchNum = parseInt(search, 10);
      if (!isNaN(searchNum)) {
        where[Op.or] = [
          { id: searchNum },
          { merchantOrderId: { [Op.iLike]: `%${search}%` } },
        ];
      } else {
        where[Op.or] = [
          { merchantOrderId: { [Op.iLike]: `%${search}%` } },
        ];
      }
    }
    const offset =
      (Math.max(1, parseInt(page, 10)) - 1) *
      Math.min(100, Math.max(1, parseInt(limit, 10)));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const { count, rows } = await Order.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'email', 'phone', 'role'],
        },
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name'],
              include: [
                { model: ProductImage, as: 'images', attributes: ['url'], limit: 1 },
              ],
            },
            {
              model: ProductVariant,
              as: 'variant',
              attributes: ['id', 'size', 'color', 'sku'],
            },
          ],
        },
      ],
      distinct: true,
    });
    return {
      orders: rows,
      pagination: {
        page: Math.max(1, parseInt(page, 10)),
        limit: limitNum,
        total: count,
        totalPages: Math.ceil(count / limitNum) || 1,
      },
    };
  }
  async getOrderAdmin(orderId) {
    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'email', 'phone', 'role', 'createdAt'],
        },
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
  async cancelOrderAdmin(orderId, reason) {
    if (!reason || !String(reason).trim()) {
      const err = new Error('Cancellation reason is required');
      err.status = 400;
      throw err;
    }
    const order = await Order.findByPk(orderId);
    if (!order) {
      const err = new Error('Order not found');
      err.status = 404;
      throw err;
    }
    if (order.status === 'cancelled') {
      const err = new Error('Order is already cancelled');
      err.status = 400;
      throw err;
    }
    if (order.status === 'delivered') {
      const err = new Error('Cannot cancel a delivered order');
      err.status = 400;
      throw err;
    }
    await order.update({
      status: 'cancelled',
      cancellationReason: String(reason).trim(),
    });
    return order;
  }
  async shipOrderAdmin(orderId, trackingUrl) {
    if (!trackingUrl || !String(trackingUrl).trim()) {
      const err = new Error('Tracking URL is required');
      err.status = 400;
      throw err;
    }
    const order = await Order.findByPk(orderId);
    if (!order) {
      const err = new Error('Order not found');
      err.status = 404;
      throw err;
    }
    if (order.status === 'cancelled') {
      const err = new Error('Cannot ship a cancelled order');
      err.status = 400;
      throw err;
    }
    if (order.status === 'delivered') {
      const err = new Error('Order is already delivered');
      err.status = 400;
      throw err;
    }
    await order.update({
      status: 'shipped',
      trackingUrl: String(trackingUrl).trim(),
    });
    return order;
  }
  async updateOrderStatusAdmin(orderId, status) {
    const allowed = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      const err = new Error('Invalid status');
      err.status = 400;
      throw err;
    }
    const order = await Order.findByPk(orderId);
    if (!order) {
      const err = new Error('Order not found');
      err.status = 404;
      throw err;
    }
    await order.update({ status });
    return order;
  }
}
module.exports = new OrderService();
