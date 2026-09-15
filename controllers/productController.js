const productService = require('../services/productService');
class ProductController {
  async getAllProducts(req, res, next) {
    try {
      const { search, status, categoryId } = req.query;
      const filters = {};
      if (search) filters.search = search;
      if (status) filters.status = status;
      if (categoryId) filters.categoryId = categoryId;
      const products = await productService.getAllProducts(filters);
      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }
  async getProductById(req, res, next) {
    try {
      const { id } = req.params;
      const product = await productService.getProductById(id);
      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
  async createProduct(req, res, next) {
    try {
      const productData = req.body;
      // Add the logged-in user's ID to the product data
      if (req.user && req.user.id) {
        productData.userId = req.user.id;
      }
      const product = await productService.createProduct(productData);
      res.status(201).json({
        success: true,
        data: product,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  }
  async updateProduct(req, res, next) {
    try {
      const { id } = req.params;
      const productData = req.body;
      if (req.user && req.user.id) {
        productData.userId = req.user.id;
      }
      const product = await productService.updateProduct(id, productData);
      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  }
  async deleteProduct(req, res, next) {
    try {
      const { id } = req.params;
      const result = await productService.deleteProduct(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
  async exportProducts(req, res, next) {
    try {
      const { search, status, categoryId } = req.query;
      const filters = {};
      if (search) filters.search = search;
      if (status) filters.status = status;
      if (categoryId) filters.categoryId = categoryId;
      const buffer = await productService.exportProductsToExcel(filters);
      const filename = `products_export_${Date.now()}.xls`;
      res.setHeader(
        'Content-Type',
        'application/vnd.ms-excel'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new ProductController();
