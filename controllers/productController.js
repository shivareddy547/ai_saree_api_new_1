const productService = require('../services/productService');
const createProduct = async (req, res) => {
  try {
    const productData = req.body;
    // Add the logged-in user's ID to the product data
    productData.userId = req.user.id;
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
    // Only get products belonging to the logged-in user
    const products = await productService.getProducts(req.user.id);
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
    // Check if the product belongs to the logged-in user
    if (product.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to access this product',
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
    // First check if the product exists and belongs to the user
    const existingProduct = await productService.getProduct(productId);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }
    if (existingProduct.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update this product',
      });
    }
    const productData = req.body;
    productData.userId = req.user.id;
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
    // First check if the product exists and belongs to the user
    const existingProduct = await productService.getProduct(productId);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }
    if (existingProduct.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this product',
      });
    }
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
