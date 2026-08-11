const userVoiceService = require('../services/userVoiceService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// Configure multer for voice sample uploads
const uploadDir = 'uploads/voices';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'voice-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed'), false);
  }
};
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter
});
class UserVoiceController {
  async getVoices(req, res, next) {
    try {
      const userId = req.user.id;
      const voices = await userVoiceService.getVoicesByUserId(userId);
      res.status(200).json(voices);
    } catch (error) {
      next(error);
    }
  }
  async createVoice(req, res, next) {
    try {
      const userId = req.user.id;
      const { name } = req.body;
      let sampleAudioUrl = null;
      if (req.file) {
        sampleAudioUrl = `/uploads/voices/${req.file.filename}`;
      }
      // For demo, we store provider data as null; in real app, you'd store voice cloning provider info.
      const voice = await userVoiceService.createVoice(userId, name, sampleAudioUrl, null);
      res.status(201).json(voice);
    } catch (error) {
      next(error);
    }
  }
  async deleteVoice(req, res, next) {
    try {
      const userId = req.user.id;
      const voiceId = parseInt(req.params.id, 10);
      const result = await userVoiceService.deleteVoice(voiceId, userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
  // Generate cloned audio (mock)
  async generateClonedAudio(req, res, next) {
    try {
      const userId = req.user.id;
      const { voiceId, language, text } = req.body;
      if (!voiceId || !text) {
        const err = new Error('Voice ID and text are required');
        err.status = 400;
        throw err;
      }
      // Verify voice belongs to user
      await userVoiceService.getVoiceById(voiceId, userId);
      // Generate audio (mock)
      const audioBlob = await userVoiceService.generateClonedAudio(voiceId, userId, language, text);
      // Send as audio file
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Disposition', 'attachment; filename="generated.wav"');
      res.send(Buffer.from(await audioBlob.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  }
}
// Export upload middleware for routes
module.exports = {
  controller: new UserVoiceController(),
  upload: upload.single('sample'),
};
