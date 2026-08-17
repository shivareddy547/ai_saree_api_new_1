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
    if (!data.provider_type || !['smtp', 'sms', 'social', 'payment'].includes(data.provider_type)) {
      const err = new Error('provider_type must be smtp, sms, social, or payment');
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
module.exports = {
  getAllProviders,
  getProviderById,
  createProvider,
  updateProvider,
  toggleProvider,
  deleteProvider,
};
