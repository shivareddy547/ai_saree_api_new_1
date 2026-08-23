const path = require('path');
const fs = require('fs');
const productImportService = require('../services/productImportService');

class ProductImportController {
  async importProducts(req, res, next) {
    let tempPath = null;
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded. Please upload an Excel or ZIP file.',
        });
      }

      tempPath = req.file.path;
      const originalName = req.file.originalname || '';
      const importType = (req.body && req.body.importType) || 'excel';

      // Same pattern as userController: req.user.id
      const userId = req.user && req.user.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. Please log in again.',
        });
      }

      const allowedTypes = [
        'excel',
        'excel_images',
        'excel_videos',
        'excel_images_videos',
      ];
      if (!allowedTypes.includes(importType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid importType. Allowed: ${allowedTypes.join(', ')}`,
        });
      }

      const result = await productImportService.importFromFile({
        filePath: tempPath,
        originalName,
        importType,
        userId,
      });

      return res.status(200).json({
        success: true,
        message: 'Products imported successfully.',
        ...result,
      });
    } catch (error) {
      console.error('Import products error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to import products',
      });
    } finally {
      if (tempPath && fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (e) {
          console.warn('Failed to remove temp upload:', e.message);
        }
      }
    }
  }
}

module.exports = new ProductImportController();
