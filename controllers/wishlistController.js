const wishlistService = require('../services/wishlistService');
const getWishlist = async (req, res, next) => {
  try {
    const products = await wishlistService.getWishlistProducts(req.user.id);
    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};
const getWishlistCount = async (req, res, next) => {
  try {
    const count = await wishlistService.getWishlistCount(req.user.id);
    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};
const toggleWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const result = await wishlistService.toggleWishlist(req.user.id, productId);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
const getWishlistStatus = async (req, res, next) => {
  try {
    const result = await wishlistService.getWishlistStatus(
      req.user.id,
      req.params.productId
    );
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  getWishlist,
  getWishlistCount,
  toggleWishlist,
  getWishlistStatus,
};
