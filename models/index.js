const { Sequelize } = require('sequelize');
const config = require('../config/config');
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

let sequelize;
if (dbConfig.use_env_variable) {
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable], dbConfig);
} else {
  sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);
}

const Product = require('./Product')(sequelize);
const ProductVariant = require('./ProductVariant')(sequelize);
const ProductImage = require('./ProductImage')(sequelize);
const Category = require('./Category')(sequelize);
const Subcategory = require('./Subcategory')(sequelize);

// Associations
Product.hasMany(ProductVariant, { foreignKey: 'productId', as: 'variants' });
ProductVariant.belongsTo(Product, { foreignKey: 'productId' });
Product.hasMany(ProductImage, { foreignKey: 'productId', as: 'images' });
ProductImage.belongsTo(Product, { foreignKey: 'productId' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
Product.belongsTo(Subcategory, { foreignKey: 'subcategoryId', as: 'subcategory' });
Subcategory.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Category.hasMany(Subcategory, { foreignKey: 'categoryId', as: 'subcategories' });

const db = {
  sequelize,
  Sequelize,
  Product,
  ProductVariant,
  ProductImage,
  Category,
  Subcategory,
};

module.exports = db;
