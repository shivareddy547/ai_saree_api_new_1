const BaseProvider = require('./BaseProvider');
class AzureProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.endpoint = config.endpoint || null;
  }
  async chat(messages) {
    return { success: true, provider: 'azure_openai', messages, stub: true };
  }
  async embeddings(text) {
    return { success: true, provider: 'azure_openai', text, stub: true };
  }
  async models() {
    return { success: true, provider: 'azure_openai', models: [], stub: true };
  }
  async test_connection() {
    if (!this.apiKey || !this.endpoint) {
      return { success: false, message: 'API key and endpoint are required for Azure OpenAI' };
    }
    return { success: true, message: 'Azure OpenAI connection test passed (stub)' };
  }
}
module.exports = AzureProvider;
