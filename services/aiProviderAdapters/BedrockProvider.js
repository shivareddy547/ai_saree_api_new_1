const BaseProvider = require('./BaseProvider');
class BedrockProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.region = config.region || 'us-east-1';
  }
  async chat(messages) {
    return { success: true, provider: 'bedrock', messages, stub: true };
  }
  async embeddings(text) {
    return { success: true, provider: 'bedrock', text, stub: true };
  }
  async models() {
    return { success: true, provider: 'bedrock', models: [], stub: true };
  }
  async test_connection() {
    if (!this.apiKey || !this.apiSecret) {
      return { success: false, message: 'API key and secret are required for AWS Bedrock' };
    }
    return { success: true, message: 'AWS Bedrock connection test passed (stub)' };
  }
}
module.exports = BedrockProvider;
