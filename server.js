require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// ==========================================
// CORS CONFIGURATION - FIXED
// ==========================================

const allowedOrigins = [
  'https://6113-27-6-114-179.ngrok-free.app',
  'https://88f7-27-6-114-179.ngrok-free.app',
  'https://a50d-27-6-114-179.ngrok-free.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.log('❌ Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false
};

// Apply CORS middleware - THIS HANDLES BOTH PREFLIGHT AND ACTUAL REQUESTS
app.use(cors(corsOptions));

// ==========================================
// BODY PARSER
// ==========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// STATIC FILES
// ==========================================

app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// REQUEST LOGGER (for debugging)
// ==========================================

app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.url}`);
  console.log('  Origin:', req.headers.origin);
  console.log('  Auth:', req.headers.authorization ? 'Present' : 'Missing');
  next();
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: Date.now(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ==========================================
// API ROUTES
// ==========================================

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/help-us', require('./routes/helpUsRoutes'));
app.use('/api', require('./routes/productRoutes'));
app.use('/api/instagram', require('./routes/instagramRoutes'));

// ==========================================
// SWAGGER UI
// ==========================================

app.get('/api-docs', (req, res) => {
  const indexPath = path.join(
    __dirname,
    'public',
    'api-docs',
    'index.html'
  );

  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <h1>Swagger Documentation Not Found</h1>
      <p>
        Please run:
        <code>npm run swagger:generate</code>
        to generate documentation.
      </p>
    `);
  }
});

// ==========================================
// SWAGGER JSON
// ==========================================

app.get('/api-docs/swagger.json', (req, res) => {
  const jsonPath = path.join(
    __dirname,
    'public',
    'api-docs',
    'swagger.json'
  );

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/json');

  if (fs.existsSync(jsonPath)) {
    res.sendFile(jsonPath);
  } else {
    res.status(404).json({
      error: 'Swagger specification not found',
      message: 'Run npm run swagger:generate to generate documentation'
    });
  }
});

// ==========================================
// 404 HANDLER FOR API ROUTES
// ==========================================

app.use(/^\/api/, (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`
  });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    message: err.message,
    timestamp: Date.now(),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack
    })
  });
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`💡 Health: http://localhost:${PORT}/health`);
  console.log('🌍 CORS: Configured with allowed origins');
  console.log('='.repeat(60));
});

module.exports = app;