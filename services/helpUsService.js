'use strict';
const { HelpUs } = require('../models');

const createHelpUs = async (data) => {
  const { name, description } = data;

  if (!name || !description) {
    const error = new Error('Name and description are required.');
    error.status = 400;
    throw error;
  }

  const feedback = await HelpUs.create({ name, description });
  return feedback;
};

module.exports = { createHelpUs };
