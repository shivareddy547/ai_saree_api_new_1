const productImportService = require('../services/productImportService');
class ProductImportController {
  async importProducts(req, res, next) {
    try {
      const { importType } = req.body;
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }
      if (!importType) {
        return res.status(400).json({
          success: false,
          message: 'importType is required'
        });
      }
      const validTypes = ['excel', 'excel_images', 'excel_videos', 'excel_images_videos'];
      if (!validTypes.includes(importType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid importType. Allowed: excel, excel_images, excel_videos, excel_images_videos'
        });
      }
      const isZip = importType !== 'excel';
      const fileExt = file.originalname.split('.').pop().toLowerCase();
      if (isZip && fileExt !== 'zip') {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. For this import option, a ZIP file is required.'
        });
      }
      if (!isZip && !['xls', 'xlsx'].includes(fileExt)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. For Excel-only import, an .xls or .xlsx file is required.'
        });
      }
      const result = await productImportService.processImport(file, importType, req.user.id);
      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new ProductImportController();
