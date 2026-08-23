const express = require('express');
const router = express.Router();
const productExportController = require('../controllers/productExportController');
router.get('/products/export', productExportController.exportProducts);
module.exports = router;
