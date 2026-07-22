const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'sareevibe-dev-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const signup = async ({ fullName, email, password }) => {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
        const error = new Error('User with this email already exists');
        error.status = 409;
        throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    const user = await User.create({
        fullName,
        email,
        password: hashedPassword,
        isEmailVerified: false,
        otp,
        otpExpires,
    });

    return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        message: 'Signup successful. Please verify the OTP sent to your email.',
    };
};

const login = async ({ email, password }) => {
    const user = await User.findOne({ where: { email } });
    if (!user) {
        const error = new Error('Invalid email or password');
        error.status = 401;
        throw error;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        const error = new Error('Invalid email or password');
        error.status = 401;
        throw error;
    }

    if (!user.isEmailVerified) {
        const error = new Error('Please verify your email before logging in');
        error.status = 403;
        throw error;
    }

    const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        token,
        message: 'Login successful',
    };
};

const verifyOtp = async ({ email, otp }) => {
    const user = await User.findOne({ where: { email } });
    if (!user) {
        const error = new Error('User not found');
        error.status = 404;
        throw error;
    }

    if (user.isEmailVerified) {
        const error = new Error('Email is already verified');
        error.status = 400;
        throw error;
    }

    if (!user.otp || !user.otpExpires) {
        const error = new Error('No OTP found. Please request a new one.');
        error.status = 400;
        throw error;
    }

    if (user.otp !== otp) {
        const error = new Error('Invalid OTP');
        error.status = 400;
        throw error;
    }

    if (new Date() > new Date(user.otpExpires)) {
        const error = new Error('OTP has expired. Please request a new one.');
        error.status = 400;
        throw error;
    }

    await User.update(
        { isEmailVerified: true, otp: null, otpExpires: null },
        { where: { id: user.id } }
    );

    return {
        message: 'Email verified successfully. You can now login.',
    };
};

const resendOtp = async ({ email }) => {
    const user = await User.findOne({ where: { email } });
    if (!user) {
        const error = new Error('User not found');
        error.status = 404;
        throw error;
    }

    if (user.isEmailVerified) {
        const error = new Error('Email is already verified');
        error.status = 400;
        throw error;
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await User.update(
        { otp, otpExpires },
        { where: { id: user.id } }
    );

    return {
        message: 'New OTP sent to your email.',
    };
};

module.exports = {
    signup,
    login,
    verifyOtp,
    resendOtp,
};
