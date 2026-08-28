const { GeneratedVideo, AiProvider, AiModel } = require('../models');
const { createAdapter } = require('./aiProviderAdapters');
const { Op } = require('sequelize');

const listVideos = async (userId) => {
  try {
    return await GeneratedVideo.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
  } catch (error) {
    const err = new Error('Failed to fetch generated videos');
    err.status = 500;
    throw err;
  }
};

const getVideoById = async (userId, id) => {
  const video = await GeneratedVideo.findOne({ where: { id, userId } });
  if (!video) {
    const err = new Error('Video not found');
    err.status = 404;
    throw err;
  }
  return video;
};

const saveVideo = async (userId, data) => {
  try {
    const video = await GeneratedVideo.create({
      userId,
      title: data.title || 'AI Generated Video',
      videoUrl: data.videoUrl || null,
      thumbnailUrl: data.thumbnailUrl || null,
      imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
      audioMode: data.audioMode || 'none',
      audioUrl: data.audioUrl || null,
      audioScript: data.audioScript || null,
      audioLanguage: data.audioLanguage || null,
      voiceGender: data.voiceGender || null,
      durationSeconds: data.durationSeconds || null,
      status: data.status || 'completed',
      errorMessage: null,
      metadata: {
        ...(data.metadata || {}),
        cloudinaryPublicId: data.cloudinaryPublicId || null,
      },
    });
    return video;
  } catch (error) {
    if (error.status) throw error;
    const err = new Error('Failed to save video');
    err.status = 500;
    throw err;
  }
};

/**
 * Resolve model + provider from AI Models Setup (dynamic — no hardcoded provider).
 */
const resolveModelAndProvider = async (modelId) => {
  let model = null;

  if (modelId) {
    model = await AiModel.findByPk(modelId, {
      include: [{ model: AiProvider, as: 'provider' }],
    });
  }

  // Fallback: default model on default enabled provider, else any enabled default model
  if (!model) {
    const defaultProvider = await AiProvider.findOne({
      where: { enabled: true, default_provider: true },
    });
    if (defaultProvider) {
      model = await AiModel.findOne({
        where: {
          ai_provider_id: defaultProvider.id,
          enabled: true,
        },
        order: [
          ['is_default', 'DESC'],
          ['createdAt', 'ASC'],
        ],
        include: [{ model: AiProvider, as: 'provider' }],
      });
    }
  }

  if (!model) {
    model = await AiModel.findOne({
      where: { enabled: true },
      include: [
        {
          model: AiProvider,
          as: 'provider',
          where: { enabled: true },
          required: true,
        },
      ],
      order: [
        ['is_default', 'DESC'],
        ['createdAt', 'ASC'],
      ],
    });
  }

  if (!model || !model.enabled) {
    const err = new Error(
      'No enabled AI model found. Configure models under AI Models Setup.'
    );
    err.status = 400;
    throw err;
  }

  const provider = model.provider;
  if (!provider || !provider.enabled) {
    const err = new Error(
      'AI provider for this model is not enabled. Enable it under AI Models Setup.'
    );
    err.status = 400;
    throw err;
  }

  return { model, provider };
};

/**
 * Start AI video generation using the selected (or default) model from AI Models Setup.
 * Provider is resolved dynamically from the model — not hardcoded to Grok.
 */
const generateWithAi = async (userId, data) => {
  const {
    title,
    prompt,
    modelId,
    imageUrls = [],
    durationSeconds = 8,
    aspectRatio = '9:16',
    resolution = '720p',
  } = data || {};

  if (!prompt || !String(prompt).trim()) {
    const err = new Error('Prompt is required');
    err.status = 400;
    throw err;
  }

  const { model, provider } = await resolveModelAndProvider(modelId);

  const urls = (Array.isArray(imageUrls) ? imageUrls : []).filter(
    (u) => typeof u === 'string' && u.startsWith('http')
  );

  const adapter = createAdapter(provider);

  if (typeof adapter.generateVideo !== 'function') {
    const err = new Error(
      `Provider "${provider.name}" (${provider.provider}) does not support AI video generation. ` +
        'Use Local slideshow, or configure a video-capable provider (e.g. Grok) and model under AI Models Setup.'
    );
    err.status = 400;
    throw err;
  }

  const video = await GeneratedVideo.create({
    userId,
    title: title || `${provider.name} AI Video`,
    videoUrl: null,
    thumbnailUrl: null,
    imageUrls: urls,
    audioMode: 'none',
    durationSeconds: Math.min(15, Math.max(1, Number(durationSeconds) || 8)),
    status: 'processing',
    metadata: {
      engine: 'ai_provider',
      providerKey: provider.provider,
      providerName: provider.name,
      modelId: model.id,
      modelIdentifier: model.model_identifier,
      providerId: provider.id,
      prompt: String(prompt).trim(),
      aspectRatio,
      resolution,
    },
  });

  try {
    const result = await adapter.generateVideo({
      prompt: String(prompt).trim(),
      model: model.model_identifier,
      duration: video.durationSeconds,
      aspect_ratio: aspectRatio || '9:16',
      resolution: resolution || '720p',
      imageUrls: urls,
    });

    const meta = {
      ...(video.metadata || {}),
      requestId: result.request_id,
    };
    await video.update({ metadata: meta, status: 'processing' });
    return video;
  } catch (error) {
    await video.update({
      status: 'failed',
      errorMessage: error.message || 'AI video generation failed',
    });
    throw error;
  }
};

/**
 * Poll async video job for any provider that returned a request_id.
 */
const pollAiStatus = async (userId, id) => {
  const video = await getVideoById(userId, id);
  const meta = video.metadata || {};

  if (meta.engine !== 'ai_provider' && meta.engine !== 'grok') {
    return video;
  }
  if (video.status === 'completed' || video.status === 'failed') {
    return video;
  }
  if (!meta.requestId) {
    await video.update({
      status: 'failed',
      errorMessage: 'Missing provider request_id',
    });
    return video;
  }

  const provider = await AiProvider.findByPk(meta.providerId);
  if (!provider) {
    await video.update({
      status: 'failed',
      errorMessage: 'AI provider not found',
    });
    return video;
  }

  try {
    const adapter = createAdapter(provider);
    if (typeof adapter.getVideoStatus !== 'function') {
      await video.update({
        status: 'failed',
        errorMessage: `Provider ${provider.provider} does not support status polling`,
      });
      return video;
    }

    const status = await adapter.getVideoStatus(meta.requestId);

    if (status.done && status.videoUrl) {
      await video.update({
        status: 'completed',
        videoUrl: status.videoUrl,
        metadata: { ...meta, providerStatus: status.status, raw: status.raw },
        errorMessage: null,
      });
    } else if (status.failed) {
      await video.update({
        status: 'failed',
        errorMessage: `Generation ${status.status}`,
        metadata: { ...meta, providerStatus: status.status, raw: status.raw },
      });
    } else {
      await video.update({
        status: 'processing',
        metadata: { ...meta, providerStatus: status.status },
      });
    }
    return video;
  } catch (error) {
    await video.update({
      status: 'failed',
      errorMessage: error.message || 'Failed to poll generation status',
    });
    return video;
  }
};

// Backwards-compatible aliases
const generateWithGrok = generateWithAi;
const pollGrokStatus = pollAiStatus;

module.exports = {
  listVideos,
  getVideoById,
  saveVideo,
  generateWithAi,
  pollAiStatus,
  generateWithGrok,
  pollGrokStatus,
};
