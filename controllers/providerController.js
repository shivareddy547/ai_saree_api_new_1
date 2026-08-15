const providerService = require('../services/providerService');
const getAll = async (req, res, next) => {
  try {
    const providers = await providerService.getAllProviders();
    res.status(200).json({
      success: true,
      data: providers,
      message: 'Providers fetched successfully',
    });
  } catch (error) {
    next(error);
  }
};
const getById = async (req, res, next) => {
  try {
    const provider = await providerService.getProviderById(req.params.id);
    res.status(200).json({
      success: true,
      data: provider,
      message: 'Provider fetched successfully',
    });
  } catch (error) {
    next(error);
  }
};
const create = async (req, res, next) => {
  try {
    const provider = await providerService.createProvider(req.body);
    res.status(201).json({
      success: true,
      data: provider,
      message: 'Provider created successfully',
    });
  } catch (error) {
    next(error);
  }
};
const update = async (req, res, next) => {
  try {
    const provider = await providerService.updateProvider(req.params.id, req.body);
    res.status(200).json({
      success: true,
      data: provider,
      message: 'Provider updated successfully',
    });
  } catch (error) {
    next(error);
  }
};
const toggle = async (req, res, next) => {
  try {
    const provider = await providerService.toggleProvider(req.params.id);
    res.status(200).json({
      success: true,
      data: provider,
      message: `Provider ${provider.is_enabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    next(error);
  }
};
const remove = async (req, res, next) => {
  try {
    await providerService.deleteProvider(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Provider deleted successfully',
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
  remove,
};
