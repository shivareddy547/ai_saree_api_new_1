const { Provider, Order } = require('../models');
const { randomUUID } = require('crypto');
let StandardCheckoutClient;
let Env;
let StandardCheckoutPayRequest;
let MetaInfo;
try {
  const phonepeSdk = require('@phonepe-pg/pg-sdk-node');
  StandardCheckoutClient = phonepeSdk.StandardCheckoutClient;
  Env = phonepeSdk.Env;
  StandardCheckoutPayRequest = phonepeSdk.StandardCheckoutPayRequest;
  MetaInfo = phonepeSdk.MetaInfo;
} catch (e) {
  // SDK not installed yet – methods will throw clear error
}
const getEnabledPaymentProviders = async () => {
  const providers = await Provider.findAll({
    where: {
      provider_type: 'payment',
      is_enabled: true,
    },
    order: [['createdAt', 'DESC']],
  });
  return providers.map((p) => ({
    id: p.id,
    name: p.name,
    provider_key: p.provider_key,
    is_enabled: p.is_enabled,
    credentials: {
      environment: p.credentials?.environment || 'production',
      display_label: p.credentials?.display_label || p.name,
      instructions: p.credentials?.instructions || null,
      min_order_amount: p.credentials?.min_order_amount || null,
      max_order_amount: p.credentials?.max_order_amount || null,
      extra_charge: p.credentials?.extra_charge || null,
    },
  }));
};
const getProviderById = async (id) => {
  const provider = await Provider.findByPk(id);
  if (!provider || provider.provider_type !== 'payment' || !provider.is_enabled) {
    const err = new Error('Payment provider not found or not enabled');
    err.status = 404;
    throw err;
  }
  return provider;
};
const getPhonePeClient = (credentials) => {
  if (!StandardCheckoutClient || !Env) {
    const err = new Error('PhonePe SDK is not installed. Run: npm i @phonepe-pg/pg-sdk-node');
    err.status = 500;
    throw err;
  }
  const clientId = credentials.client_id || credentials.merchant_id;
  const clientSecret = credentials.client_secret || credentials.salt_key;
  const clientVersion = credentials.client_version || '1';
  const envStr = (credentials.environment || 'sandbox').toLowerCase();
  const env = envStr === 'production' ? Env.PRODUCTION : Env.SANDBOX;
  if (!clientId || !clientSecret) {
    const err = new Error('PhonePe credentials incomplete (client_id / client_secret required)');
    err.status = 400;
    throw err;
  }
  return StandardCheckoutClient.getInstance(
    String(clientId),
    String(clientSecret),
    String(clientVersion),
    env
  );
};
/**
 * Initiate PhonePe payment.
 * Returns redirectUrl for the user to complete payment.
 */
const initiatePhonePePayment = async (order, provider, redirectUrl) => {
  const credentials = provider.credentials || {};
  const client = getPhonePeClient(credentials);
  const merchantOrderId = order.merchantOrderId || `ORD_${order.id}_${Date.now()}`;
  const amountInPaise = Math.round(parseFloat(order.total) * 100);
  if (amountInPaise < 100) {
    const err = new Error('Order amount must be at least ₹1.00');
    err.status = 400;
    throw err;
  }
  let request;
  if (StandardCheckoutPayRequest && StandardCheckoutPayRequest.builder) {
    request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amountInPaise)
      .redirectUrl(redirectUrl)
      .build();
  } else {
    // Fallback shape if builder API differs
    request = {
      merchantOrderId,
      amount: amountInPaise,
      redirectUrl,
    };
  }
  const response = await client.pay(request);
  const redirect = response.redirectUrl || response.redirect_url;
  await order.update({
    merchantOrderId,
    paymentStatus: 'pending',
    paymentDetails: {
      ...(order.paymentDetails || {}),
      phonepeOrderId: response.orderId || response.order_id || null,
      state: response.state || 'PENDING',
      initiatedAt: new Date().toISOString(),
    },
  });
  return {
    redirectUrl: redirect,
    merchantOrderId,
    state: response.state || 'PENDING',
  };
};
/**
 * Check PhonePe order status and update local order if paid.
 */
const verifyPhonePePayment = async (order) => {
  if (!order.merchantOrderId) {
    const err = new Error('No merchant order id found for this order');
    err.status = 400;
    throw err;
  }
  const provider = await getProviderById(order.paymentProviderId);
  const client = getPhonePeClient(provider.credentials || {});
  const response = await client.getOrderStatus(order.merchantOrderId);
  const state = (response.state || '').toUpperCase();
  const paymentDetails = {
    ...(order.paymentDetails || {}),
    lastStatusCheck: new Date().toISOString(),
    phonepeState: state,
    phonepeResponse: {
      orderId: response.orderId || response.order_id,
      amount: response.amount,
      expireAt: response.expireAt || response.expire_at,
    },
  };
  if (state === 'COMPLETED') {
    await order.update({
      paymentStatus: 'paid',
      status: order.status === 'pending' ? 'processing' : order.status,
      paymentDetails,
    });
    return { paid: true, state, order };
  }
  if (state === 'FAILED') {
    await order.update({
      paymentStatus: 'failed',
      paymentDetails,
    });
    return { paid: false, state, order };
  }
  await order.update({ paymentDetails });
  return { paid: false, state, order };
};
module.exports = {
  getEnabledPaymentProviders,
  getProviderById,
  initiatePhonePePayment,
  verifyPhonePePayment,
};
