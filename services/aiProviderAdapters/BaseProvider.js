class BaseProvider {
  constructor(config = {}) {
    this.config = config;
    this.apiKey = config.api_key || null;
    this.apiSecret = config.api_secret || null;
    this.endpoint = config.endpoint || null;
    this.organizationId = config.organization_id || null;
    this.projectId = config.project_id || null;
    this.region = config.region || null;
    this.timeout = config.timeout || 60;
    this.maxRetries = config.max_retries || 3;
    this.metadata = config.metadata || {};
  }
  async chat(messages) {
    throw new Error('chat() not implemented');
  }
  async embeddings(text) {
    throw new Error('embeddings() not implemented');
  }
  async models() {
    throw new Error('models() not implemented');
  }
  async test_connection() {
    return { success: true, message: 'Connection test stub - override in subclass' };
  }
}
module.exports = BaseProvider;
