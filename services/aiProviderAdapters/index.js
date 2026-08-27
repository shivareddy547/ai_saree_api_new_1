const OpenAIProvider = require('./OpenAIProvider');
const AnthropicProvider = require('./AnthropicProvider');
const GeminiProvider = require('./GeminiProvider');
const OllamaProvider = require('./OllamaProvider');
const AzureProvider = require('./AzureProvider');
const GroqProvider = require('./GroqProvider');
const MistralProvider = require('./MistralProvider');
const BedrockProvider = require('./BedrockProvider');
const BaseProvider = require('./BaseProvider');
const PROVIDER_MAP = {
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  gemini: GeminiProvider,
  azure_openai: AzureProvider,
  ollama: OllamaProvider,
  groq: GroqProvider,
  mistral: MistralProvider,
  bedrock: BedrockProvider,
};
function createProviderAdapter(providerRecord) {
  const key = (providerRecord.provider || '').toLowerCase();
  const AdapterClass = PROVIDER_MAP[key] || BaseProvider;
  return new AdapterClass({
    api_key: providerRecord.api_key,
    api_secret: providerRecord.api_secret,
    endpoint: providerRecord.endpoint,
    organization_id: providerRecord.organization_id,
    project_id: providerRecord.project_id,
    region: providerRecord.region,
    timeout: providerRecord.timeout,
    max_retries: providerRecord.max_retries,
    metadata: providerRecord.metadata || {},
  });
}
module.exports = {
  createProviderAdapter,
  PROVIDER_MAP,
  BaseProvider,
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  OllamaProvider,
  AzureProvider,
  GroqProvider,
  MistralProvider,
  BedrockProvider,
};
