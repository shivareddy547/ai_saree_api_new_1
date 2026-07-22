'use strict';
const helpUsService = require('../services/helpUsService');

const create = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const feedback = await helpUsService.createHelpUs({ name, description });
    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully.',
      data: feedback,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { create };
