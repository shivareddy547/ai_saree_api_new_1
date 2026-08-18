const storeSettingsService = require('../services/storeSettingsService');
const getSettings = async (req, res, next) => {
  try {
    const store = await storeSettingsService.getStoreSettings();
    res.status(200).json({
      success: true,
      data: store,
      message: 'Store settings fetched successfully',
    });
  } catch (error) {
    next(error);
  }
};
const updateSettings = async (req, res, next) => {
  try {
    const store = await storeSettingsService.updateStoreSettings(req.body, req.files);
    res.status(200).json({
      success: true,
      data: store,
      message: 'Store settings updated successfully',
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  getSettings,
  updateSettings,
};
