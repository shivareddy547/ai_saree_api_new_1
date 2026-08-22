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
