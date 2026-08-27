const BaseProvider = require('./BaseProvider');
class MistralProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.endpoint = config.endpoint || 'https://api.mistral.ai/v1';
  }
  async chat(messages) {
    return { success: true, provider: 'mistral', messages, stub: true };
  }
  async embeddings(text) {
    return { success: true, provider: 'mistral', text, stub: true };
  }
  async models() {
    return { success: true, provider: 'mistral', models: [], stub: true };
  }
  async test_connection() {
    if (!this.apiKey) {
      return { success: false, message: 'API key is required for Mistral' };
    }
    return { success: true, message: 'Mistral connection test passed (stub)' };
  }
}
module.exports = MistralProvider;
