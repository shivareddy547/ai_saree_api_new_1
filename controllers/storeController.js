const storeService = require('../services/storeService');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret';
const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (req.headers['x-real-ip']) {
    return String(req.headers['x-real-ip']).trim();
  }
  if (req.ip) {
    return req.ip.replace(/^::ffff:/, '');
  }
  const remote =
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    null;
  return remote ? String(remote).replace(/^::ffff:/, '') : null;
};
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
 * IP and geolocation are captured server-side from the request.
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
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;
    const data = await storeService.trackPageView({
      path,
      isGuest,
      provider: provider || null,
      ipAddress,
      userAgent,
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
 * Query: path, provider, minViews, startDate, endDate
 * Returns tracked pages with guest / registered / provider counts
 * and last known IP / location per path, filtered by optional query params.
 * Requires authentication (admin panel).
 */
const getPageViews = async (req, res, next) => {
  try {
    const filters = {
      path: req.query.path || undefined,
      provider: req.query.provider || undefined,
      minViews: req.query.minViews || undefined,
      startDate: req.query.startDate || undefined,
      endDate: req.query.endDate || undefined,
    };
    const data = await storeService.getPageViews(filters);
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
