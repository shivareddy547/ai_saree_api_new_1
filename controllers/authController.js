const authService = require('../services/authService');
const signup = async (req, res, next) => {
    try {
        const { fullName, email, password, role } = req.body;
        if (!fullName || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'fullName, email and password are required',
            });
        }
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'Password must be at least 6 characters long',
            });
        }
        // Role validation: if provided, must be 'admin' or 'user'
        let finalRole = 'user';
        if (role) {
            if (role === 'admin' || role === 'user') {
                finalRole = role;
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Bad Request',
                    message: 'Role must be either "admin" or "user"',
                });
            }
        }
        const result = await authService.signup({ fullName, email, password, role: finalRole });
        return res.status(201).json({
            success: true,
            data: result,
        });
    } catch (err) {
        if (err.status) {
            return res.status(err.status).json({
                success: false,
                error: err.message,
            });
        }
        next(err);
    }
};
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'Email and password are required',
            });
        }
        const result = await authService.login({ email, password });
        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (err) {
        if (err.status) {
            return res.status(err.status).json({
                success: false,
                error: err.message,
            });
        }
        next(err);
    }
};
const verifyOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'Email and OTP are required',
            });
        }
        const result = await authService.verifyOtp({ email, otp });
        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (err) {
        if (err.status) {
            return res.status(err.status).json({
                success: false,
                error: err.message,
            });
        }
        next(err);
    }
};
const resendOtp = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'Email is required',
            });
        }
        const result = await authService.resendOtp({ email });
        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (err) {
        if (err.status) {
            return res.status(err.status).json({
                success: false,
                error: err.message,
            });
        }
        next(err);
    }
};
module.exports = {
    signup,
    login,
    verifyOtp,
    resendOtp,
};
