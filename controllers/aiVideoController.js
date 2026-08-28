const aiVideoService = require('../services/aiVideoService');

const list = async (req, res, next) => {
  try {
    const data = await aiVideoService.listVideos(req.user.id);
    res.status(200).json({
      success: true,
      data,
      message: 'Videos fetched successfully',
    });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const data = await aiVideoService.getVideoById(req.user.id, req.params.id);
    res.status(200).json({
      success: true,
      data,
      message: 'Video fetched successfully',
    });
  } catch (error) {
    next(error);
  }
};

const save = async (req, res, next) => {
  try {
    const data = await aiVideoService.saveVideo(req.user.id, req.body);
    res.status(201).json({
      success: true,
      data,
      message: 'Video saved successfully',
    });
  } catch (error) {
    next(error);
  }
};

/** Dynamic AI provider video generation (model from AI Models Setup) */
const generateAi = async (req, res, next) => {
  try {
    const data = await aiVideoService.generateWithAi(req.user.id, req.body);
    res.status(201).json({
      success: true,
      data,
      message: 'AI video generation started',
    });
  } catch (error) {
    next(error);
  }
};

/** Alias kept for older clients */
const generateGrok = generateAi;

const pollStatus = async (req, res, next) => {
  try {
    const data = await aiVideoService.pollAiStatus(req.user.id, req.params.id);
    res.status(200).json({
      success: true,
      data,
      message: 'Status updated',
    });
  } catch (error) {
    next(error);
  }
};

const tts = async (req, res, next) => {
  try {
    const err = new Error(
      'Server TTS is not configured. Use uploaded audio or local generation.'
    );
    err.status = 501;
    throw err;
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list,
  getById,
  save,
  generateAi,
  generateGrok,
  pollStatus,
  tts,
};
