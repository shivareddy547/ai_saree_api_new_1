const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const wishlistController = require('../controllers/wishlistController');
const authMiddleware = require('../middleware/authMiddleware');
// Public store endpoints – all filter isActive = true internally
router.get('/products', storeController.getProducts);
router.get('/products/:id', storeController.getProductById);
router.get('/autocomplete', storeController.autocomplete);
router.get('/home-sections', storeController.getHomeSections);
// Wishlist endpoints (authenticated)
router.get('/wishlist', authMiddleware, wishlistController.getWishlist);
router.get('/wishlist/count', authMiddleware, wishlistController.getWishlistCount);
router.post('/wishlist/toggle', authMiddleware, wishlistController.toggleWishlist);
router.get('/wishlist/status/:productId', authMiddleware, wishlistController.getWishlistStatus);
module.exports = router;
