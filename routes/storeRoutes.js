const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
// Public store endpoints – all filter isActive = true internally
router.get('/products', storeController.getProducts);
router.get('/products/:id', storeController.getProductById);
router.get('/autocomplete', storeController.autocomplete);
router.get('/home-sections', storeController.getHomeSections);
module.exports = router;
