const storeSettingsService = require('../services/storeSettingsService');

const getSettings = async (req, res, next) => {
  try {
    const store = await storeSettingsService.getSettings();
    res.json({
      success: true,
      data: store,
    });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const { name, caption } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Store name is required',
      });
    }

    const files = {
      logo: req.files && req.files.logo ? req.files.logo[0] : null,
      favicon: req.files && req.files.favicon ? req.files.favicon[0] : null,
    };

    const store = await storeSettingsService.updateSettings(
      { name, caption },
      files
    );

    res.json({
      success: true,
      message: 'Store settings updated successfully',
      data: store,
    });
  } catch (error) {
    console.error('Update store settings error:', error);
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
