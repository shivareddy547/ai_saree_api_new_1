const BaseProvider = require('./BaseProvider');
class OllamaProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.endpoint = config.endpoint || 'http://localhost:11434';
  }
  async chat(messages) {
    return { success: true, provider: 'ollama', messages, stub: true };
  }
  async embeddings(text) {
    return { success: true, provider: 'ollama', text, stub: true };
  }
  async models() {
    return { success: true, provider: 'ollama', models: [], stub: true };
  }
  async test_connection() {
    return { success: true, message: 'Ollama connection test passed (stub)' };
  }
}
module.exports = OllamaProvider;
