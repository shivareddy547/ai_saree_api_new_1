const storeService = require('../services/storeService');
class StoreController {
  async getProducts(req, res, next) {
    try {
      const { featured, newArrivals, search } = req.query;
      const filters = {};
      if (featured === 'true') filters.featured = true;
      if (newArrivals === 'true') filters.newArrivals = true;
      if (search) filters.search = search;
      const products = await storeService.getProducts(filters);
      res.status(200).json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  }
  async getProductById(req, res, next) {
    try {
      const { id } = req.params;
      const product = await storeService.getProductById(id);
      if (!product) {
        const err = new Error('Product not found');
        err.status = 404;
        throw err;
      }
      res.status(200).json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }
  async autocomplete(req, res, next) {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(200).json({ success: true, data: [] });
      }
      const results = await storeService.autocomplete(q, 10);
      res.status(200).json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new StoreController();
