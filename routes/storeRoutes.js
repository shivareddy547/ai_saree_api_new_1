const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
// Public routes (no auth)
router.get('/products', storeController.getProducts);
module.exports = router;
