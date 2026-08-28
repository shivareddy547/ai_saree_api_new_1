const OpenAIProvider = require('./OpenAIProvider');
const AnthropicProvider = require('./AnthropicProvider');
const GeminiProvider = require('./GeminiProvider');
const AzureProvider = require('./AzureProvider');
const OllamaProvider = require('./OllamaProvider');
const GroqProvider = require('./GroqProvider');
const MistralProvider = require('./MistralProvider');
const BedrockProvider = require('./BedrockProvider');
const GrokProvider = require('./GrokProvider');

const MAP = {
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  gemini: GeminiProvider,
  azure_openai: AzureProvider,
  ollama: OllamaProvider,
  groq: GroqProvider,
  mistral: MistralProvider,
  bedrock: BedrockProvider,
  grok: GrokProvider,
};

function createAdapter(providerRow) {
  if (!providerRow || !providerRow.provider) {
    const err = new Error('Invalid AI provider configuration');
    err.status = 400;
    throw err;
  }
  const Cls = MAP[providerRow.provider];
  if (!Cls) {
    const err = new Error(`Unsupported AI provider: ${providerRow.provider}`);
    err.status = 400;
    throw err;
  }
  return new Cls({
    api_key: providerRow.api_key,
    api_secret: providerRow.api_secret,
    endpoint: providerRow.endpoint,
    organization_id: providerRow.organization_id,
    project_id: providerRow.project_id,
    region: providerRow.region,
    timeout: providerRow.timeout,
    max_retries: providerRow.max_retries,
    metadata: providerRow.metadata || {},
  });
}

module.exports = { createAdapter };
