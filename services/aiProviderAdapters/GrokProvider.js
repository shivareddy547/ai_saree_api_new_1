const BaseProvider = require('./BaseProvider');
class GrokProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.endpoint = config.endpoint || 'https://api.x.ai/v1';
  }
  async chat(messages) {
    return { success: true, provider: 'grok', messages, stub: true };
  }
  async embeddings(text) {
    return { success: true, provider: 'grok', text, stub: true };
  }
  async models() {
    return { success: true, provider: 'grok', models: [], stub: true };
  }
  async test_connection() {
    if (!this.apiKey) {
      return { success: false, message: 'API key is required for Grok (xAI)' };
    }
    return { success: true, message: 'Grok (xAI) connection test passed (stub)' };
  }
}
module.exports = GrokProvider;
