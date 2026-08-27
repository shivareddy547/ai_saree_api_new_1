const BaseProvider = require('./BaseProvider');
class GroqProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.endpoint = config.endpoint || 'https://api.groq.com/openai/v1';
  }
  async chat(messages) {
    return { success: true, provider: 'groq', messages, stub: true };
  }
  async embeddings(text) {
    return { success: true, provider: 'groq', text, stub: true };
  }
  async models() {
    return { success: true, provider: 'groq', models: [], stub: true };
  }
  async test_connection() {
    if (!this.apiKey) {
      return { success: false, message: 'API key is required for Groq' };
    }
    return { success: true, message: 'Groq connection test passed (stub)' };
  }
}
module.exports = GroqProvider;
