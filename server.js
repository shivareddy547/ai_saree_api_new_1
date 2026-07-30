require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// ==========================================
// CORS
// ==========================================

// Allow requests from any origin
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

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
    res.setHeader(
      'Cache-Control',
      'no-cache, no-store, must-revalidate'
    );

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

  res.setHeader(
    'Cache-Control',
    'no-cache, no-store, must-revalidate'
  );

  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/json');

  if (fs.existsSync(jsonPath)) {
    res.sendFile(jsonPath);
  } else {
    res.status(404).json({
      error: 'Swagger specification not found',
      message:
        'Run npm run swagger:generate to generate documentation'
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
  console.error('Error:', err.stack);

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
  console.log('🌍 CORS: Allowing requests from any origin');
  console.log('='.repeat(60));
});

module.exports = app;