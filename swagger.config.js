const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

let swaggerSpec;
try {
  const swaggerPath = path.join(__dirname, 'swagger', 'swagger.yaml');
  const swaggerContent = fs.readFileSync(swaggerPath, 'utf8');
  swaggerSpec = yaml.load(swaggerContent);
  console.log('✅ Loaded Swagger specification');
} catch (error) {
  console.error('❌ Failed to load Swagger specification:', error.message);
  process.exit(1);
}

const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true
    },
    customCss: '.swagger-ui .topbar { display: none }'
  }));

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('📚 Swagger UI available at /api-docs');
};

module.exports = setupSwagger;
