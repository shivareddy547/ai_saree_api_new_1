const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
// Public routes (no auth required) - for store frontend browsing
// Export must be registered before parameterized routes
router.get('/products/export', productController.exportProducts);
router.get('/products', productController.getAllProducts);
router.get('/products/:id', productController.getProductById);
// Authenticated routes - create and update require logged in user
router.post('/products', authMiddleware, productController.createProduct);
router.put('/products/:id', authMiddleware, productController.updateProduct);
router.delete('/products/:id', authMiddleware, productController.deleteProduct);
module.exports = router;
