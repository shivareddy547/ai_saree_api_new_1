// Pure Node.js audio generation without external dependencies
// Generates a simple sine wave WAV file
const generateWav = (durationSec, frequency = 440, sampleRate = 44100, amplitude = 0.5) => {
  const numSamples = Math.floor(sampleRate * durationSec);
  const data = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    data[i] = Math.sin(2 * Math.PI * frequency * t) * amplitude;
  }
  // Convert to WAV format (mono, 16-bit PCM)
  const numChannels = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const dataLength = numSamples * numChannels * bytesPerSample;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(8, 'WAVE');
  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
  // data chunk
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);
  // Write audio data
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    let sample = Math.max(-1, Math.min(1, data[i]));
    sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, Math.round(sample), true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
};
// Async wrapper for compatibility with existing code
const generateFallbackAudio = (duration = 5, frequency = 440) => {
  return Promise.resolve(generateWav(duration, frequency));
};
// Keep simple tone generator for direct use
const generateSimpleTone = generateWav;
module.exports = { generateFallbackAudio, generateSimpleTone };
