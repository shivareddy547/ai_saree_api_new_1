const aiVideoService = require('../services/aiVideoService');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const IMAGES_DIR = path.join(UPLOADS_DIR, 'images');
const AUDIO_DIR = path.join(UPLOADS_DIR, 'audio');
[UPLOADS_DIR, IMAGES_DIR, AUDIO_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'audio') {
      cb(null, AUDIO_DIR);
    } else {
      cb(null, IMAGES_DIR);
    }
  },
  filename: (req, file, cb) => {
    const ext =
      path.extname(file.originalname) ||
      (file.mimetype.startsWith('audio') ? '.mp3' : '.jpg');
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'audio') {
      if (file.mimetype.startsWith('audio/')) return cb(null, true);
      return cb(new Error('Only audio files allowed for audio field'));
    }
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image files allowed'));
  },
});
exports.uploadMiddleware = upload.fields([
  { name: 'images', maxCount: 15 },
  { name: 'audio', maxCount: 1 },
]);
exports.generate = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const files = req.files || {};
    const imageFiles = files.images || [];
    const audioFiles = files.audio || [];
    const imageUrls = imageFiles.map((f) => `/uploads/images/${f.filename}`);
    let audioUrl = null;
    if (audioFiles.length > 0) {
      audioUrl = `/uploads/audio/${audioFiles[0].filename}`;
    }
    const body = req.body || {};
    const audioMode =
      body.audioMode || (audioUrl ? 'upload' : body.audioScript ? 'ai' : 'none');
    if (imageUrls.length === 0 && body.imageUrls) {
      try {
        const parsed =
          typeof body.imageUrls === 'string'
            ? JSON.parse(body.imageUrls)
            : body.imageUrls;
        if (Array.isArray(parsed)) {
          parsed.forEach((u) => imageUrls.push(u));
        }
      } catch (_) {}
    }
    if (imageUrls.length === 0) {
      const err = new Error('At least one image is required');
      err.status = 400;
      throw err;
    }
    const payload = {
      title: body.title || 'AI Generated Video',
      imageUrls,
      audioMode,
      audioUrl: audioUrl || body.audioUrl || null,
      audioScript: body.audioScript || null,
      audioLanguage: body.audioLanguage || 'en',
      voiceGender: body.voiceGender || 'female',
      durationSeconds: body.durationSeconds ? Number(body.durationSeconds) : 5,
    };
    const video = await aiVideoService.createAndGenerate(userId, payload);
    const isCloudinary =
      video.videoUrl && String(video.videoUrl).includes('res.cloudinary.com');
    res.status(201).json({
      success: true,
      data: video,
      message: isCloudinary
        ? 'Video generated and uploaded to Cloudinary'
        : 'Video generated (Cloudinary upload may have failed — check errorMessage)',
    });
  } catch (error) {
    next(error);
  }
};
exports.list = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await aiVideoService.listByUser(userId, { page, limit });
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
      message: 'Videos fetched successfully',
    });
  } catch (error) {
    next(error);
  }
};
exports.getById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const video = await aiVideoService.getById(userId, req.params.id);
    res.status(200).json({
      success: true,
      data: video,
      message: 'Video fetched successfully',
    });
  } catch (error) {
    next(error);
  }
};
/** Re-generate local MP4 if needed and upload/re-upload to Cloudinary */
exports.reupload = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const video = await aiVideoService.reuploadToCloudinary(userId, req.params.id);
    res.status(200).json({
      success: true,
      data: video,
      message: 'Video uploaded to Cloudinary successfully',
    });
  } catch (error) {
    next(error);
  }
};
exports.remove = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await aiVideoService.remove(userId, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
