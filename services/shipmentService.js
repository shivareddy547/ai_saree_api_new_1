const axios = require('axios');
const { Provider, PickupLocation } = require('../models');
const SHIPROCKET_BASE = {
  production: 'https://apiv2.shiprocket.in/v1/external',
  sandbox: 'https://apiv2.shiprocket.in/v1/external',
};
let tokenCache = {
  token: null,
  expiresAt: 0,
  providerId: null,
};
const getEnabledShiprocketProvider = async () => {
  const provider = await Provider.findOne({
    where: {
      provider_type: 'shipment',
      provider_key: 'shiprocket',
      is_enabled: true,
    },
    order: [['createdAt', 'DESC']],
  });
  if (!provider) {
    const err = new Error('No enabled Shiprocket provider found. Please configure and enable it in Shipment Providers Setup.');
    err.status = 400;
    throw err;
  }
  return provider;
};
const getShiprocketToken = async (provider) => {
  const now = Date.now();
  if (
    tokenCache.token &&
    tokenCache.providerId === provider.id &&
    tokenCache.expiresAt > now + 60000
  ) {
    return tokenCache.token;
  }
  const creds = provider.credentials || {};
  const email = creds.email;
  const password = creds.password;
  if (!email || !password) {
    const err = new Error('Shiprocket credentials incomplete (email and password required)');
    err.status = 400;
    throw err;
  }
  const env = (creds.environment || 'production').toLowerCase();
  const base = SHIPROCKET_BASE[env] || SHIPROCKET_BASE.production;
  try {
    const res = await axios.post(`${base}/auth/login`, {
      email,
      password,
    });
    const token = res.data?.token;
    if (!token) {
      const err = new Error('Failed to obtain Shiprocket token');
      err.status = 502;
      throw err;
    }
    tokenCache = {
      token,
      expiresAt: now + 9 * 24 * 60 * 60 * 1000,
      providerId: provider.id,
    };
    return token;
  } catch (e) {
    const msg =
      e.response?.data?.message ||
      e.message ||
      'Shiprocket authentication failed';
    const err = new Error(msg);
    err.status = e.response?.status || 502;
    throw err;
  }
};
const getDefaultPickupLocation = async () => {
  const loc = await PickupLocation.findOne({
    where: { isDefault: true, isActive: true },
  });
  if (loc) return loc;
  return await PickupLocation.findOne({ where: { isActive: true } });
};
/**
 * Fetch available courier rates from Shiprocket for given pincodes and weight.
 */
const getShippingRates = async ({
  deliveryPincode,
  weight = 0.5,
  cod = 0,
  declaredValue = 0,
}) => {
  if (!deliveryPincode || String(deliveryPincode).trim().length < 5) {
    const err = new Error('Valid delivery pincode is required');
    err.status = 400;
    throw err;
  }
  const provider = await getEnabledShiprocketProvider();
  const pickup = await getDefaultPickupLocation();
  if (!pickup || !pickup.zipCode) {
    const err = new Error(
      'No default pickup location with pincode configured. Please set a default pickup location in Store Settings.'
    );
    err.status = 400;
    throw err;
  }
  const pickupPincode = String(pickup.zipCode).trim();
  const token = await getShiprocketToken(provider);
  const env = (provider.credentials?.environment || 'production').toLowerCase();
  const base = SHIPROCKET_BASE[env] || SHIPROCKET_BASE.production;
  try {
    const res = await axios.get(`${base}/courier/serviceability/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      params: {
        pickup_postcode: pickupPincode,
        delivery_postcode: String(deliveryPincode).trim(),
        weight: Math.max(0.1, parseFloat(weight) || 0.5),
        cod: cod ? 1 : 0,
        declared_value: declaredValue || 0,
      },
    });
    const data = res.data?.data || {};
    const available = data.available_courier_companies || [];
    const rates = available.map((c) => ({
      courierCompanyId: String(c.courier_company_id),
      courierName: c.courier_name || c.courier_company_name || 'Courier',
      rate: parseFloat(c.rate) || 0,
      estimatedDays: parseInt(c.estimated_delivery_days, 10) || parseInt(c.etd, 10) || null,
      etd: c.etd || null,
      freightCharge: parseFloat(c.freight_charge) || parseFloat(c.rate) || 0,
      codCharges: parseFloat(c.cod_charges) || 0,
      isSurface: !!c.is_surface,
      rating: c.rating || null,
    }));
    rates.sort((a, b) => a.rate - b.rate);
    return {
      rates,
      pickupPincode,
      deliveryPincode: String(deliveryPincode).trim(),
      providerId: provider.id,
      providerName: provider.name,
    };
  } catch (e) {
    const msg =
      e.response?.data?.message ||
      (Array.isArray(e.response?.data?.errors)
        ? e.response.data.errors.join(', ')
        : null) ||
      e.message ||
      'Failed to fetch shipping rates from Shiprocket';
    const err = new Error(msg);
    err.status = e.response?.status || 502;
    throw err;
  }
};
/**
 * Create a shipment order in Shiprocket after local order is placed.
 */
const createShiprocketOrder = async (order, orderItems, shippingAddressObj, selectedCourier) => {
  const provider = await getEnabledShiprocketProvider();
  const pickup = await getDefaultPickupLocation();
  if (!pickup) {
    const err = new Error('No default pickup location configured');
    err.status = 400;
    throw err;
  }
  const token = await getShiprocketToken(provider);
  const env = (provider.credentials?.environment || 'production').toLowerCase();
  const base = SHIPROCKET_BASE[env] || SHIPROCKET_BASE.production;
  const billingName = shippingAddressObj.fullName || 'Customer';
  const billingPhone = (shippingAddressObj.phone || '').replace(/\D/g, '').slice(-10) || '9999999999';
  const orderItemsPayload = (orderItems || []).map((item) => ({
    name: item.product?.name || item.name || 'Product',
    sku: item.variant?.sku || item.product?.defaultSku || `SKU-${item.productId}`,
    units: item.quantity || 1,
    selling_price: parseFloat(item.price) || 0,
    discount: 0,
    tax: 0,
    hsn: 0,
  }));
  const payload = {
    order_id: String(order.merchantOrderId || order.id),
    order_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
    pickup_location: pickup.name || 'Primary',
    billing_customer_name: billingName,
    billing_last_name: '',
    billing_address: shippingAddressObj.streetAddress || '',
    billing_address_2: shippingAddressObj.apartment || '',
    billing_city: shippingAddressObj.city || '',
    billing_pincode: shippingAddressObj.zipCode || '',
    billing_state: shippingAddressObj.state || '',
    billing_country: shippingAddressObj.country || 'India',
    billing_email: shippingAddressObj.email || 'customer@example.com',
    billing_phone: billingPhone,
    shipping_is_billing: true,
    order_items: orderItemsPayload,
    payment_method: order.paymentStatus === 'cod' ? 'COD' : 'Prepaid',
    sub_total: parseFloat(order.total) - (parseFloat(order.shippingAmount) || 0) || parseFloat(order.total),
    length: 10,
    breadth: 10,
    height: 5,
    weight: 0.5,
  };
  if (selectedCourier?.courierCompanyId) {
    payload.courier_id = selectedCourier.courierCompanyId;
  }
  try {
    const res = await axios.post(`${base}/orders/create/adhoc`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const data = res.data || {};
    return {
      shiprocketOrderId: data.order_id ? String(data.order_id) : null,
      shiprocketShipmentId: data.shipment_id ? String(data.shipment_id) : null,
      awbCode: data.awb_code || null,
      status: data.status || data.status_code || null,
      raw: data,
    };
  } catch (e) {
    const msg =
      e.response?.data?.message ||
      (typeof e.response?.data === 'object'
        ? JSON.stringify(e.response.data)
        : null) ||
      e.message ||
      'Failed to create Shiprocket order';
    console.error('Shiprocket create order error:', msg);
    return {
      shiprocketOrderId: null,
      shiprocketShipmentId: null,
      awbCode: null,
      status: 'failed',
      error: msg,
      raw: e.response?.data || null,
    };
  }
};
module.exports = {
  getShippingRates,
  createShiprocketOrder,
  getEnabledShiprocketProvider,
  getDefaultPickupLocation,
  getShiprocketToken,
};
