const userService = require('../services/userService');
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fullName, phone } = req.body;
    if (!fullName && phone === undefined) {
      return res.status(400).json({
        success: false,
        message: 'At least one field to update is required',
      });
    }
    const updatedUser = await userService.updateProfile(userId, { fullName, phone });
    return res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully',
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};
const changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }
    await userService.changePassword(userId, { currentPassword, newPassword });
    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};
const getUsersAdmin = async (req, res, next) => {
  try {
    const filters = {
      search: req.query.search || undefined,
      role: req.query.role || undefined,
      isActive: req.query.isActive !== undefined ? req.query.isActive : undefined,
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    };
    const result = await userService.getUsersAdmin(filters);
    return res.status(200).json({
      success: true,
      data: result.users,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};
const getUserAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await userService.getUserAdmin(id);
    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};
const updateUserStatusAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean',
      });
    }
    const user = await userService.updateUserStatusAdmin(id, isActive);
    return res.status(200).json({
      success: true,
      data: user,
      message: isActive ? 'User activated successfully' : 'User deactivated successfully',
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};
const getUserOrdersAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const filters = {
      status: req.query.status || undefined,
      paymentStatus: req.query.paymentStatus || undefined,
      search: req.query.search || undefined,
      startDate: req.query.startDate || undefined,
      endDate: req.query.endDate || undefined,
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    };
    const result = await userService.getUserOrdersAdmin(id, filters);
    return res.status(200).json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};
const updateAddressAdmin = async (req, res, next) => {
  try {
    const { id, addressId } = req.params;
    const data = req.body;
    const address = await userService.updateAddressAdmin(id, addressId, data);
    return res.status(200).json({
      success: true,
      data: address,
      message: 'Address updated successfully',
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};
module.exports = {
  updateProfile,
  changePassword,
  getUsersAdmin,
  getUserAdmin,
  updateUserStatusAdmin,
  getUserOrdersAdmin,
  updateAddressAdmin,
};
