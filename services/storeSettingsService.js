const { Store } = require('../models');
const path = require('path');
const fs = require('fs');
const getStoreSettings = async () => {
  try {
    let store = await Store.findOne({ order: [['createdAt', 'ASC']] });
    if (!store) {
      store = await Store.create({
        name: 'AI Saree',
        caption: '',
        logo: null,
        favicon: null,
      });
    }
    return store;
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to fetch store settings');
    err.status = 500;
    throw err;
  }
};
const updateStoreSettings = async (data, files) => {
  try {
    let store = await Store.findOne({ order: [['createdAt', 'ASC']] });
    if (!store) {
      store = await Store.create({
        name: data.name || 'AI Saree',
        caption: data.caption || '',
        logo: null,
        favicon: null,
      });
    }
    if (data.name !== undefined) {
      if (!data.name || !String(data.name).trim()) {
        const err = new Error('Name is required');
        err.status = 400;
        throw err;
      }
      store.name = String(data.name).trim();
    }
    if (data.caption !== undefined) {
      store.caption = data.caption ? String(data.caption).trim() : null;
    }
    if (files && files.logo && files.logo[0]) {
      if (store.logo) {
        const oldPath = path.join(__dirname, '..', store.logo.replace(/^\//, ''));
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (e) {}
        }
      }
      store.logo = `/uploads/store/${files.logo[0].filename}`;
    }
    if (files && files.favicon && files.favicon[0]) {
      if (store.favicon) {
        const oldPath = path.join(__dirname, '..', store.favicon.replace(/^\//, ''));
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (e) {}
        }
      }
      store.favicon = `/uploads/store/${files.favicon[0].filename}`;
    }
    await store.save();
    return store;
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to update store settings');
    err.status = 500;
    throw err;
  }
};
module.exports = {
  getStoreSettings,
  updateStoreSettings,
};
