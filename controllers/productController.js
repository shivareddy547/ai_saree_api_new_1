const productService = require('../services/productService');

const createProduct = async (req, res) => {
  try {
    const productData = req.body;
    const product = await productService.createProduct(productData);
    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create product',
    });
  }
};

const getProducts = async (req, res) => {
  try {
    const products = await productService.getProducts();
    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getProduct = async (req, res) => {
  try {
    const product = await productService.getProduct(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const productData = req.body;
    const product = await productService.updateProduct(productId, productData);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update product',
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const deleted = await productService.deleteProduct(productId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }
    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete product',
    });
  }
};

module.exports = { createProduct, getProducts, getProduct, updateProduct, deleteProduct };
