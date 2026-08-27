const BaseProvider = require('./BaseProvider');
class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.endpoint = config.endpoint || 'https://api.openai.com/v1';
  }
  async chat(messages) {
    return { success: true, provider: 'openai', messages, stub: true };
  }
  async embeddings(text) {
    return { success: true, provider: 'openai', text, stub: true };
  }
  async models() {
    return { success: true, provider: 'openai', models: [], stub: true };
  }
  async test_connection() {
    if (!this.apiKey) {
      return { success: false, message: 'API key is required for OpenAI' };
    }
    return { success: true, message: 'OpenAI connection test passed (stub)' };
  }
}
module.exports = OpenAIProvider;
