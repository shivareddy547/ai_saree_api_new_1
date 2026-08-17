const addressService = require('../services/addressService');
const listAddresses = async (req, res, next) => {
  try {
    const userId = req.userId;
    const addresses = await addressService.getAddressesByUser(userId);
    return res.status(200).json({
      success: true,
      data: addresses,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};
const getAddress = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const address = await addressService.getAddressById(id, userId);
    return res.status(200).json({
      success: true,
      data: address,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};
const createAddress = async (req, res, next) => {
  try {
    const userId = req.userId;
    const address = await addressService.createAddress(userId, req.body);
    return res.status(201).json({
      success: true,
      data: address,
      message: 'Address added successfully',
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};
const updateAddress = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const address = await addressService.updateAddress(id, userId, req.body);
    return res.status(200).json({
      success: true,
      data: address,
      message: 'Address updated successfully',
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};
const deleteAddress = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const result = await addressService.deleteAddress(id, userId);
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};
const setDefault = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const address = await addressService.setDefaultAddress(id, userId);
    return res.status(200).json({
      success: true,
      data: address,
      message: 'Default address updated',
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};
module.exports = {
  listAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefault,
};
