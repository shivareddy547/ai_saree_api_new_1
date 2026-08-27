const aiProviderService = require('../services/aiProviderService');
const getAll = async (req, res, next) => {
  try {
    const providers = await aiProviderService.getAllProviders();
    res.status(200).json({
      success: true,
      data: providers,
      message: 'AI providers fetched successfully',
    });
  } catch (error) {
    next(error);
  }
};
const getById = async (req, res, next) => {
  try {
    const provider = await aiProviderService.getProviderById(req.params.id);
    res.status(200).json({
      success: true,
      data: provider,
      message: 'AI provider fetched successfully',
    });
  } catch (error) {
    next(error);
  }
};
const create = async (req, res, next) => {
  try {
    const provider = await aiProviderService.createProvider(req.body);
    res.status(201).json({
      success: true,
      data: provider,
      message: 'AI provider created successfully',
    });
  } catch (error) {
    next(error);
  }
};
const update = async (req, res, next) => {
  try {
    const provider = await aiProviderService.updateProvider(req.params.id, req.body);
    res.status(200).json({
      success: true,
      data: provider,
      message: 'AI provider updated successfully',
    });
  } catch (error) {
    next(error);
  }
};
const toggle = async (req, res, next) => {
  try {
    const provider = await aiProviderService.toggleProvider(req.params.id);
    res.status(200).json({
      success: true,
      data: provider,
      message: `AI provider ${provider.enabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    next(error);
  }
};
const setDefault = async (req, res, next) => {
  try {
    const provider = await aiProviderService.setDefaultProvider(req.params.id);
    res.status(200).json({
      success: true,
      data: provider,
      message: 'Default AI provider set successfully',
    });
  } catch (error) {
    next(error);
  }
};
const testConnection = async (req, res, next) => {
  try {
    const result = await aiProviderService.testConnection(req.params.id);
    res.status(200).json({
      success: true,
      data: result,
      message: result.message || 'Connection test completed',
    });
  } catch (error) {
    next(error);
  }
};
const remove = async (req, res, next) => {
  try {
    await aiProviderService.deleteProvider(req.params.id);
    res.status(200).json({
      success: true,
      message: 'AI provider deleted successfully',
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
  testConnection,
  remove,
};
