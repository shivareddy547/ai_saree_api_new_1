const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
// Export must be registered before /:id routes
router.get('/products/export', productController.exportProducts);
router.get('/products', productController.getAllProducts);
router.get('/products/:id', productController.getProductById);
router.delete('/products/:id', productController.deleteProduct);
module.exports = router;
