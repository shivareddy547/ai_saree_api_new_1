const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { Op } = require('sequelize');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
/**
 * Generate OTP (6 digits)
 * @returns {string} 6-digit OTP
 */
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
/**
 * Generate JWT token
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};
/**
 * Sign up a new user
 * @param {Object} data - { fullName, email, password, role?, phone? }
 * @returns {Object} { user, otp }
 */
exports.signup = async (data) => {
  const { fullName, email, password, role = 'user', phone } = data;
  // Check if user already exists
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    const err = new Error('User with this email already exists');
    err.status = 400;
    throw err;
  }
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  // Generate OTP
  const otp = generateOtp();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  // Create user
  const user = await User.create({
    fullName,
    email,
    password: hashedPassword,
    otp,
    otpExpires,
    isEmailVerified: false,
    role: role,
    phone: phone || null,
  });
  // In production, send OTP via email
  console.log(`OTP for ${email}: ${otp}`);
  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      role: user.role,
    },
    otp
  };
};
/**
 * Login user
 * @param {Object} data - { email, password }
 * @returns {Object} { user, token }
 */
exports.login = async (data) => {
  const { email, password } = data;
  // Find user
  const user = await User.findOne({ where: { email } });
  if (!user) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }
  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }
  // Check if email is verified
  if (!user.isEmailVerified) {
    // Generate new OTP
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.update({ otp, otpExpires });
    console.log(`New OTP for ${email}: ${otp}`);
    const err = new Error('Email not verified. A new OTP has been sent to your email.');
    err.status = 403;
    throw err;
  }
  // Generate token
  const token = generateToken(user);
  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      role: user.role,
    },
    token
  };
};
/**
 * Verify OTP
 * @param {Object} data - { email, otp }
 * @returns {Object} { user, token }
 */
exports.verifyOtp = async (data) => {
  const { email, otp } = data;
  // Find user
  const user = await User.findOne({ where: { email } });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  // Check if already verified
  if (user.isEmailVerified) {
    const err = new Error('Email already verified');
    err.status = 400;
    throw err;
  }
  // Check OTP
  if (user.otp !== otp) {
    const err = new Error('Invalid OTP');
    err.status = 400;
    throw err;
  }
  // Check if OTP expired
  if (new Date(user.otpExpires) < new Date()) {
    const err = new Error('OTP expired. Please request a new one.');
    err.status = 400;
    throw err;
  }
  // Verify user
  await user.update({
    isEmailVerified: true,
    otp: null,
    otpExpires: null
  });
  // Generate token
  const token = generateToken(user);
  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      role: user.role,
    },
    token
  };
};
/**
 * Resend OTP
 * @param {Object} data - { email }
 * @returns {Object} { message }
 */
exports.resendOtp = async (data) => {
  const { email } = data;
  // Find user
  const user = await User.findOne({ where: { email } });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  // Check if already verified
  if (user.isEmailVerified) {
    const err = new Error('Email already verified');
    err.status = 400;
    throw err;
  }
  // Generate new OTP
  const otp = generateOtp();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.update({ otp, otpExpires });
  console.log(`New OTP for ${email}: ${otp}`);
  return { message: 'OTP sent successfully' };
};
/**
 * Forgot password - request reset
 * @param {Object} data - { email }
 * @returns {Object} { message }
 */
exports.forgotPassword = async (data) => {
  const { email } = data;
  // Find user
  const user = await User.findOne({ where: { email } });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  // Generate reset token (using JWT)
  const resetToken = jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  // In production, send reset link via email
  console.log(`Password reset token for ${email}: ${resetToken}`);
  return { message: 'Password reset link sent to your email' };
};
/**
 * Reset password with token
 * @param {Object} data - { token, newPassword }
 * @returns {Object} { message }
 */
exports.resetPassword = async (data) => {
  const { token, newPassword } = data;
  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    // Find user
    const user = await User.findByPk(decoded.id);
    if (!user) {
      const err = new Error('Invalid or expired token');
      err.status = 400;
      throw err;
    }
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });
    return { message: 'Password reset successfully' };
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      const err = new Error('Invalid or expired token');
      err.status = 400;
      throw err;
    }
    throw error;
  }
};
