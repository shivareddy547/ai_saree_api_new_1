#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('🗑️  Clearing Swagger cache...');

// Remove swagger.json
const swaggerJsonPath = path.join(__dirname, 'swagger.json');
if (fs.existsSync(swaggerJsonPath)) {
  fs.unlinkSync(swaggerJsonPath);
  console.log('✅ Removed swagger.json');
}

// Remove any other cache files
const cachePaths = [
  path.join(__dirname, 'node_modules', '.cache'),
  path.join(__dirname, '.swagger-cache')
];

cachePaths.forEach(cachePath => {
  if (fs.existsSync(cachePath)) {
    fs.rmSync(cachePath, { recursive: true, force: true });
    console.log(`✅ Removed ${cachePath}`);
  }
});

console.log('\n🔄 Restart your server to see changes:');
console.log('   Ctrl+C to stop, then run: npm start');
console.log('\n💡 Or hard refresh browser: Ctrl+Shift+R');