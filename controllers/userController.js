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
module.exports = {
  updateProfile,
  changePassword,
};
