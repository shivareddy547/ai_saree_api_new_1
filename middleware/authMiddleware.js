const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
/**
 * Required authentication. Returns 401 if token missing/invalid.
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Please login.',
      });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Please login.',
      });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    // Support common JWT payload shapes
    req.userId = decoded.id || decoded.userId || decoded.sub;
    if (req.user && !req.user.id) {
      req.user.id = req.userId;
    }
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please login again.',
    });
  }
};
/**
 * Optional authentication. Attaches user if token is valid.
 * Does NOT return 401 when token is missing or invalid.
 */
const optionalAuthMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        req.userId = decoded.id || decoded.userId || decoded.sub;
        if (req.user && !req.user.id) {
          req.user.id = req.userId;
        }
      }
    }
  } catch (error) {
    req.user = undefined;
    req.userId = undefined;
  }
  next();
};
module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.optionalAuthMiddleware = optionalAuthMiddleware;
