const { AiModel, AiProvider } = require('../models');
const { Op } = require('sequelize');
const VALID_MODEL_TYPES = ['chat', 'embedding', 'image', 'audio', 'moderation'];
const getAllModels = async (providerId = null) => {
  try {
    const where = {};
    if (providerId) where.ai_provider_id = providerId;
    const models = await AiModel.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: AiProvider,
          as: 'provider',
          attributes: ['id', 'name', 'provider', 'enabled'],
        },
      ],
    });
    return models;
  } catch (error) {
    const err = new Error('Failed to fetch AI models');
    err.status = 500;
    throw err;
  }
};
const getModelById = async (id) => {
  try {
    const model = await AiModel.findByPk(id, {
      include: [
        {
          model: AiProvider,
          as: 'provider',
          attributes: ['id', 'name', 'provider', 'enabled'],
        },
      ],
    });
    if (!model) {
      const err = new Error('AI model not found');
      err.status = 404;
      throw err;
    }
    return model;
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to fetch AI model');
    err.status = 500;
    throw err;
  }
};
const createModel = async (data) => {
  try {
    if (!data.name || !String(data.name).trim()) {
      const err = new Error('Name is required');
      err.status = 400;
      throw err;
    }
    if (!data.model_identifier || !String(data.model_identifier).trim()) {
      const err = new Error('Model identifier is required');
      err.status = 400;
      throw err;
    }
    if (!data.ai_provider_id) {
      const err = new Error('Provider is required');
      err.status = 400;
      throw err;
    }
    if (!data.model_type || !VALID_MODEL_TYPES.includes(String(data.model_type).toLowerCase())) {
      const err = new Error(
        `model_type must be one of: ${VALID_MODEL_TYPES.join(', ')}`
      );
      err.status = 400;
      throw err;
    }
    const provider = await AiProvider.findByPk(data.ai_provider_id);
    if (!provider) {
      const err = new Error('AI provider not found');
      err.status = 404;
      throw err;
    }
    const isDefault = data.is_default === true;
    if (isDefault) {
      await AiModel.update(
        { is_default: false },
        { where: { ai_provider_id: data.ai_provider_id, is_default: true } }
      );
    }
    const model = await AiModel.create({
      ai_provider_id: data.ai_provider_id,
      name: String(data.name).trim(),
      model_identifier: String(data.model_identifier).trim(),
      model_type: String(data.model_type).toLowerCase(),
      context_window: data.context_window != null ? Number(data.context_window) : null,
      max_output_tokens: data.max_output_tokens != null ? Number(data.max_output_tokens) : null,
      supports_streaming: data.supports_streaming === true,
      supports_function_calling: data.supports_function_calling === true,
      supports_json_mode: data.supports_json_mode === true,
      supports_vision: data.supports_vision === true,
      enabled: data.enabled !== false,
      is_default: isDefault,
      metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},
    });
    return await getModelById(model.id);
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to create AI model');
    err.status = 500;
    throw err;
  }
};
const updateModel = async (id, data) => {
  try {
    const model = await AiModel.findByPk(id);
    if (!model) {
      const err = new Error('AI model not found');
      err.status = 404;
      throw err;
    }
    if (data.name !== undefined) {
      if (!data.name || !String(data.name).trim()) {
        const err = new Error('Name cannot be empty');
        err.status = 400;
        throw err;
      }
      model.name = String(data.name).trim();
    }
    if (data.model_identifier !== undefined) {
      if (!data.model_identifier || !String(data.model_identifier).trim()) {
        const err = new Error('Model identifier cannot be empty');
        err.status = 400;
        throw err;
      }
      model.model_identifier = String(data.model_identifier).trim();
    }
    if (data.model_type !== undefined) {
      if (!VALID_MODEL_TYPES.includes(String(data.model_type).toLowerCase())) {
        const err = new Error(
          `model_type must be one of: ${VALID_MODEL_TYPES.join(', ')}`
        );
        err.status = 400;
        throw err;
      }
      model.model_type = String(data.model_type).toLowerCase();
    }
    if (data.ai_provider_id !== undefined) {
      const provider = await AiProvider.findByPk(data.ai_provider_id);
      if (!provider) {
        const err = new Error('AI provider not found');
        err.status = 404;
        throw err;
      }
      model.ai_provider_id = data.ai_provider_id;
    }
    if (data.context_window !== undefined) {
      model.context_window = data.context_window != null ? Number(data.context_window) : null;
    }
    if (data.max_output_tokens !== undefined) {
      model.max_output_tokens = data.max_output_tokens != null ? Number(data.max_output_tokens) : null;
    }
    if (data.supports_streaming !== undefined) model.supports_streaming = data.supports_streaming === true;
    if (data.supports_function_calling !== undefined) {
      model.supports_function_calling = data.supports_function_calling === true;
    }
    if (data.supports_json_mode !== undefined) model.supports_json_mode = data.supports_json_mode === true;
    if (data.supports_vision !== undefined) model.supports_vision = data.supports_vision === true;
    if (data.enabled !== undefined) model.enabled = data.enabled === true;
    if (data.metadata !== undefined && typeof data.metadata === 'object') {
      model.metadata = data.metadata;
    }
    if (data.is_default === true) {
      await AiModel.update(
        { is_default: false },
        {
          where: {
            ai_provider_id: model.ai_provider_id,
            is_default: true,
            id: { [Op.ne]: id },
          },
        }
      );
      model.is_default = true;
    } else if (data.is_default === false) {
      model.is_default = false;
    }
    await model.save();
    return await getModelById(model.id);
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to update AI model');
    err.status = 500;
    throw err;
  }
};
const toggleModel = async (id) => {
  try {
    const model = await AiModel.findByPk(id);
    if (!model) {
      const err = new Error('AI model not found');
      err.status = 404;
      throw err;
    }
    model.enabled = !model.enabled;
    await model.save();
    return await getModelById(model.id);
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to toggle AI model');
    err.status = 500;
    throw err;
  }
};
const setDefaultModel = async (id) => {
  try {
    const model = await AiModel.findByPk(id);
    if (!model) {
      const err = new Error('AI model not found');
      err.status = 404;
      throw err;
    }
    await AiModel.update(
      { is_default: false },
      { where: { ai_provider_id: model.ai_provider_id, is_default: true } }
    );
    model.is_default = true;
    await model.save();
    return await getModelById(model.id);
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to set default AI model');
    err.status = 500;
    throw err;
  }
};
const deleteModel = async (id) => {
  try {
    const model = await AiModel.findByPk(id);
    if (!model) {
      const err = new Error('AI model not found');
      err.status = 404;
      throw err;
    }
    await model.destroy();
    return true;
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to delete AI model');
    err.status = 500;
    throw err;
  }
};
module.exports = {
  getAllModels,
  getModelById,
  createModel,
  updateModel,
  toggleModel,
  setDefaultModel,
  deleteModel,
  VALID_MODEL_TYPES,
};
