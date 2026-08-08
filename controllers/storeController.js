const storeService = require('../services/storeService');

class StoreController {
  async getProducts(req, res, next) {
    try {
      const { featured, newArrivals } = req.query;
      const filters = {};
      if (featured === 'true') filters.featured = true;
      if (newArrivals === 'true') filters.newArrivals = true;
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
}

module.exports = new StoreController();
