const { Category, sequelize } = require('../models');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
class CategoryService {
  async getAllCategories() {
    try {
      const categories = await Category.findAll({
        where: { parentId: null },
        order: [['order', 'ASC']],
        include: [
          {
            model: Category,
            as: 'subCategories',
            order: [['order', 'ASC']],
          }
        ]
      });
      return categories;
    } catch (error) {
      console.error('Error in getAllCategories:', error);
      throw new Error('Failed to fetch categories');
    }
  }
  async getCategoryById(id) {
    try {
      const category = await Category.findByPk(id, {
        include: [
          {
            model: Category,
            as: 'subCategories',
            order: [['order', 'ASC']],
          },
          {
            model: Category,
            as: 'parentCategory',
          }
        ]
      });
      if (!category) {
        const err = new Error('Category not found');
        err.status = 404;
        throw err;
      }
      return category;
    } catch (error) {
      if (error.status) throw error;
      console.error('Error in getCategoryById:', error);
      throw new Error('Failed to fetch category');
    }
  }
  async createCategory(data, file) {
    try {
      const { 
        name, subtitle, highlightText, description, bgGradient, 
        badgeText, badgeIcon, order, isActive, parentId,
        showInCategoryGrid, showInHero, permalink,
        primaryButtonText, primaryButtonLink,
        secondaryButtonText, secondaryButtonLink,
        imageUrl
      } = data;
      // Validate required fields
      if (!name) {
        const err = new Error('Category name is required');
        err.status = 400;
        throw err;
      }
      // Check if parent exists if parentId is provided
      if (parentId) {
        const parent = await Category.findByPk(parentId);
        if (!parent) {
          const err = new Error('Parent category not found');
          err.status = 404;
          throw err;
        }
      }
      // Generate permalink if not provided
      let finalPermalink = permalink;
      if (!finalPermalink) {
        finalPermalink = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }
      // Check if permalink is unique
      const existingCategory = await Category.findOne({
        where: { permalink: finalPermalink }
      });
      if (existingCategory) {
        const err = new Error('Permalink already exists');
        err.status = 400;
        throw err;
      }
      // Handle image upload
      let finalImageUrl = imageUrl || null;
      if (file) {
        finalImageUrl = `/uploads/categories/${file.filename}`;
      }
      const category = await Category.create({
        name,
        subtitle: subtitle || null,
        highlightText: highlightText || null,
        description: description || null,
        imageUrl: finalImageUrl,
        bgGradient: bgGradient || 'bg-gradient-to-r from-purple-500 to-indigo-500',
        badgeText: badgeText || null,
        badgeIcon: badgeIcon || null,
        order: parseInt(order) || 0,
        isActive: isActive !== undefined ? isActive : true,
        parentId: parentId || null,
        showInCategoryGrid: showInCategoryGrid !== undefined ? showInCategoryGrid : true,
        showInHero: showInHero || false,
        permalink: finalPermalink,
        primaryButtonText: primaryButtonText || null,
        primaryButtonLink: primaryButtonLink || null,
        secondaryButtonText: secondaryButtonText || null,
        secondaryButtonLink: secondaryButtonLink || null,
      });
      return category;
    } catch (error) {
      if (error.status) throw error;
      console.error('Error in createCategory:', error);
      throw new Error('Failed to create category');
    }
  }
  async updateCategory(id, data, file) {
    try {
      const category = await Category.findByPk(id);
      if (!category) {
        const err = new Error('Category not found');
        err.status = 404;
        throw err;
      }
      const {
        name, subtitle, highlightText, description, bgGradient,
        badgeText, badgeIcon, order, isActive, parentId,
        showInCategoryGrid, showInHero, permalink,
        primaryButtonText, primaryButtonLink,
        secondaryButtonText, secondaryButtonLink,
        imageUrl
      } = data;
      // Validate parent if provided
      if (parentId) {
        if (parentId === id) {
          const err = new Error('Category cannot be its own parent');
          err.status = 400;
          throw err;
        }
        const parent = await Category.findByPk(parentId);
        if (!parent) {
          const err = new Error('Parent category not found');
          err.status = 404;
          throw err;
        }
      }
      // Handle permalink
      let finalPermalink = permalink;
      if (name && !finalPermalink) {
        finalPermalink = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }
      if (finalPermalink) {
        const existingCategory = await Category.findOne({
          where: {
            permalink: finalPermalink,
            id: { [Op.ne]: id }
          }
        });
        if (existingCategory) {
          const err = new Error('Permalink already exists');
          err.status = 400;
          throw err;
        }
      }
      // Handle image upload
      let finalImageUrl = imageUrl;
      if (file) {
        finalImageUrl = `/uploads/categories/${file.filename}`;
      }
      await category.update({
        name: name || category.name,
        subtitle: subtitle !== undefined ? subtitle : category.subtitle,
        highlightText: highlightText !== undefined ? highlightText : category.highlightText,
        description: description !== undefined ? description : category.description,
        imageUrl: finalImageUrl || category.imageUrl,
        bgGradient: bgGradient || category.bgGradient,
        badgeText: badgeText !== undefined ? badgeText : category.badgeText,
        badgeIcon: badgeIcon !== undefined ? badgeIcon : category.badgeIcon,
        order: order !== undefined ? parseInt(order) : category.order,
        isActive: isActive !== undefined ? isActive : category.isActive,
        parentId: parentId !== undefined ? parentId : category.parentId,
        showInCategoryGrid: showInCategoryGrid !== undefined ? showInCategoryGrid : category.showInCategoryGrid,
        showInHero: showInHero !== undefined ? showInHero : category.showInHero,
        permalink: finalPermalink || category.permalink,
        primaryButtonText: primaryButtonText !== undefined ? primaryButtonText : category.primaryButtonText,
        primaryButtonLink: primaryButtonLink !== undefined ? primaryButtonLink : category.primaryButtonLink,
        secondaryButtonText: secondaryButtonText !== undefined ? secondaryButtonText : category.secondaryButtonText,
        secondaryButtonLink: secondaryButtonLink !== undefined ? secondaryButtonLink : category.secondaryButtonLink,
      });
      const updatedCategory = await Category.findByPk(id, {
        include: [
          {
            model: Category,
            as: 'subCategories',
            order: [['order', 'ASC']],
          },
          {
            model: Category,
            as: 'parentCategory',
          }
        ]
      });
      return updatedCategory;
    } catch (error) {
      if (error.status) throw error;
      console.error('Error in updateCategory:', error);
      throw new Error('Failed to update category');
    }
  }
  async deleteCategory(id) {
    try {
      const category = await Category.findByPk(id);
      if (!category) {
        const err = new Error('Category not found');
        err.status = 404;
        throw err;
      }
      // Check if category has subcategories
      const subCategories = await Category.findAll({
        where: { parentId: id }
      });
      if (subCategories.length > 0) {
        const err = new Error('Cannot delete category with subcategories');
        err.status = 400;
        throw err;
      }
      await category.destroy();
      return { message: 'Category deleted successfully' };
    } catch (error) {
      if (error.status) throw error;
      console.error('Error in deleteCategory:', error);
      throw new Error('Failed to delete category');
    }
  }
}
module.exports = new CategoryService();
