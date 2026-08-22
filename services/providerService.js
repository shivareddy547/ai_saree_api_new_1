const { Provider } = require('../models');
const getAllProviders = async () => {
  try {
    const providers = await Provider.findAll({
      order: [['createdAt', 'DESC']],
    });
    return providers;
  } catch (error) {
    const err = new Error('Failed to fetch providers');
    err.status = 500;
    throw err;
  }
};
const getProviderById = async (id) => {
  try {
    const provider = await Provider.findByPk(id);
    if (!provider) {
      const err = new Error('Provider not found');
      err.status = 404;
      throw err;
    }
    return provider;
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to fetch provider');
    err.status = 500;
    throw err;
  }
};
const createProvider = async (data) => {
  try {
    if (!data.provider_type || !['smtp', 'sms', 'social', 'payment', 'shipment'].includes(data.provider_type)) {
      const err = new Error('provider_type must be smtp, sms, social, payment, or shipment');
      err.status = 400;
      throw err;
    }
    if (!data.name || !data.name.trim()) {
      const err = new Error('Name is required');
      err.status = 400;
      throw err;
    }
    if (!data.credentials || typeof data.credentials !== 'object') {
      const err = new Error('Credentials must be a valid object');
      err.status = 400;
      throw err;
    }
    // Basic validation for free_shipping config
    if (data.provider_key === 'free_shipping') {
      const c = data.credentials;
      const hasAny =
        c.use_order_total === 'true' ||
        c.use_emails === 'true' ||
        c.use_pincodes === 'true';
      if (!hasAny) {
        const err = new Error('Free shipping requires at least one condition (order total, emails, or pincodes)');
        err.status = 400;
        throw err;
      }
      if (c.use_order_total === 'true') {
        const min = Number(c.min_order_total);
        if (isNaN(min) || min < 0) {
          const err = new Error('min_order_total must be a non-negative number');
          err.status = 400;
          throw err;
        }
      }
    }
    const provider = await Provider.create({
      provider_type: data.provider_type,
      name: data.name.trim(),
      provider_key: data.provider_key || null,
      is_enabled: data.is_enabled === true,
      credentials: data.credentials,
    });
    return provider;
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to create provider');
    err.status = 500;
    throw err;
  }
};
const updateProvider = async (id, data) => {
  try {
    const provider = await Provider.findByPk(id);
    if (!provider) {
      const err = new Error('Provider not found');
      err.status = 404;
      throw err;
    }
    if (data.name !== undefined) {
      if (!data.name || !data.name.trim()) {
        const err = new Error('Name cannot be empty');
        err.status = 400;
        throw err;
      }
      provider.name = data.name.trim();
    }
    if (data.provider_key !== undefined) {
      provider.provider_key = data.provider_key || null;
    }
    if (data.credentials !== undefined) {
      if (typeof data.credentials !== 'object') {
        const err = new Error('Credentials must be a valid object');
        err.status = 400;
        throw err;
      }
      // Basic validation for free_shipping config
      if ((data.provider_key || provider.provider_key) === 'free_shipping') {
        const c = data.credentials;
        const hasAny =
          c.use_order_total === 'true' ||
          c.use_emails === 'true' ||
          c.use_pincodes === 'true';
        if (!hasAny) {
          const err = new Error('Free shipping requires at least one condition (order total, emails, or pincodes)');
          err.status = 400;
          throw err;
        }
        if (c.use_order_total === 'true') {
          const min = Number(c.min_order_total);
          if (isNaN(min) || min < 0) {
            const err = new Error('min_order_total must be a non-negative number');
            err.status = 400;
            throw err;
          }
        }
      }
      provider.credentials = data.credentials;
    }
    if (data.is_enabled !== undefined) {
      provider.is_enabled = data.is_enabled === true;
    }
    await provider.save();
    return provider;
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to update provider');
    err.status = 500;
    throw err;
  }
};
const toggleProvider = async (id) => {
  try {
    const provider = await Provider.findByPk(id);
    if (!provider) {
      const err = new Error('Provider not found');
      err.status = 404;
      throw err;
    }
    provider.is_enabled = !provider.is_enabled;
    await provider.save();
    return provider;
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to toggle provider');
    err.status = 500;
    throw err;
  }
};
const deleteProvider = async (id) => {
  try {
    const provider = await Provider.findByPk(id);
    if (!provider) {
      const err = new Error('Provider not found');
      err.status = 404;
      throw err;
    }
    await provider.destroy();
    return true;
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to delete provider');
    err.status = 500;
    throw err;
  }
};
/**
 * Evaluate whether free shipping should be applied for the given context.
 * Used by checkout / order flow.
 * @param {object} context - { orderTotal, customerEmail, pincode }
 * @returns {Promise<{ eligible: boolean, provider: object|null, reason: string }>}
 */
const evaluateFreeShipping = async (context = {}) => {
  try {
    const { orderTotal = 0, customerEmail = '', pincode = '' } = context;
    const freeProviders = await Provider.findAll({
      where: {
        provider_type: 'shipment',
        provider_key: 'free_shipping',
        is_enabled: true,
      },
    });
    if (!freeProviders || freeProviders.length === 0) {
      return { eligible: false, provider: null, reason: 'No enabled free shipping provider' };
    }
    const normalizeList = (str) =>
      String(str || '')
        .split(/[,;\n]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    for (const provider of freeProviders) {
      const c = provider.credentials || {};
      let matched = false;
      let reasonParts = [];
      if (c.use_order_total === 'true') {
        const min = Number(c.min_order_total) || 0;
        if (Number(orderTotal) >= min) {
          matched = true;
          reasonParts.push(`order total ≥ ₹${min}`);
        }
      }
      if (c.use_emails === 'true') {
        const emails = normalizeList(c.allowed_emails);
        const email = String(customerEmail || '').trim().toLowerCase();
        if (email && emails.includes(email)) {
          matched = true;
          reasonParts.push('email match');
        }
      }
      if (c.use_pincodes === 'true') {
        const pins = normalizeList(c.allowed_pincodes);
        const pin = String(pincode || '').trim().toLowerCase();
        if (pin && pins.includes(pin)) {
          matched = true;
          reasonParts.push('pincode match');
        }
      }
      if (matched) {
        return {
          eligible: true,
          provider,
          reason: reasonParts.join(', ') || 'condition matched',
        };
      }
    }
    return { eligible: false, provider: null, reason: 'No free shipping conditions matched' };
  } catch (error) {
    const err = new Error('Failed to evaluate free shipping');
    err.status = 500;
    throw err;
  }
};
module.exports = {
  getAllProviders,
  getProviderById,
  createProvider,
  updateProvider,
  toggleProvider,
  deleteProvider,
  evaluateFreeShipping,
};
