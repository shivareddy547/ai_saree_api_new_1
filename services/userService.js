const bcrypt = require('bcryptjs');
const { User } = require('../models');
const updateProfile = async (userId, data) => {
  const { fullName, phone } = data;
  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  if (fullName !== undefined) {
    if (!fullName || !fullName.trim()) {
      const err = new Error('Full name cannot be empty');
      err.status = 400;
      throw err;
    }
    user.fullName = fullName.trim();
  }
  if (phone !== undefined) {
    user.phone = phone.trim() || null;
  }
  await user.save();
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
  };
};
const changePassword = async (userId, data) => {
  const { currentPassword, newPassword } = data;
  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    const err = new Error('Current password is incorrect');
    err.status = 400;
    throw err;
  }
  if (newPassword.length < 6) {
    const err = new Error('New password must be at least 6 characters');
    err.status = 400;
    throw err;
  }
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  await user.save();
  return { message: 'Password updated successfully' };
};
module.exports = {
  updateProfile,
  changePassword,
};
