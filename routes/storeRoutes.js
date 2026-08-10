const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const authMiddleware = require('../middleware/authMiddleware');
// Public routes (no auth)
router.get('/products', storeController.getProducts);
router.get('/products/:id', storeController.getProductById);
router.get('/autocomplete', storeController.autocomplete);
// Wishlist routes (require auth)
router.post('/wishlist/toggle', authMiddleware, storeController.toggleWishlist);
router.get('/wishlist', authMiddleware, storeController.getWishlist);
router.get('/wishlist/count', authMiddleware, storeController.getWishlistCount);
router.get('/wishlist/status/:productId', authMiddleware, storeController.getWishlistStatus);
module.exports = router;
