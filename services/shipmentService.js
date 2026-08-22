const axios = require('axios');
const { Provider, PickupLocation, Product, ProductVariant, Cart, CartItem, User } = require('../models');
const SHIPROCKET_BASE = {
  production: 'https://apiv2.shiprocket.in/v1/external',
  sandbox: 'https://apiv2.shiprocket.in/v1/external',
};
const DELHIVERY_BASE = {
  production: 'https://track.delhivery.com',
  sandbox: 'https://staging-express.delhivery.com',
};
const DEFAULT_PRODUCT_WEIGHT_KG = 0.5;
const DEFAULT_LENGTH_CM = 10;
const DEFAULT_BREADTH_CM = 10;
const DEFAULT_HEIGHT_CM = 5;
let tokenCache = { token: null, expiresAt: 0, providerId: null };
const computePackageFromItems = (orderItems) => {
  let weight = 0;
  let length = DEFAULT_LENGTH_CM;
  let breadth = DEFAULT_BREADTH_CM;
  let height = DEFAULT_HEIGHT_CM;
  (orderItems || []).forEach((item) => {
    const product = item.product || {};
    const qty = parseInt(item.quantity, 10) || 1;
    const w = parseFloat(product.weight) || DEFAULT_PRODUCT_WEIGHT_KG;
    weight += w * qty;
    if (product.length) length = Math.max(length, parseFloat(product.length) || length);
    if (product.breadth) breadth = Math.max(breadth, parseFloat(product.breadth) || breadth);
    if (product.height) height = Math.max(height, parseFloat(product.height) || height);
  });
  return {
    weight: Math.max(0.1, weight || DEFAULT_PRODUCT_WEIGHT_KG),
    length: Math.max(1, length),
    breadth: Math.max(1, breadth),
    height: Math.max(1, height),
  };
};
const getCartPackageForUser = async (userId) => {
  if (!userId) return null;
  try {
    const cart = await Cart.findOne({
      where: { userId },
      include: [
        {
          model: CartItem,
          as: 'items',
          include: [
            { model: Product, as: 'product' },
            { model: ProductVariant, as: 'variant' },
          ],
        },
      ],
    });
    if (!cart || !cart.items || cart.items.length === 0) return null;
    return computePackageFromItems(cart.items);
  } catch (_) {
    return null;
  }
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
    const err = new Error('No enabled Shiprocket provider found');
    err.status = 400;
    throw err;
  }
  return provider;
};
const getEnabledDelhiveryProvider = async () => {
  const provider = await Provider.findOne({
    where: {
      provider_type: 'shipment',
      provider_key: 'delhivery',
      is_enabled: true,
    },
    order: [['createdAt', 'DESC']],
  });
  if (!provider) {
    const err = new Error('No enabled Delhivery provider found');
    err.status = 400;
    throw err;
  }
  return provider;
};
const getProviderById = async (id) => {
  const provider = await Provider.findByPk(id);
  if (!provider) {
    const err = new Error('Shipment provider not found');
    err.status = 404;
    throw err;
  }
  return provider;
};
const getDefaultPickupLocation = async () => {
  let loc = await PickupLocation.findOne({
    where: { is_active: true, is_default: true },
  });
  if (!loc) {
    loc = await PickupLocation.findOne({
      where: { is_active: true },
      order: [['createdAt', 'ASC']],
    });
  }
  return loc;
};
const getActivePickupLocations = async () => {
  return PickupLocation.findAll({
    where: { is_active: true },
    order: [
      ['is_default', 'DESC'],
      ['createdAt', 'ASC'],
    ],
  });
};
const getShiprocketToken = async (provider) => {
  const now = Date.now();
  if (
    tokenCache.token &&
    tokenCache.expiresAt > now &&
    tokenCache.providerId === provider.id
  ) {
    return tokenCache.token;
  }
  const env = (provider.credentials?.environment || 'production').toLowerCase();
  const base = SHIPROCKET_BASE[env] || SHIPROCKET_BASE.production;
  const email = provider.credentials?.email;
  const password = provider.credentials?.password;
  if (!email || !password) {
    const err = new Error('Shiprocket credentials incomplete (email/password required)');
    err.status = 400;
    throw err;
  }
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
};
const getDelhiveryToken = (provider) => {
  const token = provider.credentials?.api_token;
  if (!token) {
    const err = new Error('Delhivery API token missing');
    err.status = 400;
    throw err;
  }
  return token;
};
const getShiprocketRates = async (
  provider,
  {
    pickupPincode,
    deliveryPincode,
    finalWeight,
    finalLength,
    finalBreadth,
    finalHeight,
    cod,
    declaredValue,
  }
) => {
  const token = await getShiprocketToken(provider);
  const env = (provider.credentials?.environment || 'production').toLowerCase();
  const base = SHIPROCKET_BASE[env] || SHIPROCKET_BASE.production;
  const res = await axios.get(`${base}/courier/serviceability/`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      pickup_postcode: pickupPincode,
      delivery_postcode: String(deliveryPincode).trim(),
      weight: finalWeight,
      length: finalLength,
      breadth: finalBreadth,
      height: finalHeight,
      cod: cod ? 1 : 0,
      declared_value: declaredValue || 0,
    },
  });
  const available =
    res.data?.data?.available_courier_companies ||
    res.data?.available_courier_companies ||
    [];
  return (available || []).map((c) => ({
    courierCompanyId: `shiprocket-${c.courier_company_id}`,
    courierName: c.courier_name || c.courier_company_name || 'Courier',
    rate: parseFloat(c.rate) || parseFloat(c.freight_charge) || 0,
    estimatedDays:
      parseInt(c.estimated_delivery_days, 10) || parseInt(c.etd, 10) || null,
    etd: c.etd || null,
    freightCharge: parseFloat(c.freight_charge) || parseFloat(c.rate) || 0,
    codCharges: parseFloat(c.cod_charges) || 0,
    isSurface: !!c.is_surface,
    rating: c.rating || null,
    providerId: provider.id,
    providerKey: 'shiprocket',
    providerName: provider.name || 'Shiprocket',
    rawCourierId: String(c.courier_company_id),
  }));
};
const getDelhiveryRates = async (
  provider,
  { pickupPincode, deliveryPincode, finalWeight, cod }
) => {
  const token = getDelhiveryToken(provider);
  const env = (provider.credentials?.environment || 'production').toLowerCase();
  const base = DELHIVERY_BASE[env] || DELHIVERY_BASE.production;
  const weightGrams = Math.max(1, Math.round(finalWeight * 1000));
  const fetchMode = async (mode) => {
    const res = await axios.get(`${base}/api/kinko/v1/invoice/charges/.json`, {
      headers: {
        Authorization: `Token ${token}`,
        Accept: 'application/json',
      },
      params: {
        md: mode,
        cgm: weightGrams,
        o_pin: pickupPincode,
        d_pin: String(deliveryPincode).trim(),
        ss: 'Delivered',
      },
    });
    return res.data;
  };
  const rates = [];
  try {
    const surface = await fetchMode('S');
    if (surface && (Array.isArray(surface) ? surface[0] : surface)) {
      const item = Array.isArray(surface) ? surface[0] : surface;
      const charge =
        parseFloat(item.total_amount) ||
        parseFloat(item.charged_weight_amount) ||
        parseFloat(item.gross_amount) ||
        0;
      rates.push({
        courierCompanyId: 'delhivery-S',
        courierName: `${provider.name || 'Delhivery'} Surface`,
        rate: charge,
        estimatedDays: null,
        etd: null,
        freightCharge: charge,
        codCharges: 0,
        isSurface: true,
        rating: null,
        providerId: provider.id,
        providerKey: 'delhivery',
        providerName: provider.name || 'Delhivery',
        shippingMode: 'Surface',
        rawCourierId: 'S',
      });
    }
  } catch (_) {}
  try {
    const express = await fetchMode('E');
    if (express && (Array.isArray(express) ? express[0] : express)) {
      const item = Array.isArray(express) ? express[0] : express;
      const charge =
        parseFloat(item.total_amount) ||
        parseFloat(item.charged_weight_amount) ||
        parseFloat(item.gross_amount) ||
        0;
      rates.push({
        courierCompanyId: 'delhivery-E',
        courierName: `${provider.name || 'Delhivery'} Express`,
        rate: charge,
        estimatedDays: null,
        etd: null,
        freightCharge: charge,
        codCharges: 0,
        isSurface: false,
        rating: null,
        providerId: provider.id,
        providerKey: 'delhivery',
        providerName: provider.name || 'Delhivery',
        shippingMode: 'Express',
        rawCourierId: 'E',
      });
    }
  } catch (_) {}
  return rates;
};
/**
 * Store Pickup – one free option per active pickup location.
 */
const getStorePickupRates = async (provider) => {
  const locations = await getActivePickupLocations();
  if (!locations || locations.length === 0) {
    return [
      {
        courierCompanyId: 'store-pickup',
        courierName: provider.name || 'Store Pickup',
        rate: 0,
        estimatedDays: 0,
        etd: 'Ready for pickup',
        freightCharge: 0,
        codCharges: 0,
        isSurface: false,
        rating: null,
        providerId: provider.id,
        providerKey: 'store_pickup',
        providerName: provider.name || 'Store Pickup',
        rawCourierId: 'store-pickup',
        isStorePickup: true,
        pickupLocationId: null,
        pickupLocationName: null,
        pickupLocationAddress: null,
      },
    ];
  }
  return locations.map((loc) => {
    const addressParts = [
      loc.streetAddress || loc.street_address,
      loc.apartment,
      loc.city,
      loc.state,
      loc.zipCode || loc.zip_code,
      loc.country,
    ]
      .filter(Boolean)
      .join(', ');
    return {
      courierCompanyId: `store-pickup-${loc.id}`,
      courierName: `${provider.name || 'Store Pickup'} – ${loc.name}`,
      rate: 0,
      estimatedDays: 0,
      etd: 'Ready for pickup',
      freightCharge: 0,
      codCharges: 0,
      isSurface: false,
      rating: null,
      providerId: provider.id,
      providerKey: 'store_pickup',
      providerName: provider.name || 'Store Pickup',
      rawCourierId: String(loc.id),
      isStorePickup: true,
      pickupLocationId: loc.id,
      pickupLocationName: loc.name,
      pickupLocationAddress: addressParts,
      isDefaultPickup: !!loc.isDefault,
    };
  });
};
/**
 * Check whether free_shipping provider conditions match current order context.
 * Any enabled condition matching is enough (OR logic).
 */
const isFreeShippingApplicable = (provider, { orderTotal, customerEmail, pincode }) => {
  const c = provider.credentials || {};
  const normalizeList = (str) =>
    String(str || '')
      .split(/[,;\n]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  let matched = false;
  if (c.use_order_total === 'true') {
    const min = Number(c.min_order_total) || 0;
    if (Number(orderTotal) >= min) matched = true;
  }
  if (c.use_emails === 'true') {
    const emails = normalizeList(c.allowed_emails);
    const email = String(customerEmail || '').trim().toLowerCase();
    if (email && emails.includes(email)) matched = true;
  }
  if (c.use_pincodes === 'true') {
    const pins = normalizeList(c.allowed_pincodes);
    const pin = String(pincode || '').trim().toLowerCase();
    if (pin && pins.includes(pin)) matched = true;
  }
  return matched;
};
const getFreeShippingRate = (provider) => ({
  courierCompanyId: `free-shipping-${provider.id}`,
  courierName: provider.name || 'Free Shipping',
  rate: 0,
  estimatedDays: null,
  etd: 'Free shipping applied',
  freightCharge: 0,
  codCharges: 0,
  isSurface: false,
  rating: null,
  providerId: provider.id,
  providerKey: 'free_shipping',
  providerName: provider.name || 'Free Shipping',
  rawCourierId: 'free-shipping',
  isStorePickup: false,
  isFreeShipping: true,
  pickupLocationId: null,
  pickupLocationName: null,
  pickupLocationAddress: null,
});
/**
 * Retrieve shipping rates from EVERY enabled shipment provider.
 * Returns combined, sorted list so the user can pick any option.
 * Store Pickup and applicable Free Shipping appear with rate ₹0.
 */
const getShippingRates = async ({
  deliveryPincode,
  weight = 0.5,
  length,
  breadth,
  height,
  cod = 0,
  declaredValue = 0,
  userId = null,
}) => {
  const enabledProviders = await Provider.findAll({
    where: {
      provider_type: 'shipment',
      is_enabled: true,
    },
    order: [['createdAt', 'DESC']],
  });
  if (!enabledProviders || enabledProviders.length === 0) {
    const err = new Error(
      'No enabled shipment providers found. Please configure and enable a provider in Shipment Providers Setup.'
    );
    err.status = 400;
    throw err;
  }
  const isZeroCostOnlyKey = (key) => {
    const k = (key || '').toLowerCase();
    return k === 'store_pickup' || k === 'free_shipping';
  };
  const hasOnlyZeroCostProviders = enabledProviders.every((p) =>
    isZeroCostOnlyKey(p.provider_key)
  );
  if (
    !hasOnlyZeroCostProviders &&
    (!deliveryPincode || String(deliveryPincode).trim().length < 5)
  ) {
    const err = new Error('Valid delivery pincode is required');
    err.status = 400;
    throw err;
  }
  let pickupPincode = null;
  const pickup = await getDefaultPickupLocation();
  if (pickup && (pickup.zipCode || pickup.zip_code)) {
    pickupPincode = String(pickup.zipCode || pickup.zip_code).trim();
  }
  const hasCourierProvider = enabledProviders.some((p) => {
    const k = (p.provider_key || '').toLowerCase();
    return k === 'shiprocket' || k === 'delhivery';
  });
  if (hasCourierProvider && !pickupPincode) {
    const err = new Error(
      'No default pickup location with pincode configured. Please set a default pickup location in Store Settings.'
    );
    err.status = 400;
    throw err;
  }
  let pkg = null;
  if (userId) {
    pkg = await getCartPackageForUser(userId);
  }
  const finalWeight = pkg
    ? pkg.weight
    : Math.max(0.1, parseFloat(weight) || DEFAULT_PRODUCT_WEIGHT_KG);
  const finalLength = pkg
    ? pkg.length
    : Math.max(1, parseFloat(length) || DEFAULT_LENGTH_CM);
  const finalBreadth = pkg
    ? pkg.breadth
    : Math.max(1, parseFloat(breadth) || DEFAULT_BREADTH_CM);
  const finalHeight = pkg
    ? pkg.height
    : Math.max(1, parseFloat(height) || DEFAULT_HEIGHT_CM);
  let customerEmail = '';
  if (userId) {
    try {
      const user = await User.findByPk(userId, { attributes: ['email'] });
      customerEmail = user?.email || '';
    } catch (_) {}
  }
  const allRates = [];
  const errors = [];
  for (const provider of enabledProviders) {
    const key = (provider.provider_key || '').toLowerCase();
    try {
      if (key === 'store_pickup') {
        const rates = await getStorePickupRates(provider);
        allRates.push(...rates);
      } else if (key === 'free_shipping') {
        if (
          isFreeShippingApplicable(provider, {
            orderTotal: declaredValue,
            customerEmail,
            pincode: deliveryPincode,
          })
        ) {
          allRates.push(getFreeShippingRate(provider));
        }
      } else if (key === 'shiprocket') {
        if (!pickupPincode || !deliveryPincode) continue;
        const rates = await getShiprocketRates(provider, {
          pickupPincode,
          deliveryPincode,
          finalWeight,
          finalLength,
          finalBreadth,
          finalHeight,
          cod,
          declaredValue,
        });
        allRates.push(...rates);
      } else if (key === 'delhivery') {
        if (!pickupPincode || !deliveryPincode) continue;
        const rates = await getDelhiveryRates(provider, {
          pickupPincode,
          deliveryPincode,
          finalWeight,
          cod,
        });
        allRates.push(...rates);
      } else {
        console.warn(`Shipping rates not implemented for provider_key=${key}`);
      }
    } catch (e) {
      const msg =
        e.response?.data?.message ||
        (Array.isArray(e.response?.data?.errors)
          ? e.response.data.errors.join(', ')
          : null) ||
        e.message ||
        `Failed to fetch rates from ${provider.name}`;
      errors.push({
        providerId: provider.id,
        providerName: provider.name,
        message: msg,
      });
      console.error(`Rates error [${provider.name}]:`, msg);
    }
  }
  // Zero-cost options first, then cheapest courier rates
  allRates.sort((a, b) => {
    const aFree = a.isStorePickup || a.isFreeShipping || a.rate === 0;
    const bFree = b.isStorePickup || b.isFreeShipping || b.rate === 0;
    if (aFree && !bFree) return -1;
    if (!aFree && bFree) return 1;
    return a.rate - b.rate;
  });
  if (allRates.length === 0) {
    const detail =
      errors.length > 0
        ? errors.map((e) => `${e.providerName}: ${e.message}`).join('; ')
        : 'No shipping options available for this pincode.';
    const err = new Error(detail);
    err.status = 502;
    throw err;
  }
  const primaryProviderId = allRates[0]?.providerId || enabledProviders[0].id;
  return {
    rates: allRates,
    pickupPincode: pickupPincode || null,
    deliveryPincode: deliveryPincode
      ? String(deliveryPincode).trim()
      : null,
    providerId: primaryProviderId,
    providerName: allRates[0]?.providerName || null,
    package: {
      weight: finalWeight,
      length: finalLength,
      breadth: finalBreadth,
      height: finalHeight,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
};
const parseShippingAddressText = (text) => {
  const result = {
    fullName: '',
    streetAddress: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'India',
    phone: '',
    email: '',
  };
  if (!text || !String(text).trim()) return result;
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return result;
  if (!/^Phone:/i.test(lines[0])) {
    result.fullName = lines[0];
  }
  for (const line of lines) {
    if (/^Phone:/i.test(line)) {
      result.phone = line.replace(/^Phone:\s*/i, '').trim();
    }
    const phoneMatch = line.match(/(?:\+91[\s-]?)?([6-9]\d{9})\b/);
    if (phoneMatch && !result.phone) {
      result.phone = phoneMatch[1];
    }
  }
  for (const line of lines) {
    const pinMatch = line.match(/\b(\d{6})\b/);
    if (pinMatch) {
      result.zipCode = pinMatch[1];
      break;
    }
  }
  for (const line of lines) {
    if (
      /^(India|United States|United Kingdom|Canada|Australia|Germany|France)$/i.test(
        line
      )
    ) {
      result.country = line;
    }
  }
  const nonMeta = lines.filter(
    (l) =>
      !/^Phone:/i.test(l) &&
      !/^(India|United States|United Kingdom|Canada|Australia|Germany|France)$/i.test(
        l
      ) &&
      l !== result.fullName
  );
  if (nonMeta.length >= 1) {
    const streetLine = nonMeta[0];
    const streetParts = streetLine.split(',').map((p) => p.trim());
    result.streetAddress = streetParts[0] || streetLine;
    if (streetParts.length > 1) {
      result.apartment = streetParts.slice(1).join(', ');
    }
  }
  if (nonMeta.length >= 2) {
    let cityLine = nonMeta[1];
    cityLine = cityLine.replace(/\s*[-,]?\s*\d{6}\s*$/, '').trim();
    const parts = cityLine.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts[0]) result.city = parts[0];
    if (parts[1]) result.state = parts[1];
  }
  if (!result.city && nonMeta.length >= 3) {
    let cityLine = nonMeta[2].replace(/\s*[-,]?\s*\d{6}\s*$/, '').trim();
    const parts = cityLine.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts[0]) result.city = parts[0];
    if (parts[1]) result.state = parts[1];
  }
  return result;
};
const buildCompleteAddress = (addrObj, order) => {
  const user = order?.user || {};
  const addr = { ...(addrObj || {}) };
  if (!addr.fullName || !String(addr.fullName).trim()) {
    addr.fullName = user.fullName || 'Customer';
  }
  if (!addr.phone || !String(addr.phone).trim()) {
    addr.phone = user.phone || '';
  }
  if (!addr.email || !String(addr.email).trim()) {
    addr.email = user.email || 'customer@example.com';
  }
  if (!addr.country || !String(addr.country).trim()) {
    addr.country = 'India';
  }
  if (!addr.streetAddress || !String(addr.streetAddress).trim()) {
    const raw = order?.shippingAddress || order?.billingAddress || '';
    const firstLine = String(raw)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)[1];
    addr.streetAddress = firstLine || 'Address not specified';
  }
  if (!addr.city || !String(addr.city).trim()) {
    addr.city = 'Unknown';
  }
  if (!addr.state || !String(addr.state).trim()) {
    addr.state = 'Unknown';
  }
  if (addr.phone) {
    const digits = String(addr.phone).replace(/\D/g, '');
    addr.phone = digits.length >= 10 ? digits.slice(-10) : digits || '9999999999';
  } else {
    addr.phone = '9999999999';
  }
  return addr;
};
const validateAddressForShiprocket = (addr) => {
  const missing = [];
  if (!addr.streetAddress || addr.streetAddress === 'Address not specified') {
    missing.push('street address');
  }
  if (!addr.city || addr.city === 'Unknown') {
    missing.push('city');
  }
  if (!addr.zipCode || String(addr.zipCode).length < 6) {
    missing.push('pincode (6 digits)');
  }
  if (missing.length > 0) {
    const err = new Error(
      `Cannot create shipment: order shipping address is incomplete (missing ${missing.join(
        ', '
      )})`
    );
    err.status = 400;
    throw err;
  }
};
const createShiprocketOrder = async (order, orderItems, addrObj, selectedCourier = {}) => {
  const provider = selectedCourier.shipmentProviderId
    ? await getProviderById(selectedCourier.shipmentProviderId)
    : await getEnabledShiprocketProvider();
  const token = await getShiprocketToken(provider);
  const env = (provider.credentials?.environment || 'production').toLowerCase();
  const base = SHIPROCKET_BASE[env] || SHIPROCKET_BASE.production;
  const pickup = await getDefaultPickupLocation();
  if (!pickup) {
    const err = new Error('No active pickup location configured');
    err.status = 400;
    throw err;
  }
  const addr = buildCompleteAddress(addrObj, order);
  validateAddressForShiprocket(addr);
  const nameParts = String(addr.fullName || 'Customer').trim().split(/\s+/);
  const firstName = nameParts[0] || 'Customer';
  const lastName = nameParts.slice(1).join(' ') || '';
  const billingPhone = addr.phone || '9999999999';
  const orderItemsPayload = (orderItems || []).map((item) => {
    const product = item.product || {};
    const variant = item.variant || {};
    return {
      name: product.name || 'Product',
      sku: variant.sku || product.defaultSku || `SKU-${item.productId || item.id}`,
      units: item.quantity || 1,
      selling_price: parseFloat(item.price) || parseFloat(order.total) || 1,
      discount: 0,
      tax: 0,
      hsn: 0,
    };
  });
  if (orderItemsPayload.length === 0) {
    orderItemsPayload.push({
      name: 'Order Item',
      sku: `ORD-${order.id}`,
      units: 1,
      selling_price: parseFloat(order.total) || 1,
      discount: 0,
      tax: 0,
      hsn: 0,
    });
  }
  const subTotal =
    parseFloat(order.total) - (parseFloat(order.shippingAmount) || 0) ||
    parseFloat(order.total) ||
    1;
  const packageDims = computePackageFromItems(orderItems);
  let courierId = selectedCourier.courierCompanyId
    ? String(selectedCourier.courierCompanyId)
    : null;
  if (courierId && courierId.startsWith('shiprocket-')) {
    courierId = courierId.replace(/^shiprocket-/, '');
  }
  const payload = {
    order_id: String(order.merchantOrderId || `ORD-${order.id}`),
    order_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
    pickup_location: pickup.name || 'Primary',
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: String(addr.streetAddress).trim(),
    billing_address_2: String(addr.apartment || '').trim(),
    billing_city: String(addr.city).trim(),
    billing_pincode: String(addr.zipCode).trim(),
    billing_state: String(addr.state || 'Unknown').trim(),
    billing_country: String(addr.country || 'India').trim(),
    billing_email: String(addr.email || 'customer@example.com').trim(),
    billing_phone: billingPhone,
    shipping_is_billing: true,
    order_items: orderItemsPayload,
    payment_method: order.paymentStatus === 'cod' ? 'COD' : 'Prepaid',
    sub_total: Math.max(1, subTotal),
    length: packageDims.length,
    breadth: packageDims.breadth,
    height: packageDims.height,
    weight: packageDims.weight,
  };
  if (courierId) {
    payload.courier_id = courierId;
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
      providerKey: 'shiprocket',
    };
  } catch (e) {
    const apiMsg =
      e.response?.data?.message ||
      (typeof e.response?.data === 'object'
        ? JSON.stringify(e.response.data)
        : null) ||
      e.message ||
      'Failed to create Shiprocket order';
    let friendly = apiMsg;
    if (
      /billing\/shipping address|add billing|shipping address first/i.test(
        String(apiMsg)
      )
    ) {
      friendly =
        'Shiprocket rejected the address. Ensure the order has a complete shipping address with street, city and 6-digit pincode.';
    }
    return {
      error: friendly,
      shiprocketOrderId: null,
      shiprocketShipmentId: null,
      awbCode: null,
      status: 'Fail',
      raw: e.response?.data || { message: apiMsg },
      providerId: provider.id,
      providerKey: 'shiprocket',
    };
  }
};
const ensureDelhiveryWarehouse = async (provider, pickup, addr) => {
  const token = getDelhiveryToken(provider);
  const env = (provider.credentials?.environment || 'production').toLowerCase();
  const base = DELHIVERY_BASE[env] || DELHIVERY_BASE.production;
  const name = pickup.name || 'Primary';
  const payload = {
    name,
    registered_name: name,
    phone: addr.phone || pickup.phone || '9999999999',
    email: addr.email || 'store@example.com',
    address: [pickup.street_address || pickup.streetAddress, pickup.apartment]
      .filter(Boolean)
      .join(', ') || 'Warehouse',
    city: pickup.city || 'Unknown',
    state: pickup.state || 'Unknown',
    country: pickup.country || 'India',
    pin: String(pickup.zip_code || pickup.zipCode || '').trim(),
    return_address: [pickup.street_address || pickup.streetAddress, pickup.apartment]
      .filter(Boolean)
      .join(', ') || 'Warehouse',
    return_city: pickup.city || 'Unknown',
    return_state: pickup.state || 'Unknown',
    return_country: pickup.country || 'India',
    return_pin: String(pickup.zip_code || pickup.zipCode || '').trim(),
  };
  try {
    const res = await axios.post(
      `${base}/api/backend/clientwarehouse/create/`,
      payload,
      {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    return res.data;
  } catch (e) {
    const msg =
      e.response?.data?.error ||
      e.response?.data?.rmk ||
      e.response?.data?.message ||
      e.message ||
      '';
    if (String(msg).toLowerCase().includes('already exists')) {
      return { success: true, alreadyExists: true };
    }
    console.warn('Delhivery warehouse create warning:', msg);
    return { success: false, message: msg };
  }
};
const createDelhiveryOrder = async (order, orderItems, addrObj, selectedCourier = {}) => {
  const provider = selectedCourier.shipmentProviderId
    ? await getProviderById(selectedCourier.shipmentProviderId)
    : await getEnabledDelhiveryProvider();
  const token = getDelhiveryToken(provider);
  const env = (provider.credentials?.environment || 'production').toLowerCase();
  const base = DELHIVERY_BASE[env] || DELHIVERY_BASE.production;
  const pickup = await getDefaultPickupLocation();
  if (!pickup) {
    const err = new Error('No active pickup location configured');
    err.status = 400;
    throw err;
  }
  const addr = buildCompleteAddress(addrObj, order);
  validateAddressForShiprocket(addr);
  await ensureDelhiveryWarehouse(provider, pickup, addr);
  const packageDims = computePackageFromItems(orderItems);
  const weightGrams = Math.max(1, Math.round(packageDims.weight * 1000));
  const paymentMode = order.paymentStatus === 'cod' ? 'COD' : 'Prepaid';
  const codAmount =
    paymentMode === 'COD'
      ? parseFloat(order.total) || 0
      : 0;
  const productName =
    (orderItems && orderItems[0] && (orderItems[0].product?.name || 'Product')) ||
    'Product';
  const quantity = (orderItems || []).reduce(
    (sum, it) => sum + (parseInt(it.quantity, 10) || 1),
    0
  ) || 1;
  let shippingMode = 'Surface';
  const cid = String(selectedCourier.courierCompanyId || selectedCourier.rawCourierId || '');
  if (
    cid === 'delhivery-E' ||
    cid === 'E' ||
    /express/i.test(selectedCourier.courierName || '') ||
    selectedCourier.shippingMode === 'Express'
  ) {
    shippingMode = 'Express';
  }
  const clientName =
    provider.credentials?.client_name ||
    provider.name ||
    'STORE';
  const orderPayload = {
    shipments: [
      {
        name: String(addr.fullName || 'Customer').trim(),
        add: [addr.streetAddress, addr.apartment].filter(Boolean).join(', '),
        city: String(addr.city || '').trim(),
        state: String(addr.state || 'Unknown').trim(),
        country: String(addr.country || 'India').trim(),
        pin: String(addr.zipCode || '').trim(),
        phone: String(addr.phone || '9999999999').trim(),
        order: String(order.merchantOrderId || `ORD-${order.id}`),
        payment_mode: paymentMode,
        weight: String(weightGrams),
        total_amount: String(parseFloat(order.total) || 0),
        cod_amount: String(codAmount),
        quantity: String(quantity),
        products_desc: productName,
        order_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        shipping_mode: shippingMode,
        client: clientName,
      },
    ],
    pickup_location: {
      name: pickup.name || 'Primary',
    },
  };
  try {
    const res = await axios.post(
      `${base}/api/cmu/create.json`,
      new URLSearchParams({
        format: 'json',
        data: JSON.stringify(orderPayload),
      }).toString(),
      {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      }
    );
    const data = res.data || {};
    const pkg0 = (data.packages && data.packages[0]) || {};
    const waybill = pkg0.waybill || null;
    const status = pkg0.status || data.status || null;
    const success = data.success === true || (!!waybill && status !== 'Fail');
    if (!success || !waybill) {
      const remarks =
        (pkg0.remarks && (Array.isArray(pkg0.remarks) ? pkg0.remarks.join(', ') : pkg0.remarks)) ||
        data.rmk ||
        data.message ||
        'Delhivery order creation failed';
      return {
        error: remarks,
        shiprocketOrderId: null,
        shiprocketShipmentId: null,
        awbCode: null,
        status: 'Fail',
        raw: data,
        providerId: provider.id,
        providerKey: 'delhivery',
      };
    }
    try {
      const pickupDate = new Date();
      pickupDate.setDate(pickupDate.getDate() + 1);
      const pickupPayload = {
        pickup_date: pickupDate.toISOString().slice(0, 10),
        pickup_time: '10:00:00',
        pickup_location: pickup.name || 'Primary',
        expected_package_count: 1,
      };
      await axios.post(`${base}/fm/request/new/`, pickupPayload, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (pickupErr) {
      console.warn('Delhivery pickup request warning:', pickupErr.message);
    }
    return {
      shiprocketOrderId: null,
      shiprocketShipmentId: null,
      awbCode: String(waybill),
      status: status || 'created',
      raw: data,
      providerId: provider.id,
      providerKey: 'delhivery',
    };
  } catch (e) {
    const apiMsg =
      e.response?.data?.message ||
      e.response?.data?.rmk ||
      (typeof e.response?.data === 'object'
        ? JSON.stringify(e.response.data)
        : null) ||
      e.message ||
      'Failed to create Delhivery order';
    return {
      error: apiMsg,
      shiprocketOrderId: null,
      shiprocketShipmentId: null,
      awbCode: null,
      status: 'Fail',
      raw: e.response?.data || { message: apiMsg },
      providerId: provider.id,
      providerKey: 'delhivery',
    };
  }
};
const createStorePickupOrder = async (order, orderItems, addrObj, selectedCourier = {}) => {
  let provider = null;
  if (selectedCourier.shipmentProviderId) {
    try {
      provider = await getProviderById(selectedCourier.shipmentProviderId);
    } catch (_) {}
  }
  if (!provider) {
    provider = await Provider.findOne({
      where: {
        provider_type: 'shipment',
        provider_key: 'store_pickup',
        is_enabled: true,
      },
      order: [['createdAt', 'DESC']],
    });
  }
  if (!provider) {
    const err = new Error(
      'No enabled Store Pickup provider found. Please configure and enable it in Shipment Providers Setup.'
    );
    err.status = 400;
    throw err;
  }
  let pickupLocationId = selectedCourier.pickupLocationId || null;
  if (!pickupLocationId && selectedCourier.courierCompanyId) {
    const m = String(selectedCourier.courierCompanyId).match(/^store-pickup-(\d+)$/);
    if (m) pickupLocationId = parseInt(m[1], 10);
  }
  if (!pickupLocationId && selectedCourier.rawCourierId) {
    const n = parseInt(selectedCourier.rawCourierId, 10);
    if (!Number.isNaN(n)) pickupLocationId = n;
  }
  let pickupLoc = null;
  if (pickupLocationId) {
    pickupLoc = await PickupLocation.findByPk(pickupLocationId);
  }
  if (!pickupLoc) {
    pickupLoc = await getDefaultPickupLocation();
  }
  const locationName = pickupLoc
    ? pickupLoc.name
    : selectedCourier.pickupLocationName || 'Store';
  const addressParts = pickupLoc
    ? [
        pickupLoc.streetAddress || pickupLoc.street_address,
        pickupLoc.apartment,
        pickupLoc.city,
        pickupLoc.state,
        pickupLoc.zipCode || pickupLoc.zip_code,
        pickupLoc.country,
      ]
        .filter(Boolean)
        .join(', ')
    : selectedCourier.pickupLocationAddress || '';
  return {
    shiprocketOrderId: null,
    shiprocketShipmentId: null,
    awbCode: null,
    status: 'ready_for_pickup',
    raw: {
      type: 'store_pickup',
      pickupLocationId: pickupLoc ? pickupLoc.id : null,
      pickupLocationName: locationName,
      pickupLocationAddress: addressParts,
      message: `Order ready for pickup at ${locationName}`,
    },
    providerId: provider.id,
    providerKey: 'store_pickup',
    isStorePickup: true,
    pickupLocationId: pickupLoc ? pickupLoc.id : null,
    pickupLocationName: locationName,
  };
};
/**
 * Free shipping – no external courier. Mark order as free-shipping applied.
 */
const createFreeShippingOrder = async (order, orderItems, addrObj, selectedCourier = {}) => {
  let provider = null;
  if (selectedCourier.shipmentProviderId) {
    try {
      provider = await getProviderById(selectedCourier.shipmentProviderId);
    } catch (_) {}
  }
  if (!provider) {
    provider = await Provider.findOne({
      where: {
        provider_type: 'shipment',
        provider_key: 'free_shipping',
        is_enabled: true,
      },
      order: [['createdAt', 'DESC']],
    });
  }
  if (!provider) {
    const err = new Error(
      'No enabled Free Shipping provider found. Please configure and enable it in Shipment Providers Setup.'
    );
    err.status = 400;
    throw err;
  }
  return {
    shiprocketOrderId: null,
    shiprocketShipmentId: null,
    awbCode: null,
    status: 'free_shipping',
    raw: {
      type: 'free_shipping',
      message: 'Free shipping applied based on configured conditions',
      providerName: provider.name,
    },
    providerId: provider.id,
    providerKey: 'free_shipping',
    isFreeShipping: true,
  };
};
const createShipmentOrder = async (order, orderItems, addrObj, selectedCourier = {}) => {
  let providerKey = null;
  if (selectedCourier.shipmentProviderId) {
    try {
      const p = await getProviderById(selectedCourier.shipmentProviderId);
      providerKey = (p.provider_key || '').toLowerCase();
    } catch (_) {}
  }
  if (!providerKey && selectedCourier.courierCompanyId) {
    const cid = String(selectedCourier.courierCompanyId);
    if (cid.startsWith('store-pickup') || selectedCourier.isStorePickup) {
      providerKey = 'store_pickup';
    } else if (cid.startsWith('free-shipping') || selectedCourier.isFreeShipping) {
      providerKey = 'free_shipping';
    } else if (cid.startsWith('delhivery-') || cid === 'S' || cid === 'E') {
      providerKey = 'delhivery';
    } else {
      providerKey = 'shiprocket';
    }
  }
  if (!providerKey && selectedCourier.providerKey) {
    providerKey = String(selectedCourier.providerKey).toLowerCase();
  }
  if (!providerKey) {
    try {
      await getEnabledShiprocketProvider();
      providerKey = 'shiprocket';
    } catch (_) {
      try {
        await getEnabledDelhiveryProvider();
        providerKey = 'delhivery';
      } catch (__) {
        const storePickup = await Provider.findOne({
          where: {
            provider_type: 'shipment',
            provider_key: 'store_pickup',
            is_enabled: true,
          },
        });
        if (storePickup) {
          providerKey = 'store_pickup';
        } else {
          const freeShip = await Provider.findOne({
            where: {
              provider_type: 'shipment',
              provider_key: 'free_shipping',
              is_enabled: true,
            },
          });
          if (freeShip) {
            providerKey = 'free_shipping';
          } else {
            const err = new Error('No enabled shipment provider available');
            err.status = 400;
            throw err;
          }
        }
      }
    }
  }
  if (providerKey === 'store_pickup') {
    return createStorePickupOrder(order, orderItems, addrObj, selectedCourier);
  }
  if (providerKey === 'free_shipping') {
    return createFreeShippingOrder(order, orderItems, addrObj, selectedCourier);
  }
  if (providerKey === 'delhivery') {
    return createDelhiveryOrder(order, orderItems, addrObj, selectedCourier);
  }
  return createShiprocketOrder(order, orderItems, addrObj, selectedCourier);
};
const trackShipment = async (order) => {
  if (!order.awbCode && !order.shiprocketShipmentId && !order.shiprocketOrderId) {
    if (
      order.shipmentStatus === 'ready_for_pickup' ||
      (order.shipmentDetails && order.shipmentDetails.type === 'store_pickup')
    ) {
      return {
        status: 'ready_for_pickup',
        awbCode: null,
        raw: order.shipmentDetails || { type: 'store_pickup' },
        providerKey: 'store_pickup',
      };
    }
    if (
      order.shipmentStatus === 'free_shipping' ||
      (order.shipmentDetails && order.shipmentDetails.type === 'free_shipping')
    ) {
      return {
        status: 'free_shipping',
        awbCode: null,
        raw: order.shipmentDetails || { type: 'free_shipping' },
        providerKey: 'free_shipping',
      };
    }
    const err = new Error('No AWB / shipment ID available to track');
    err.status = 400;
    throw err;
  }
  let provider = null;
  if (order.shipmentProviderId) {
    try {
      provider = await getProviderById(order.shipmentProviderId);
    } catch (_) {}
  }
  const key = (provider?.provider_key || '').toLowerCase();
  if (key === 'store_pickup') {
    return {
      status: order.shipmentStatus || 'ready_for_pickup',
      awbCode: null,
      raw: order.shipmentDetails || { type: 'store_pickup' },
      providerKey: 'store_pickup',
    };
  }
  if (key === 'free_shipping') {
    return {
      status: order.shipmentStatus || 'free_shipping',
      awbCode: null,
      raw: order.shipmentDetails || { type: 'free_shipping' },
      providerKey: 'free_shipping',
    };
  }
  if (key === 'delhivery' || (!key && order.awbCode && !order.shiprocketOrderId)) {
    const token = getDelhiveryToken(provider || (await getEnabledDelhiveryProvider()));
    const env = ((provider || {}).credentials?.environment || 'production').toLowerCase();
    const base = DELHIVERY_BASE[env] || DELHIVERY_BASE.production;
    try {
      const res = await axios.get(`${base}/api/v1/packages/json/`, {
        headers: { Accept: 'application/json' },
        params: {
          token,
          waybill: order.awbCode,
        },
      });
      return {
        status: res.data?.status || null,
        awbCode: order.awbCode,
        raw: res.data,
        providerKey: 'delhivery',
      };
    } catch (e) {
      const msg =
        e.response?.data?.message || e.message || 'Failed to track Delhivery shipment';
      const err = new Error(msg);
      err.status = e.response?.status || 502;
      throw err;
    }
  }
  provider = provider || (await getEnabledShiprocketProvider());
  const token = await getShiprocketToken(provider);
  const env = (provider.credentials?.environment || 'production').toLowerCase();
  const base = SHIPROCKET_BASE[env] || SHIPROCKET_BASE.production;
  try {
    if (order.awbCode) {
      const res = await axios.get(`${base}/courier/track/awb/${order.awbCode}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data?.tracking_data || res.data?.data || res.data || {};
      return {
        status: data.track_status || data.status || null,
        awbCode: order.awbCode,
        raw: data,
        providerKey: 'shiprocket',
      };
    }
    if (order.shiprocketShipmentId) {
      const res = await axios.get(
        `${base}/courier/track/shipment/${order.shiprocketShipmentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = res.data?.tracking_data || res.data?.data || res.data || {};
      return {
        status: data.track_status || data.status || null,
        awbCode: data.awb_code || order.awbCode,
        raw: data,
        providerKey: 'shiprocket',
      };
    }
    const err = new Error('No trackable identifier');
    err.status = 400;
    throw err;
  } catch (e) {
    const msg =
      e.response?.data?.message || e.message || 'Failed to track shipment';
    const err = new Error(msg);
    err.status = e.response?.status || 502;
    throw err;
  }
};
const cancelShipment = async (order) => {
  if (!order.shiprocketOrderId && !order.awbCode) {
    if (
      order.shipmentStatus === 'ready_for_pickup' ||
      (order.shipmentDetails && order.shipmentDetails.type === 'store_pickup')
    ) {
      return {
        success: true,
        message: 'Store pickup order cancelled (no external shipment)',
        raw: null,
      };
    }
    if (
      order.shipmentStatus === 'free_shipping' ||
      (order.shipmentDetails && order.shipmentDetails.type === 'free_shipping')
    ) {
      return {
        success: true,
        message: 'Free shipping order cancelled (no external shipment)',
        raw: null,
      };
    }
    const err = new Error('No Shiprocket order/AWB to cancel');
    err.status = 400;
    throw err;
  }
  const provider = order.shipmentProviderId
    ? await getProviderById(order.shipmentProviderId)
    : await getEnabledShiprocketProvider();
  const key = (provider.provider_key || '').toLowerCase();
  if (key === 'store_pickup') {
    return {
      success: true,
      message: 'Store pickup order cancelled (no external shipment)',
      raw: null,
    };
  }
  if (key === 'free_shipping') {
    return {
      success: true,
      message: 'Free shipping order cancelled (no external shipment)',
      raw: null,
    };
  }
  if (key === 'delhivery') {
    return {
      success: false,
      message:
        'Delhivery shipment cancellation must be done from the Delhivery dashboard or support.',
      raw: null,
    };
  }
  const token = await getShiprocketToken(provider);
  const env = (provider.credentials?.environment || 'production').toLowerCase();
  const base = SHIPROCKET_BASE[env] || SHIPROCKET_BASE.production;
  try {
    const ids = order.shiprocketOrderId ? [Number(order.shiprocketOrderId)] : [];
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
module.exports = {
  getShippingRates,
  createShiprocketOrder,
  createDelhiveryOrder,
  createStorePickupOrder,
  createFreeShippingOrder,
  createShipmentOrder,
  trackShipment,
  cancelShipment,
  getEnabledShiprocketProvider,
  getEnabledDelhiveryProvider,
  getEnabledShipmentProviders,
  getDefaultPickupLocation,
  getActivePickupLocations,
  getShiprocketToken,
  getProviderById,
  parseShippingAddressText,
  buildCompleteAddress,
  validateAddressForShiprocket,
  computePackageFromItems,
  getCartPackageForUser,
  DEFAULT_PRODUCT_WEIGHT_KG,
};
