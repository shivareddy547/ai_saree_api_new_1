const { UserVoice } = require('../models');
const gtts = require('gtts');
const { PassThrough } = require('stream');
class UserVoiceService {
  async getVoicesByUserId(userId) {
    try {
      const voices = await UserVoice.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
      });
      return voices;
    } catch (error) {
      console.error('Error in getVoicesByUserId:', error);
      throw new Error('Failed to fetch voices');
    }
  }
  async getVoiceById(id, userId) {
    try {
      const voice = await UserVoice.findOne({
        where: { id, userId },
      });
      if (!voice) {
        const err = new Error('Voice not found');
        err.status = 404;
        throw err;
      }
      return voice;
    } catch (error) {
      if (error.status) throw error;
      console.error('Error in getVoiceById:', error);
      throw new Error('Failed to fetch voice');
    }
  }
  async createVoice(userId, name, sampleAudioUrl, voiceProviderData = null) {
    try {
      if (!name) {
        const err = new Error('Voice name is required');
        err.status = 400;
        throw err;
      }
      const voice = await UserVoice.create({
        userId,
        name,
        sampleAudioUrl,
        voiceProviderData,
      });
      return voice;
    } catch (error) {
      if (error.status) throw error;
      console.error('Error in createVoice:', error);
      throw new Error('Failed to create voice');
    }
  }
  async deleteVoice(id, userId) {
    try {
      const voice = await UserVoice.findOne({ where: { id, userId } });
      if (!voice) {
        const err = new Error('Voice not found');
        err.status = 404;
        throw err;
      }
      await voice.destroy();
      return { message: 'Voice deleted successfully' };
    } catch (error) {
      if (error.status) throw error;
      console.error('Error in deleteVoice:', error);
      throw new Error('Failed to delete voice');
    }
  }
  // Generate cloned audio using Google TTS (gtts) for speech synthesis
  async generateClonedAudio(voiceId, userId, language, text) {
    // In a real implementation, this would call a voice cloning API.
    // For now, we use gtts to generate speech in the requested language.
    // The voiceId is ignored because we don't have actual voice cloning.
    // We still use the provided text and language.
    try {
      // Map language codes to gtts language codes
      const langMap = {
        'en': 'en',
        'hi': 'hi',
        'te': 'te',
      };
      const lang = langMap[language] || 'en';
      // Generate speech using gtts
      const speech = new gtts(text, lang);
      // Get audio as buffer
      const audioBuffer = await new Promise((resolve, reject) => {
        const chunks = [];
        const stream = speech.stream();
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (err) => reject(err));
      });
      // Return as blob (buffer)
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      return blob;
    } catch (error) {
      console.error('Error generating speech with gtts:', error);
      // Fallback to simple beep if gtts fails
      const { generateFallbackAudio } = require('../utils/audioUtils');
      const blob = await generateFallbackAudio(30, 440);
      return blob;
    }
  }
}
module.exports = new UserVoiceService();
