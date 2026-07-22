const { Sequelize } = require('sequelize');
const config = require('./config');
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.use_env_variable ? process.env[dbConfig.use_env_variable] : dbConfig, {
  dialect: dbConfig.dialect,
  logging: dbConfig.logging,
  define: dbConfig.define,
});

module.exports = sequelize;
