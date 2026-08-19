const axios = require('axios');
const { Provider, PickupLocation, Order, OrderItem, Product, ProductVariant } = require('../models');
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
    const err = new Error(
      'No enabled Shiprocket provider found. Please configure and enable it in Shipment Providers Setup.'
    );
    err.status = 400;
    throw err;
  }
  return provider;
};
const getProviderById = async (id) => {
  const provider = await Provider.findByPk(id);
  if (!provider || provider.provider_type !== 'shipment' || !provider.is_enabled) {
    const err = new Error('Shipment provider not found or not enabled');
    err.status = 404;
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
    const res = await axios.post(`${base}/auth/login`, { email, password });
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
      e.response?.data?.message || e.message || 'Shiprocket authentication failed';
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
      estimatedDays:
        parseInt(c.estimated_delivery_days, 10) || parseInt(c.etd, 10) || null,
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
const createShiprocketOrder = async (
  order,
  orderItems,
  shippingAddressObj,
  selectedCourier
) => {
  const provider = selectedCourier?.shipmentProviderId
    ? await getProviderById(selectedCourier.shipmentProviderId)
    : await getEnabledShiprocketProvider();
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
  const billingPhone =
    (shippingAddressObj.phone || '').replace(/\D/g, '').slice(-10) || '9999999999';
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
    sub_total:
      parseFloat(order.total) - (parseFloat(order.shippingAmount) || 0) ||
      parseFloat(order.total),
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
      providerId: provider.id,
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
      providerId: provider.id,
    };
  }
};
/**
 * Track / fetch latest shipment status from Shiprocket
 */
const trackShipment = async (order) => {
  if (!order.shiprocketShipmentId && !order.awbCode) {
    const err = new Error('No Shiprocket shipment ID or AWB on this order');
    err.status = 400;
    throw err;
  }
  const provider = order.shipmentProviderId
    ? await getProviderById(order.shipmentProviderId)
    : await getEnabledShiprocketProvider();
  const token = await getShiprocketToken(provider);
  const env = (provider.credentials?.environment || 'production').toLowerCase();
  const base = SHIPROCKET_BASE[env] || SHIPROCKET_BASE.production;
  try {
    let res;
    if (order.awbCode) {
      res = await axios.get(`${base}/courier/track/awb/${order.awbCode}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      res = await axios.get(
        `${base}/courier/track/shipment/${order.shiprocketShipmentId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    }
    const data = res.data?.tracking_data || res.data?.data || res.data || {};
    const trackStatus =
      data.track_status ||
      data.shipment_status ||
      data.current_status ||
      data.status ||
      null;
    const activities = data.shipment_track || data.track_activities || data.activities || [];
    return {
      status: trackStatus,
      awbCode: order.awbCode || data.awb_code || null,
      activities,
      raw: data,
    };
  } catch (e) {
    const msg =
      e.response?.data?.message || e.message || 'Failed to track shipment';
    const err = new Error(msg);
    err.status = e.response?.status || 502;
    throw err;
  }
};
/**
 * Cancel a Shiprocket shipment
 */
const cancelShipment = async (order) => {
  if (!order.shiprocketOrderId && !order.awbCode) {
    const err = new Error('No Shiprocket order/AWB to cancel');
    err.status = 400;
    throw err;
  }
  const provider = order.shipmentProviderId
    ? await getProviderById(order.shipmentProviderId)
    : await getEnabledShiprocketProvider();
  const token = await getShiprocketToken(provider);
  const env = (provider.credentials?.environment || 'production').toLowerCase();
  const base = SHIPROCKET_BASE[env] || SHIPROCKET_BASE.production;
  try {
    const ids = order.shiprocketOrderId
      ? [Number(order.shiprocketOrderId)]
      : [];
    const res = await axios.post(
      `${base}/orders/cancel`,
      { ids },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return {
      success: true,
      message: res.data?.message || 'Shipment cancelled',
      raw: res.data,
    };
  } catch (e) {
    const msg =
      e.response?.data?.message || e.message || 'Failed to cancel shipment';
    const err = new Error(msg);
    err.status = e.response?.status || 502;
    throw err;
  }
};
/**
 * List enabled shipment providers (for admin UI)
 */
const getEnabledShipmentProviders = async () => {
  const providers = await Provider.findAll({
    where: {
      provider_type: 'shipment',
      is_enabled: true,
    },
    order: [['createdAt', 'DESC']],
  });
  return providers.map((p) => ({
    id: p.id,
    name: p.name,
    provider_key: p.provider_key,
    is_enabled: p.is_enabled,
  }));
};
/**
 * Parse a multi-line shipping address text into structured fields
 */
const parseShippingAddressText = (text) => {
  if (!text) return {};
  const lines = String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const result = {
    fullName: lines[0] || 'Customer',
    streetAddress: lines[1] || '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'India',
    phone: '',
  };
  for (const line of lines) {
    if (/^Phone:/i.test(line)) {
      result.phone = line.replace(/^Phone:\s*/i, '').trim();
    }
    const pinMatch = line.match(/\b(\d{6})\b/);
    if (pinMatch) result.zipCode = pinMatch[1];
    if (/India|United States|United Kingdom|Canada|Australia/i.test(line)) {
      result.country = line;
    }
  }
  if (lines.length >= 3) {
    const cityLine = lines[2] || '';
    const parts = cityLine.split(',').map((p) => p.trim());
    if (parts[0]) result.city = parts[0].replace(/\s*-\s*\d{6}/, '').trim();
    if (parts[1]) result.state = parts[1].replace(/\s*-\s*\d{6}/, '').trim();
  }
  return result;
};
module.exports = {
  getShippingRates,
  createShiprocketOrder,
  trackShipment,
  cancelShipment,
  getEnabledShiprocketProvider,
  getEnabledShipmentProviders,
  getDefaultPickupLocation,
  getShiprocketToken,
  getProviderById,
  parseShippingAddressText,
};
