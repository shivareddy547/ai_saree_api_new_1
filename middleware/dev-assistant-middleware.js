/**
 * Dev Assistant Middleware for Node.js
 * Placeholder middleware for Dev Assistant
 */

module.exports = (req, res, next) => {
    console.log('[Dev Assistant] Request:', req.method, req.path);
    next();
};
