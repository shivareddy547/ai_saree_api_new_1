const productImportService = require('../services/productImportService');
class ProductImportController {
  async importProducts(req, res, next) {
    try {
      if (!req.file) {
        const err = new Error('No file uploaded');
        err.status = 400;
        throw err;
      }
      const importType = (req.body && req.body.importType) || 'excel';
      const allowed = ['excel', 'excel_images', 'excel_videos', 'excel_images_videos'];
      if (!allowed.includes(importType)) {
        const err = new Error('Invalid importType. Allowed: ' + allowed.join(', '));
        err.status = 400;
        throw err;
      }
      const userId =
        req.user && (req.user.id || req.user.userId)
          ? req.user.id || req.user.userId
          : null;
      const result = await productImportService.importProducts(
        req.file,
        importType,
        userId
      );
      res.status(200).json({
        success: true,
        message: 'Products imported successfully',
        importedProducts: result.importedProducts,
        updatedProducts: result.updatedProducts,
        importedVariants: result.importedVariants,
        updatedVariants: result.updatedVariants,
        importedImages: result.importedImages,
        importedVideos: result.importedVideos,
        warnings: result.warnings || [],
      });
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new ProductImportController();
