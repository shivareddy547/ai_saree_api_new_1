const storeService = require('../services/storeService');
const getProducts = async (req, res, next) => {
  try {
    const result = await storeService.getStoreProducts(req.query);
    res.json({
      success: true,
      data: result.products,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};
const getProductById = async (req, res, next) => {
  try {
    const product = await storeService.getStoreProductById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or is no longer available',
      });
    }
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};
const autocomplete = async (req, res, next) => {
  try {
    const q = req.query.q || '';
    const suggestions = await storeService.getAutocompleteSuggestions(q);
    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    next(error);
  }
};
const getHomeSections = async (req, res, next) => {
  try {
    const sections = await storeService.getHomeSections();
    res.json({
      success: true,
      data: sections,
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  getProducts,
  getProductById,
  autocomplete,
  getHomeSections,
};
