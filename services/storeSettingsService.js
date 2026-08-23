const fs = require('fs');
const { Store } = require('../models');
const { uploadFileToCloudinary } = require('../utils/cloudinary');

async function getSettings() {
  let store = await Store.findOne({ order: [['createdAt', 'ASC']] });
  if (!store) {
    store = await Store.create({
      name: 'My Store',
      caption: null,
      logo: null,
      favicon: null,
    });
  }
  return store;
}

/**
 * Update store settings. Optionally upload logo / favicon to Cloudinary.
 * @param {object} data - { name, caption }
 * @param {object} files - multer files: { logo?: File, favicon?: File }
 */
async function updateSettings(data = {}, files = {}) {
  const store = await getSettings();

  const updates = {};
  if (data.name !== undefined && String(data.name).trim()) {
    updates.name = String(data.name).trim();
  }
  if (data.caption !== undefined) {
    updates.caption = data.caption ? String(data.caption).trim() : null;
  }

  // Logo → Cloudinary folder store/logo
  if (files.logo && files.logo.path) {
    try {
      const uploaded = await uploadFileToCloudinary(files.logo.path, {
        resource_type: 'image',
        folder: 'store/logo',
      });
      updates.logo = uploaded.url;
    } finally {
      try {
        if (fs.existsSync(files.logo.path)) fs.unlinkSync(files.logo.path);
      } catch (e) {
        console.warn('Failed to remove temp logo file:', e.message);
      }
    }
  }

  // Favicon → Cloudinary folder store/favicon
  if (files.favicon && files.favicon.path) {
    try {
      const uploaded = await uploadFileToCloudinary(files.favicon.path, {
        resource_type: 'image',
        folder: 'store/favicon',
      });
      updates.favicon = uploaded.url;
    } finally {
      try {
        if (fs.existsSync(files.favicon.path)) fs.unlinkSync(files.favicon.path);
      } catch (e) {
        console.warn('Failed to remove temp favicon file:', e.message);
      }
    }
  }

  await store.update(updates);
  await store.reload();
  return store;
}

module.exports = {
  getSettings,
  updateSettings,
};
