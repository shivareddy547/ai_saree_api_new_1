const storeService = require('../services/storeService');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret';
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
/**
 * POST /api/store/track-page-view
 * Body: { path: string, provider?: string }
 * Auth is optional – presence of a valid Bearer token means the viewer is logged in.
 */
const trackPageView = async (req, res, next) => {
  try {
    const { path, provider } = req.body || {};
    if (!path) {
      return res.status(400).json({
        success: false,
        message: 'path is required',
      });
    }
    let isGuest = true;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        jwt.verify(token, JWT_SECRET);
        isGuest = false;
      } catch (e) {
        isGuest = true;
      }
    }
    const data = await storeService.trackPageView({
      path,
      isGuest,
      provider: provider || null,
    });
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
/**
 * GET /api/store/page-views
 * Returns all tracked pages with guest / registered / provider counts.
 * Requires authentication (admin panel).
 */
const getPageViews = async (req, res, next) => {
  try {
    const data = await storeService.getPageViews();
    res.json({
      success: true,
      data,
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
  trackPageView,
  getPageViews,
};
