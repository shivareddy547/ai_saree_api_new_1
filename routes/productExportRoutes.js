const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const productExportController = require('../controllers/productExportController');
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
router.get('/products/export', verifyToken, productExportController.exportProducts);
module.exports = router;
