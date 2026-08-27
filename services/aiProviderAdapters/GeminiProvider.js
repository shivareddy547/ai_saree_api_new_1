const BaseProvider = require('./BaseProvider');
class GeminiProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.endpoint = config.endpoint || 'https://generativelanguage.googleapis.com';
  }
  async chat(messages) {
    return { success: true, provider: 'gemini', messages, stub: true };
  }
  async embeddings(text) {
    return { success: true, provider: 'gemini', text, stub: true };
  }
  async models() {
    return { success: true, provider: 'gemini', models: [], stub: true };
  }
  async test_connection() {
    if (!this.apiKey) {
      return { success: false, message: 'API key is required for Gemini' };
    }
    return { success: true, message: 'Gemini connection test passed (stub)' };
  }
}
module.exports = GeminiProvider;
