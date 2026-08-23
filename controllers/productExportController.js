const productExportService = require('../services/productExportService');
class ProductExportController {
  async exportProducts(req, res, next) {
    try {
      const { search, status, categoryId } = req.query;
      const buffer = await productExportService.exportProducts({
        search,
        status,
        categoryId,
      });
      const filename = `products_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(Buffer.from(buffer));
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new ProductExportController();
