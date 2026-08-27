const { AiProvider, AiModel } = require('../models');
const { createProviderAdapter } = require('./aiProviderAdapters');
const { Op } = require('sequelize');
const VALID_PROVIDERS = [
  'openai',
  'anthropic',
  'gemini',
  'azure_openai',
  'ollama',
  'groq',
  'mistral',
  'bedrock',
];
const maskSecret = (value) => {
  if (!value || typeof value !== 'string') return null;
  if (value.length <= 4) return '••••';
  return '••••' + value.slice(-4);
};
const sanitizeProvider = (provider) => {
  if (!provider) return null;
  const json = provider.toJSON ? provider.toJSON() : { ...provider };
  return {
    ...json,
    api_key: maskSecret(json.api_key),
    api_secret: maskSecret(json.api_secret),
    has_api_key: !!json.api_key,
    has_api_secret: !!json.api_secret,
  };
};
const getAllProviders = async () => {
  try {
    const providers = await AiProvider.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: AiModel,
          as: 'models',
          required: false,
        },
      ],
    });
    return providers.map(sanitizeProvider);
  } catch (error) {
    const err = new Error('Failed to fetch AI providers');
    err.status = 500;
    throw err;
  }
};
const getProviderById = async (id, includeSecrets = false) => {
  try {
    const provider = await AiProvider.findByPk(id, {
      include: [{ model: AiModel, as: 'models', required: false }],
    });
    if (!provider) {
      const err = new Error('AI provider not found');
      err.status = 404;
      throw err;
    }
    if (includeSecrets) return provider;
    return sanitizeProvider(provider);
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to fetch AI provider');
    err.status = 500;
    throw err;
  }
};
const createProvider = async (data) => {
  try {
    if (!data.name || !String(data.name).trim()) {
      const err = new Error('Name is required');
      err.status = 400;
      throw err;
    }
    if (!data.provider || !VALID_PROVIDERS.includes(String(data.provider).toLowerCase())) {
      const err = new Error(
        `provider must be one of: ${VALID_PROVIDERS.join(', ')}`
      );
      err.status = 400;
      throw err;
    }
    const existing = await AiProvider.findOne({
      where: { name: String(data.name).trim() },
    });
    if (existing) {
      const err = new Error('Provider name must be unique');
      err.status = 400;
      throw err;
    }
    const isDefault = data.default_provider === true;
    if (isDefault) {
      await AiProvider.update(
        { default_provider: false },
        { where: { default_provider: true } }
      );
    }
    const provider = await AiProvider.create({
      name: String(data.name).trim(),
      provider: String(data.provider).toLowerCase(),
      api_key: data.api_key || null,
      api_secret: data.api_secret || null,
      endpoint: data.endpoint || null,
      organization_id: data.organization_id || null,
      project_id: data.project_id || null,
      region: data.region || null,
      enabled: data.enabled !== false,
      default_provider: isDefault,
      timeout: data.timeout != null ? Number(data.timeout) : 60,
      max_retries: data.max_retries != null ? Number(data.max_retries) : 3,
      metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},
    });
    return sanitizeProvider(provider);
  } catch (error) {
    if (error.status) throw error;
    if (error.name === 'SequelizeUniqueConstraintError') {
      const err = new Error('Provider name must be unique');
      err.status = 400;
      throw err;
    }
    const err = new Error('Failed to create AI provider');
    err.status = 500;
    throw err;
  }
};
const updateProvider = async (id, data) => {
  try {
    const provider = await AiProvider.findByPk(id);
    if (!provider) {
      const err = new Error('AI provider not found');
      err.status = 404;
      throw err;
    }
    if (data.name !== undefined) {
      if (!data.name || !String(data.name).trim()) {
        const err = new Error('Name cannot be empty');
        err.status = 400;
        throw err;
      }
      const existing = await AiProvider.findOne({
        where: {
          name: String(data.name).trim(),
          id: { [Op.ne]: id },
        },
      });
      if (existing) {
        const err = new Error('Provider name must be unique');
        err.status = 400;
        throw err;
      }
      provider.name = String(data.name).trim();
    }
    if (data.provider !== undefined) {
      if (!VALID_PROVIDERS.includes(String(data.provider).toLowerCase())) {
        const err = new Error(
          `provider must be one of: ${VALID_PROVIDERS.join(', ')}`
        );
        err.status = 400;
        throw err;
      }
      provider.provider = String(data.provider).toLowerCase();
    }
    if (data.api_key !== undefined && data.api_key !== '') {
      provider.api_key = data.api_key;
    }
    if (data.api_secret !== undefined && data.api_secret !== '') {
      provider.api_secret = data.api_secret;
    }
    if (data.endpoint !== undefined) provider.endpoint = data.endpoint || null;
    if (data.organization_id !== undefined) provider.organization_id = data.organization_id || null;
    if (data.project_id !== undefined) provider.project_id = data.project_id || null;
    if (data.region !== undefined) provider.region = data.region || null;
    if (data.enabled !== undefined) provider.enabled = data.enabled === true;
    if (data.timeout !== undefined) provider.timeout = Number(data.timeout) || 60;
    if (data.max_retries !== undefined) provider.max_retries = Number(data.max_retries) || 3;
    if (data.metadata !== undefined && typeof data.metadata === 'object') {
      provider.metadata = data.metadata;
    }
    if (data.default_provider === true) {
      await AiProvider.update(
        { default_provider: false },
        { where: { default_provider: true, id: { [Op.ne]: id } } }
      );
      provider.default_provider = true;
    } else if (data.default_provider === false) {
      provider.default_provider = false;
    }
    await provider.save();
    return sanitizeProvider(provider);
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to update AI provider');
    err.status = 500;
    throw err;
  }
};
const toggleProvider = async (id) => {
  try {
    const provider = await AiProvider.findByPk(id);
    if (!provider) {
      const err = new Error('AI provider not found');
      err.status = 404;
      throw err;
    }
    provider.enabled = !provider.enabled;
    await provider.save();
    return sanitizeProvider(provider);
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to toggle AI provider');
    err.status = 500;
    throw err;
  }
};
const setDefaultProvider = async (id) => {
  try {
    const provider = await AiProvider.findByPk(id);
    if (!provider) {
      const err = new Error('AI provider not found');
      err.status = 404;
      throw err;
    }
    await AiProvider.update(
      { default_provider: false },
      { where: { default_provider: true } }
    );
    provider.default_provider = true;
    await provider.save();
    return sanitizeProvider(provider);
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to set default AI provider');
    err.status = 500;
    throw err;
  }
};
const deleteProvider = async (id) => {
  try {
    const provider = await AiProvider.findByPk(id);
    if (!provider) {
      const err = new Error('AI provider not found');
      err.status = 404;
      throw err;
    }
    await provider.destroy();
    return true;
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to delete AI provider');
    err.status = 500;
    throw err;
  }
};
const testConnection = async (id) => {
  try {
    const provider = await AiProvider.findByPk(id);
    if (!provider) {
      const err = new Error('AI provider not found');
      err.status = 404;
      throw err;
    }
    const adapter = createProviderAdapter(provider);
    const result = await adapter.test_connection();
    return result;
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to test connection');
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
  setDefaultProvider,
  deleteProvider,
  testConnection,
  sanitizeProvider,
  VALID_PROVIDERS,
};
