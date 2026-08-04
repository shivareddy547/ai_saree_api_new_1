const categoryService = require('../services/categoryService');
class CategoryController {
  async getAllCategories(req, res, next) {
    try {
      const categories = await categoryService.getAllCategories();
      res.status(200).json(categories);
    } catch (error) {
      next(error);
    }
  }
  async getCategoryById(req, res, next) {
    try {
      const { id } = req.params;
      const category = await categoryService.getCategoryById(id);
      res.status(200).json(category);
    } catch (error) {
      next(error);
    }
  }
  async createCategory(req, res, next) {
    try {
      const categoryData = req.body;
      const file = req.file;
      const category = await categoryService.createCategory(categoryData, file);
      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  }
  async updateCategory(req, res, next) {
    try {
      const { id } = req.params;
      const categoryData = req.body;
      const file = req.file;
      const category = await categoryService.updateCategory(id, categoryData, file);
      res.status(200).json(category);
    } catch (error) {
      next(error);
    }
  }
  async deleteCategory(req, res, next) {
    try {
      const { id } = req.params;
      const result = await categoryService.deleteCategory(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new CategoryController();
