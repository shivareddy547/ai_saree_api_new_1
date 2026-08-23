const productExportService = require('../services/productExportService');
class ProductExportController {
  async exportProducts(req, res, next) {
    try {
      const { search, status, categoryId, includeImages, includeVideos, includeExcel } = req.query;
      const filters = {};
      if (search) filters.search = search;
      if (status) filters.status = status;
      if (categoryId) filters.categoryId = categoryId;
      // Parse boolean flags from query (default true if not present)
      const options = {
        includeImages: includeImages !== 'false',
        includeVideos: includeVideos !== 'false',
        includeExcel: includeExcel !== 'false'
      };
      const zipBuffer = await productExportService.generateExportZip(filters, options);
      const filename = `products_export_${new Date().toISOString().slice(0,10)}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', zipBuffer.length);
      res.send(zipBuffer);
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new ProductExportController();
