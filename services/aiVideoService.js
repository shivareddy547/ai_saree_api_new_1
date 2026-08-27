'use strict';
/**
 * AI Video generation
 * 1) Full-frame COVER + Ken Burns zoom in/out per image
 * 2) Show ALL images for durationSeconds each; LOOP audio until video ends
 * 3) Always encode H.264 MP4 and upload to Cloudinary
 */
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { execFile, exec } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);
const { v4: uuidv4 } = require('uuid');
const { GeneratedVideo } = require('../models');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');
const IMAGES_DIR = path.join(UPLOADS_DIR, 'images');
const AUDIO_DIR = path.join(UPLOADS_DIR, 'audio');

const CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME ||
  process.env.REACT_APP_CLOUDINARY_CLOUD_NAME ||
  'lovecart';
const CLOUD_API_KEY =
  process.env.CLOUDINARY_API_KEY ||
  process.env.REACT_APP_CLOUDINARY_API_KEY ||
  '294643716448519';
const CLOUD_API_SECRET =
  process.env.CLOUDINARY_API_SECRET ||
  process.env.REACT_APP_CLOUDINARY_API_SECRET ||
  'cDqrjR6rxnH1kp4-5bZOJz3y9Hg';

const OUT_W = 1080;
const OUT_H = 1920;
const FPS = 30;

const LANG_MAP = {
  en: 'en',
  hi: 'hi',
  ta: 'ta',
  te: 'te',
  bn: 'bn',
  mr: 'mr',
};

function ensureDirs() {
  [UPLOADS_DIR, VIDEOS_DIR, IMAGES_DIR, AUDIO_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function resolveLocalPath(urlOrPath) {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith('/uploads/')) {
    return path.join(__dirname, '..', urlOrPath.replace(/^\//, ''));
  }
  if (path.isAbsolute(urlOrPath) && fs.existsSync(urlOrPath)) return urlOrPath;
  return null;
}

function getCloudinary() {
  try {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: CLOUD_NAME,
      api_key: CLOUD_API_KEY,
      api_secret: CLOUD_API_SECRET,
      secure: true,
    });
    return cloudinary;
  } catch (e) {
    return null;
  }
}

function resolveFfmpegPath() {
  const candidates = [];
  try {
    const p = require('ffmpeg-static');
    if (p && typeof p === 'string') candidates.push(p);
  } catch (_) {}
  candidates.push(
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    path.join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg')
  );
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) {
        try {
          fs.chmodSync(c, 0o755);
        } catch (_) {}
        return c;
      }
    } catch (_) {}
  }
  return null;
}

async function checkFfmpeg() {
  const bin = resolveFfmpegPath();
  if (bin) {
    try {
      await execFileAsync(bin, ['-version'], { timeout: 15000 });
      return bin;
    } catch (_) {}
  }
  try {
    await execAsync('ffmpeg -version', { timeout: 8000 });
    return 'ffmpeg';
  } catch (_) {
    return null;
  }
}

function downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://translate.google.com/',
          Accept: '*/*',
        },
        timeout: 60000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          try {
            fs.unlinkSync(destPath);
          } catch (_) {}
          return downloadToFile(res.headers.location, destPath).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          try {
            fs.unlinkSync(destPath);
          } catch (_) {}
          return reject(new Error(`TTS download HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(destPath)));
      }
    );
    req.on('error', (err) => {
      try {
        fs.unlinkSync(destPath);
      } catch (_) {}
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('TTS download timeout'));
    });
  });
}

async function synthesizeAiVoice(script, language, voiceGender, outputPath) {
  const text = String(script || '').trim();
  if (!text) throw new Error('AI voice script is empty');

  let googleTTS;
  try {
    googleTTS = require('google-tts-api');
  } catch (e) {
    throw new Error('google-tts-api is required. Run: npm install google-tts-api');
  }

  const lang = LANG_MAP[(language || 'en').toLowerCase()] || 'en';
  void voiceGender;

  const urls = googleTTS.getAllAudioUrls(text, {
    lang,
    slow: false,
    host: 'https://translate.google.com',
    splitPunct: ',.!?।',
  });
  if (!urls || urls.length === 0) throw new Error('TTS produced no audio URLs');

  const partPaths = [];
  try {
    for (let i = 0; i < urls.length; i++) {
      const partPath = outputPath.replace(/\.mp3$/i, '') + `_part${i}.mp3`;
      await downloadToFile(urls[i].url, partPath);
      partPaths.push(partPath);
    }
    if (partPaths.length === 1) {
      fs.copyFileSync(partPaths[0], outputPath);
    } else {
      fs.writeFileSync(
        outputPath,
        Buffer.concat(partPaths.map((p) => fs.readFileSync(p)))
      );
    }
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 100) {
      throw new Error('TTS audio file is empty');
    }
    return outputPath;
  } finally {
    partPaths.forEach((p) => {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (_) {}
    });
  }
}

async function generateTtsBuffer(script, language, voiceGender) {
  ensureDirs();
  const id = uuidv4();
  const ttsPath = path.join(AUDIO_DIR, `tts_preview_${id}.mp3`);
  await synthesizeAiVoice(script, language || 'en', voiceGender || 'female', ttsPath);
  const buffer = fs.readFileSync(ttsPath);
  try {
    fs.unlinkSync(ttsPath);
  } catch (_) {}
  return { buffer, mime: 'audio/mpeg' };
}

async function resolveAudioFile(payload, videoId) {
  const { audioMode, audioUrl, audioScript, audioLanguage, voiceGender } = payload;

  if (audioMode === 'upload' && audioUrl) {
    const local = resolveLocalPath(audioUrl);
    if (local && fs.existsSync(local)) return { localPath: local, source: 'upload' };
  }

  if (audioMode === 'ai' && audioScript && String(audioScript).trim()) {
    ensureDirs();
    const ttsPath = path.join(AUDIO_DIR, `tts_${videoId}.mp3`);
    await synthesizeAiVoice(
      audioScript,
      audioLanguage || 'en',
      voiceGender || 'female',
      ttsPath
    );
    return {
      localPath: ttsPath,
      source: 'ai_tts',
      publicUrl: `/uploads/audio/tts_${videoId}.mp3`,
    };
  }

  if (audioUrl) {
    const local = resolveLocalPath(audioUrl);
    if (local && fs.existsSync(local)) return { localPath: local, source: 'upload' };
  }
  return { localPath: null, source: null };
}

/**
 * Ken Burns zoom-in then zoom-out expression for zoompan.
 * frames = durationSeconds * FPS
 * zoom goes 1.0 → 1.25 → 1.0 over the segment
 */
function kenBurnsZoomExpr(frames) {
  const half = Math.max(1, Math.floor(frames / 2));
  // on = frame number starting at 0
  // first half: zoom in, second half: zoom out
  return (
    `if(lt(on,${half}),` +
    `1+0.25*on/${half},` +
    `1.25-0.25*(on-${half})/${Math.max(1, frames - half)})`
  );
}

/**
 * Build MP4 slideshow:
 * - Each image shown for secondsPerImage
 * - Full frame COVER (scale+crop inside zoompan s=WxH)
 * - Zoom in / zoom out (Ken Burns)
 * - Audio LOOPS until all images finish (-stream_loop -1 + -shortest on video)
 */
async function buildSlideshowWithFfmpeg(
  imageUrls,
  audioLocalPath,
  outputPath,
  secondsPerImage,
  ffmpegBin
) {
  const localImages = imageUrls
    .map((u) => resolveLocalPath(u))
    .filter((p) => p && fs.existsSync(p));
  if (localImages.length === 0) {
    throw new Error('No local image files for ffmpeg');
  }

  const per = Math.max(1, Number(secondsPerImage) || 5);
  const framesPerImage = Math.max(FPS, Math.round(per * FPS));
  const hasAudio = !!(audioLocalPath && fs.existsSync(audioLocalPath));
  const n = localImages.length;

  // Inputs: one -loop 1 -t PER per image, then optional looping audio
  const args = ['-y'];

  for (let i = 0; i < n; i++) {
    // slightly longer than segment so zoompan has enough source frames
    args.push('-loop', '1', '-t', String(per + 0.5), '-i', localImages[i]);
  }

  if (hasAudio) {
    // Loop audio infinitely; video length will cut it with -shortest
    args.push('-stream_loop', '-1', '-i', audioLocalPath);
  }

  // Filter graph: scale/crop COVER + Ken Burns per image, then concat
  const filterParts = [];
  for (let i = 0; i < n; i++) {
    const zExpr = kenBurnsZoomExpr(framesPerImage);
    // scale so both dims cover OUT, then zoompan at output size (fills full frame)
    filterParts.push(
      `[${i}:v]` +
        `scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=increase,` +
        `crop=${OUT_W}:${OUT_H},` +
        `zoompan=z='${zExpr}':` +
        `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':` +
        `d=${framesPerImage}:s=${OUT_W}x${OUT_H}:fps=${FPS},` +
        `setsar=1,format=yuv420p` +
        `[v${i}]`
    );
  }
  const concatIn = Array.from({ length: n }, (_, i) => `[v${i}]`).join('');
  filterParts.push(`${concatIn}concat=n=${n}:v=1:a=0[vout]`);

  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', '[vout]');

  if (hasAudio) {
    // audio is last input index = n
    args.push('-map', `${n}:a:0`, '-c:a', 'aac', '-b:a', '192k', '-shortest');
  }

  args.push(
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(FPS),
    '-movflags',
    '+faststart',
    '-t',
    // hard cap = exact total image duration
    String(n * per),
    outputPath
  );

  try {
    await execFileAsync(ffmpegBin, args, {
      timeout: 300000,
      maxBuffer: 40 * 1024 * 1024,
    });
  } catch (err) {
    const msg = (err && (err.stderr || err.message)) || String(err);
    throw new Error('ffmpeg failed: ' + String(msg).slice(0, 800));
  }

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 500) {
    throw new Error('ffmpeg produced empty output');
  }
  return {
    path: outputPath,
    duration: n * per,
    frameCount: n,
  };
}

/**
 * Fallback without audio complexity if filter_complex fails:
 * concat demuxer + COVER scale (still full frame, no zoom).
 */
async function buildSlideshowSimple(
  imageUrls,
  audioLocalPath,
  outputPath,
  secondsPerImage,
  ffmpegBin
) {
  const localImages = imageUrls
    .map((u) => resolveLocalPath(u))
    .filter((p) => p && fs.existsSync(p));
  if (localImages.length === 0) throw new Error('No local images');

  const per = Math.max(1, Number(secondsPerImage) || 5);
  const listFile = path.join(VIDEOS_DIR, `list_${uuidv4()}.txt`);
  const lines = [];
  localImages.forEach((imgPath) => {
    const escaped = imgPath.replace(/\\/g, '/').replace(/'/g, "'\\''");
    lines.push(`file '${escaped}'`);
    lines.push(`duration ${per}`);
  });
  const last = localImages[localImages.length - 1]
    .replace(/\\/g, '/')
    .replace(/'/g, "'\\''");
  lines.push(`file '${last}'`);
  fs.writeFileSync(listFile, lines.join('\n') + '\n');

  const hasAudio = !!(audioLocalPath && fs.existsSync(audioLocalPath));
  const vf =
    `scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=increase,` +
    `crop=${OUT_W}:${OUT_H},setsar=1,format=yuv420p`;

  const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile];
  if (hasAudio) {
    args.push('-stream_loop', '-1', '-i', audioLocalPath);
  }
  args.push('-vf', vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS));
  if (hasAudio) {
    args.push('-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-shortest');
  }
  args.push(
    '-movflags',
    '+faststart',
    '-t',
    String(localImages.length * per),
    outputPath
  );

  try {
    await execFileAsync(ffmpegBin, args, {
      timeout: 240000,
      maxBuffer: 30 * 1024 * 1024,
    });
  } finally {
    try {
      if (fs.existsSync(listFile)) fs.unlinkSync(listFile);
    } catch (_) {}
  }

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 500) {
    throw new Error('ffmpeg simple path produced empty output');
  }
  return { path: outputPath, duration: localImages.length * per };
}

async function uploadMp4ToCloudinary(localPath, videoId) {
  const cloudinary = getCloudinary();
  if (!cloudinary) {
    throw new Error('Cloudinary not configured');
  }
  if (!localPath || !fs.existsSync(localPath)) {
    throw new Error('MP4 file missing for Cloudinary upload');
  }
  const result = await cloudinary.uploader.upload(localPath, {
    resource_type: 'video',
    folder: 'ai_videos',
    public_id: `ai_video_${videoId}`,
    overwrite: true,
    invalidate: true,
    format: 'mp4',
  });
  return {
    url: result.secure_url || result.url,
    publicId: result.public_id,
    duration: result.duration,
    format: result.format || 'mp4',
    bytes: result.bytes,
  };
}

const createAndGenerate = async (userId, payload) => {
  ensureDirs();
  const {
    title,
    imageUrls = [],
    audioMode = 'none',
    audioUrl = null,
    audioScript = null,
    audioLanguage = 'en',
    voiceGender = 'female',
    durationSeconds = 5,
  } = payload;

  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    const err = new Error('At least one image is required');
    err.status = 400;
    throw err;
  }

  const existingCount = imageUrls.filter((u) => {
    const p = resolveLocalPath(u);
    return p && fs.existsSync(p);
  }).length;
  if (existingCount === 0) {
    const err = new Error('Uploaded image files were not found on disk');
    err.status = 400;
    throw err;
  }

  const record = await GeneratedVideo.create({
    userId,
    title: title || 'AI Generated Video',
    imageUrls,
    audioMode,
    audioUrl,
    audioScript,
    audioLanguage,
    voiceGender,
    durationSeconds: Math.max(1, Math.min(60, Number(durationSeconds) || 5)),
    status: 'processing',
  });

  const videoId = record.id;
  const perImage = record.durationSeconds;
  const outputPath = path.join(VIDEOS_DIR, `video_${videoId}.mp4`);

  try {
    const extraMeta = {};
    let audioLocal = null;

    // 1) Resolve / synthesize audio
    try {
      const resolved = await resolveAudioFile(
        { audioMode, audioUrl, audioScript, audioLanguage, voiceGender },
        videoId
      );
      audioLocal = resolved.localPath;
      extraMeta.audioSource = resolved.source;
      if (resolved.publicUrl) {
        await record.update({ audioUrl: resolved.publicUrl });
        extraMeta.generatedAudioUrl = resolved.publicUrl;
      }
    } catch (ttsErr) {
      if (audioMode === 'ai') {
        throw new Error('AI voice generation failed: ' + (ttsErr.message || ttsErr));
      }
      extraMeta.audioError = ttsErr.message;
    }

    const ffmpegBin = await checkFfmpeg();
    if (!ffmpegBin) {
      throw new Error(
        'ffmpeg is required to generate MP4. Install: npm install ffmpeg-static && chmod +x node_modules/ffmpeg-static/ffmpeg'
      );
    }

    // 2) Always encode real MP4 (full-frame + Ken Burns; audio loops to image end)
    let engine = 'ffmpeg+kenburns';
    try {
      await buildSlideshowWithFfmpeg(
        imageUrls,
        audioLocal && fs.existsSync(audioLocal) ? audioLocal : null,
        outputPath,
        perImage,
        ffmpegBin
      );
      if (audioLocal) engine = 'ffmpeg+kenburns+audio_loop';
    } catch (kbErr) {
      console.warn('Ken Burns path failed, using simple COVER path:', kbErr.message);
      await buildSlideshowSimple(
        imageUrls,
        audioLocal && fs.existsSync(audioLocal) ? audioLocal : null,
        outputPath,
        perImage,
        ffmpegBin
      );
      engine = audioLocal ? 'ffmpeg+cover+audio_loop' : 'ffmpeg+cover';
      extraMeta.kenBurnsError = kbErr.message;
    }

    // 3) Always upload MP4 to Cloudinary
    const uploaded = await uploadMp4ToCloudinary(outputPath, videoId);
    extraMeta.duration = uploaded.duration;
    extraMeta.format = uploaded.format || 'mp4';
    extraMeta.bytes = uploaded.bytes;
    extraMeta.localPath = `/uploads/videos/video_${videoId}.mp4`;
    extraMeta.frameCount = imageUrls.length;
    extraMeta.secondsPerImage = perImage;
    extraMeta.totalImageDuration = imageUrls.length * perImage;

    await record.update({
      status: 'completed',
      videoUrl: uploaded.url,
      thumbnailUrl: imageUrls[0],
      errorMessage: null,
      metadata: {
        engine: engine + '+cloudinary',
        cloudinaryPublicId: uploaded.publicId,
        ...extraMeta,
      },
    });

    return record.reload();
  } catch (error) {
    console.error('Video generation error:', error);
    await record.update({
      status: 'failed',
      errorMessage: error.message || 'Video generation failed',
      videoUrl: null,
    });
    const err = new Error(error.message || 'Video generation failed');
    err.status = 500;
    throw err;
  }
};

const saveClientGenerated = async (userId, data) => {
  const {
    title,
    videoUrl,
    thumbnailUrl,
    imageUrls = [],
    audioMode = 'none',
    audioUrl = null,
    audioScript = null,
    audioLanguage = 'en',
    voiceGender = 'female',
    durationSeconds = 5,
    cloudinaryPublicId = null,
    metadata = {},
  } = data;

  if (!videoUrl) {
    const err = new Error('videoUrl is required');
    err.status = 400;
    throw err;
  }

  return GeneratedVideo.create({
    userId,
    title: title || 'AI Generated Video',
    videoUrl,
    thumbnailUrl: thumbnailUrl || (imageUrls[0] || null),
    imageUrls,
    audioMode,
    audioUrl,
    audioScript,
    audioLanguage,
    voiceGender,
    durationSeconds,
    status: 'completed',
    metadata: {
      engine: 'client_mediarecorder+cloudinary',
      cloudinaryPublicId,
      ...metadata,
    },
  });
};

const getById = async (userId, id) => {
  const video = await GeneratedVideo.findOne({ where: { id, userId } });
  if (!video) {
    const err = new Error('Video not found');
    err.status = 404;
    throw err;
  }
  return video;
};

const listByUser = async (userId, { page = 1, limit = 20 } = {}) => {
  const offset = (Math.max(1, page) - 1) * Math.min(50, limit);
  const { rows, count } = await GeneratedVideo.findAndCountAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    limit: Math.min(50, limit),
    offset,
  });
  return {
    items: rows,
    pagination: {
      page: Math.max(1, page),
      limit: Math.min(50, limit),
      total: count,
    },
  };
};

const reuploadToCloudinary = async (userId, id) => {
  const video = await GeneratedVideo.findOne({ where: { id, userId } });
  if (!video) {
    const err = new Error('Video not found');
    err.status = 404;
    throw err;
  }
  const result = await createAndGenerate(userId, {
    title: video.title,
    imageUrls: video.imageUrls || [],
    audioMode: video.audioMode || 'none',
    audioUrl: video.audioUrl || null,
    audioScript: video.audioScript || null,
    audioLanguage: video.audioLanguage || 'en',
    voiceGender: video.voiceGender || 'female',
    durationSeconds: video.durationSeconds || 5,
  });
  await video.update({
    status: result.status,
    videoUrl: result.videoUrl,
    thumbnailUrl: result.thumbnailUrl,
    audioUrl: result.audioUrl,
    errorMessage: result.errorMessage,
    metadata: result.metadata,
  });
  if (result.id !== video.id) {
    try {
      await GeneratedVideo.destroy({ where: { id: result.id } });
    } catch (_) {}
  }
  return video.reload();
};

const remove = async (userId, id) => {
  const video = await GeneratedVideo.findOne({ where: { id, userId } });
  if (!video) {
    const err = new Error('Video not found');
    err.status = 404;
    throw err;
  }
  const publicId = video.metadata && video.metadata.cloudinaryPublicId;
  if (publicId) {
    const cloudinary = getCloudinary();
    if (cloudinary) {
      try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
      } catch (_) {}
    }
  }
  await video.destroy();
  return true;
};

module.exports = {
  createAndGenerate,
  saveClientGenerated,
  generateTtsBuffer,
  getById,
  listByUser,
  remove,
  reuploadToCloudinary,
};
