const BaseProvider = require('./BaseProvider');
class AnthropicProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.endpoint = config.endpoint || 'https://api.anthropic.com';
  }
  async chat(messages) {
    return { success: true, provider: 'anthropic', messages, stub: true };
  }
  async embeddings(text) {
    return { success: true, provider: 'anthropic', text, stub: true };
  }
  async models() {
    return { success: true, provider: 'anthropic', models: [], stub: true };
  }
  async test_connection() {
    if (!this.apiKey) {
      return { success: false, message: 'API key is required for Anthropic' };
    }
    return { success: true, message: 'Anthropic connection test passed (stub)' };
  }
}
module.exports = AnthropicProvider;
