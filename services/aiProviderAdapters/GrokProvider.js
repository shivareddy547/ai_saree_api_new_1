const BaseProvider = require('./BaseProvider');

class GrokProvider extends BaseProvider {
  constructor(config) {
    super(config);
    let base = (config.endpoint || 'https://api.x.ai/v1').replace(/\/$/, '');
    base = base.replace(/\/(responses|chat\/completions|completions)$/i, '');
    this.endpoint = base || 'https://api.x.ai/v1';
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
    try {
      const res = await fetch(`${this.endpoint}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout((this.timeout || 60) * 1000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          success: false,
          message: `Grok connection failed: ${res.status} ${text.slice(0, 200)}`,
        };
      }
      return { success: true, message: 'Grok (xAI) connection successful' };
    } catch (err) {
      return {
        success: false,
        message: err.message || 'Grok connection test failed',
      };
    }
  }

  async generateVideo(options = {}) {
    if (!this.apiKey) {
      const err = new Error('Grok API key is required for video generation');
      err.status = 400;
      throw err;
    }
    const {
      prompt,
      model,
      duration = 8,
      aspect_ratio = '9:16',
      resolution = '720p',
      imageUrl,
      imageUrls,
    } = options;

    if (!model || !String(model).trim()) {
      const err = new Error(
        'Model is required. Select a configured model from AI Models Setup.'
      );
      err.status = 400;
      throw err;
    }
    if (!prompt || !String(prompt).trim()) {
      const err = new Error('Prompt is required for video generation');
      err.status = 400;
      throw err;
    }

    const body = {
      model: String(model).trim(),
      prompt: String(prompt).trim(),
      duration: Math.min(15, Math.max(1, Number(duration) || 8)),
      aspect_ratio: aspect_ratio || '9:16',
      resolution: resolution || '720p',
    };

    const firstImage =
      imageUrl ||
      (Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls[0] : null);
    if (firstImage && typeof firstImage === 'string' && firstImage.startsWith('http')) {
      body.image = { url: firstImage };
    }

    if (Array.isArray(imageUrls) && imageUrls.length > 1) {
      const refs = imageUrls
        .slice(0, 7)
        .filter((u) => typeof u === 'string' && u.startsWith('http'));
      if (refs.length > 0) {
        body.reference_images = refs.map((url) => ({ url }));
      }
    }

    const res = await fetch(`${this.endpoint}/videos/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout((this.timeout || 120) * 1000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data.error?.message ||
        data.message ||
        `Video generation failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
      throw err;
    }

    if (!data.request_id) {
      const err = new Error('Provider did not return a request_id');
      err.status = 502;
      throw err;
    }

    return {
      request_id: data.request_id,
      model: body.model,
      provider: 'grok',
    };
  }

  async getVideoStatus(requestId) {
    if (!this.apiKey) {
      const err = new Error('API key is required');
      err.status = 400;
      throw err;
    }
    if (!requestId) {
      const err = new Error('request_id is required');
      err.status = 400;
      throw err;
    }

    const res = await fetch(`${this.endpoint}/videos/${requestId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout((this.timeout || 60) * 1000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data.error?.message ||
        data.message ||
        `Failed to fetch video status (${res.status})`;
      const err = new Error(msg);
      err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
      throw err;
    }

    const status = (data.status || '').toLowerCase();
    const videoUrl =
      data.video?.url || data.url || data.video_url || null;

    return {
      request_id: requestId,
      status,
      videoUrl,
      raw: data,
      done: status === 'done' || status === 'completed',
      failed: status === 'failed' || status === 'expired',
    };
  }
}

module.exports = GrokProvider;
