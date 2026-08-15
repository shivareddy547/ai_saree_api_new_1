const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
// CRITICAL FIX:
// This router is mounted at app.use('/api', productRoutes).
// NEVER use router.use(authMiddleware) here — that would run auth on
// EVERY request under /api/* (categories, store, cart, etc.) and return 401.
// Apply auth only to the specific admin product routes below.
router.post('/products', authMiddleware, productController.createProduct);
router.get('/products', authMiddleware, productController.getProducts);
router.get('/products/:id', authMiddleware, productController.getProduct);
router.put('/products/:id', authMiddleware, productController.updateProduct);
router.delete('/products/:id', authMiddleware, productController.deleteProduct);
module.exports = router;
