const aiModelService = require('../services/aiModelService');
const getAll = async (req, res, next) => {
  try {
    const providerId = req.query.provider_id || null;
    const models = await aiModelService.getAllModels(providerId);
    res.status(200).json({
      success: true,
      data: models,
      message: 'AI models fetched successfully',
    });
  } catch (error) {
    next(error);
  }
};
const getById = async (req, res, next) => {
  try {
    const model = await aiModelService.getModelById(req.params.id);
    res.status(200).json({
      success: true,
      data: model,
      message: 'AI model fetched successfully',
    });
  } catch (error) {
    next(error);
  }
};
const create = async (req, res, next) => {
  try {
    const model = await aiModelService.createModel(req.body);
    res.status(201).json({
      success: true,
      data: model,
      message: 'AI model created successfully',
    });
  } catch (error) {
    next(error);
  }
};
const update = async (req, res, next) => {
  try {
    const model = await aiModelService.updateModel(req.params.id, req.body);
    res.status(200).json({
      success: true,
      data: model,
      message: 'AI model updated successfully',
    });
  } catch (error) {
    next(error);
  }
};
const toggle = async (req, res, next) => {
  try {
    const model = await aiModelService.toggleModel(req.params.id);
    res.status(200).json({
      success: true,
      data: model,
      message: `AI model ${model.enabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    next(error);
  }
};
const setDefault = async (req, res, next) => {
  try {
    const model = await aiModelService.setDefaultModel(req.params.id);
    res.status(200).json({
      success: true,
      data: model,
      message: 'Default AI model set successfully',
    });
  } catch (error) {
    next(error);
  }
};
const remove = async (req, res, next) => {
  try {
    await aiModelService.deleteModel(req.params.id);
    res.status(200).json({
      success: true,
      message: 'AI model deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  getAll,
  getById,
  create,
  update,
  toggle,
  setDefault,
  remove,
};
