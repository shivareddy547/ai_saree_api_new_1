'use strict';
/**
 * AI Video generation
 * - Images fill full frame width (portrait 720x1280)
 * - Image sequence loops until voice/audio ends
 * - Uploaded audio is muxed onto the Cloudinary video
 * Paths: ffmpeg (if present) OR pure-JS GIF → Cloudinary MP4 + audio overlay
 */
const path = require('path');
const fs = require('fs');
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

// Portrait (Reels / Shorts). Full-width fit.
const OUT_W = 720;
const OUT_H = 1280;

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
    console.error('cloudinary missing — npm install cloudinary');
    return null;
  }
}

function resolveFfmpegPath() {
  const candidates = [];
  try {
    const p = require('ffmpeg-static');
    if (p && typeof p === 'string') candidates.push(p);
  } catch (_) {}
  try {
    const inst = require('@ffmpeg-installer/ffmpeg');
    if (inst && inst.path) candidates.push(inst.path);
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
    } catch (e) {
      console.warn('ffmpeg binary unusable:', bin, e.message);
    }
  }
  try {
    await execAsync('ffmpeg -version', { timeout: 8000 });
    return 'ffmpeg';
  } catch (_) {
    return null;
  }
}

/**
 * Fit image to full WIDTH of frame; center-crop or pad height to OUT_H.
 */
async function fitImageFullWidth(jimpImg) {
  const Jimp = require('jimp');
  // Scale so width === OUT_W
  jimpImg.resize(OUT_W, Jimp.AUTO);
  const h = jimpImg.bitmap.height;
  if (h > OUT_H) {
    const y = Math.floor((h - OUT_H) / 2);
    jimpImg.crop(0, y, OUT_W, OUT_H);
  } else if (h < OUT_H) {
    const canvas = new Jimp(OUT_W, OUT_H, 0x000000ff);
    const y = Math.floor((OUT_H - h) / 2);
    canvas.composite(jimpImg, 0, y);
    return canvas;
  }
  return jimpImg;
}

/**
 * Build ordered frame list that lasts for totalDurationSec.
 * Cycles through all images until the voice/audio ends.
 */
function buildFrameSchedule(imagePaths, secondsPerImage, totalDurationSec) {
  const per = Math.max(0.5, Number(secondsPerImage) || 5);
  const total = Math.max(per, Number(totalDurationSec) || per * imagePaths.length);
  const slots = Math.max(imagePaths.length, Math.ceil(total / per));
  const delayMs = Math.round((total / slots) * 1000);
  const frames = [];
  for (let i = 0; i < slots; i++) {
    frames.push(imagePaths[i % imagePaths.length]);
  }
  return { frames, delayMs, slots, totalDuration: total, perImage: total / slots };
}

/**
 * Upload local audio to Cloudinary (as video resource) and return duration + publicId.
 */
async function uploadAudioToCloudinary(audioLocalPath, videoId) {
  const cloudinary = getCloudinary();
  if (!cloudinary) throw new Error('Cloudinary not configured');
  const result = await cloudinary.uploader.upload(audioLocalPath, {
    resource_type: 'video',
    folder: 'ai_videos/audio',
    public_id: `ai_audio_${videoId}`,
    overwrite: true,
    invalidate: true,
  });
  return {
    url: result.secure_url || result.url,
    publicId: result.public_id,
    duration: result.duration || null,
    format: result.format,
  };
}

/**
 * Mux audio onto a silent Cloudinary video using overlay layer_apply.
 * Returns permanent derived URL when possible.
 */
async function muxAudioOnCloudinary(videoPublicId, audioPublicId) {
  const cloudinary = getCloudinary();
  if (!cloudinary) throw new Error('Cloudinary not configured');

  // Try explicit eager derivation (stores a concrete derived asset URL)
  try {
    const explicit = await cloudinary.uploader.explicit(videoPublicId, {
      type: 'upload',
      resource_type: 'video',
      eager: [
        {
          overlay: { resource_type: 'video', public_id: audioPublicId },
          flags: 'layer_apply',
          format: 'mp4',
        },
      ],
      eager_async: false,
    });
    if (explicit.eager && explicit.eager[0] && (explicit.eager[0].secure_url || explicit.eager[0].url)) {
      return {
        url: explicit.eager[0].secure_url || explicit.eager[0].url,
        publicId: videoPublicId,
        method: 'eager_overlay',
      };
    }
  } catch (e) {
    console.warn('eager audio mux failed:', e.message);
  }

  // Fallback: delivery URL with audio underlay transformation
  const url = cloudinary.url(videoPublicId, {
    resource_type: 'video',
    secure: true,
    format: 'mp4',
    transformation: [
      {
        overlay: { resource_type: 'video', public_id: audioPublicId },
        flags: 'layer_apply',
      },
    ],
  });
  return { url, publicId: videoPublicId, method: 'delivery_overlay' };
}

async function uploadSilentVideoFromGif(gifPath, videoId) {
  const cloudinary = getCloudinary();
  if (!cloudinary) throw new Error('Cloudinary not configured');

  try {
    const result = await cloudinary.uploader.upload(gifPath, {
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
    };
  } catch (e) {
    console.warn('video upload of GIF failed, image+f_mp4:', e.message);
    const imgResult = await cloudinary.uploader.upload(gifPath, {
      resource_type: 'image',
      folder: 'ai_videos',
      public_id: `ai_video_${videoId}_gif`,
      overwrite: true,
      invalidate: true,
    });
    const mp4Url = cloudinary.url(imgResult.public_id, {
      resource_type: 'image',
      format: 'mp4',
      secure: true,
    });
    return {
      url: mp4Url,
      publicId: imgResult.public_id,
      duration: null,
      format: 'mp4',
      asImage: true,
    };
  }
}

/**
 * Pure-JS GIF from images, full-width frames, looping until total duration.
 */
async function buildAnimatedGif(imageUrls, secondsPerImage, totalDurationSec, outputGifPath) {
  let Jimp;
  let GIFEncoder;
  try {
    Jimp = require('jimp');
  } catch (e) {
    throw new Error('jimp is required. Run: npm install jimp@0.22.12');
  }
  try {
    GIFEncoder = require('gif-encoder-2');
  } catch (e) {
    throw new Error('gif-encoder-2 is required. Run: npm install gif-encoder-2');
  }

  const localImages = imageUrls
    .map((u) => resolveLocalPath(u))
    .filter((p) => p && fs.existsSync(p));
  if (localImages.length === 0) throw new Error('No local image files found');

  const schedule = buildFrameSchedule(localImages, secondsPerImage, totalDurationSec);

  const encoder = new GIFEncoder(OUT_W, OUT_H, 'octree', true);
  encoder.setDelay(schedule.delayMs);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.start();

  for (const imgPath of schedule.frames) {
    let img = await Jimp.read(imgPath);
    img = await fitImageFullWidth(img);
    encoder.addFrame(img.bitmap.data);
  }
  encoder.finish();
  const buffer = encoder.out.getData();
  fs.writeFileSync(outputGifPath, buffer);

  if (!fs.existsSync(outputGifPath) || fs.statSync(outputGifPath).size < 100) {
    throw new Error('GIF generation produced empty file');
  }
  return { path: outputGifPath, schedule };
}

/**
 * ffmpeg path: full-width scale, loop images until audio ends, mux audio.
 */
async function buildSlideshowWithFfmpeg(
  imageUrls,
  audioLocalPath,
  outputPath,
  secondsPerImage,
  totalDurationSec,
  ffmpegBin
) {
  const localImages = imageUrls
    .map((u) => resolveLocalPath(u))
    .filter((p) => p && fs.existsSync(p));
  if (localImages.length === 0) throw new Error('No local image files for ffmpeg');

  const schedule = buildFrameSchedule(localImages, secondsPerImage, totalDurationSec);
  const listFile = path.join(VIDEOS_DIR, `list_${uuidv4()}.txt`);
  const lines = [];
  const per = schedule.perImage;
  schedule.frames.forEach((imgPath) => {
    const escaped = imgPath.replace(/\\/g, '/').replace(/'/g, "'\\''");
    lines.push(`file '${escaped}'`);
    lines.push(`duration ${per}`);
  });
  const last = schedule.frames[schedule.frames.length - 1]
    .replace(/\\/g, '/')
    .replace(/'/g, "'\\''");
  lines.push(`file '${last}'`);
  fs.writeFileSync(listFile, lines.join('\n') + '\n');

  // scale to full WIDTH, crop/pad to 720x1280
  const vf =
    `scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=increase,` +
    `crop=${OUT_W}:${OUT_H},setsar=1,format=yuv420p`;

  const args = [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    '-vf',
    vf,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    '-movflags',
    '+faststart',
  ];

  if (audioLocalPath && fs.existsSync(audioLocalPath)) {
    args.push('-i', audioLocalPath, '-c:a', 'aac', '-shortest');
  }
  args.push(outputPath);

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
    throw new Error('ffmpeg produced empty output');
  }
  return { path: outputPath, schedule };
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
  const outputFilename = `video_${videoId}.mp4`;
  const outputPath = path.join(VIDEOS_DIR, outputFilename);
  const gifPath = path.join(VIDEOS_DIR, `video_${videoId}.gif`);
  const audioLocal = audioUrl ? resolveLocalPath(audioUrl) : null;

  try {
    let finalUrl = null;
    let cloudinaryPublicId = null;
    let engine = null;
    let extraMeta = {};
    let audioPublicId = null;
    let audioDuration = null;

    // Upload audio first (if present) to get real duration for image looping
    if (audioLocal && fs.existsSync(audioLocal)) {
      try {
        const audioUp = await uploadAudioToCloudinary(audioLocal, videoId);
        audioPublicId = audioUp.publicId;
        audioDuration = audioUp.duration;
        extraMeta.audioPublicId = audioPublicId;
        extraMeta.audioDuration = audioDuration;
        extraMeta.audioUrl = audioUp.url;
      } catch (ae) {
        console.warn('Audio upload failed:', ae.message);
        extraMeta.audioError = ae.message;
      }
    }

    // Total timeline: prefer audio length so images keep rotating until voice ends
    const totalDuration =
      (audioDuration && audioDuration > 0
        ? audioDuration
        : perImage * Math.max(1, imageUrls.length));

    const ffmpegBin = await checkFfmpeg();

    if (ffmpegBin) {
      const built = await buildSlideshowWithFfmpeg(
        imageUrls,
        audioLocal && fs.existsSync(audioLocal) ? audioLocal : null,
        outputPath,
        perImage,
        totalDuration,
        ffmpegBin
      );
      engine = audioLocal ? 'ffmpeg+audio' : 'ffmpeg';
      extraMeta.schedule = {
        slots: built.schedule.slots,
        perImage: built.schedule.perImage,
        totalDuration: built.schedule.totalDuration,
      };

      try {
        const cloudinary = getCloudinary();
        const uploaded = await cloudinary.uploader.upload(outputPath, {
          resource_type: 'video',
          folder: 'ai_videos',
          public_id: `ai_video_${videoId}`,
          overwrite: true,
          invalidate: true,
        });
        finalUrl = uploaded.secure_url || uploaded.url;
        cloudinaryPublicId = uploaded.public_id;
        engine = audioLocal ? 'ffmpeg+audio+cloudinary' : 'ffmpeg+cloudinary';
        extraMeta.duration = uploaded.duration;
        extraMeta.format = uploaded.format;
        extraMeta.localPath = `/uploads/videos/${outputFilename}`;
      } catch (upErr) {
        finalUrl = `/uploads/videos/${outputFilename}`;
        extraMeta.localPath = finalUrl;
        extraMeta.cloudinaryError = upErr.message || String(upErr);
      }
    } else {
      // Pure JS path: GIF frames looped for full audio duration
      const built = await buildAnimatedGif(
        imageUrls,
        perImage,
        totalDuration,
        gifPath
      );
      extraMeta.schedule = {
        slots: built.schedule.slots,
        perImage: built.schedule.perImage,
        totalDuration: built.schedule.totalDuration,
        delayMs: built.schedule.delayMs,
      };

      const silent = await uploadSilentVideoFromGif(gifPath, videoId);
      finalUrl = silent.url;
      cloudinaryPublicId = silent.publicId;
      engine = silent.asImage ? 'gif+cloudinary_f_mp4' : 'gif+cloudinary_video';
      extraMeta.duration = silent.duration;
      extraMeta.format = silent.format;

      // Mux uploaded voice onto the silent video
      if (audioPublicId && cloudinaryPublicId && !silent.asImage) {
        try {
          const muxed = await muxAudioOnCloudinary(cloudinaryPublicId, audioPublicId);
          finalUrl = muxed.url;
          engine = 'gif+cloudinary+audio';
          extraMeta.audioMuxMethod = muxed.method;
        } catch (muxErr) {
          console.warn('Audio mux failed:', muxErr.message);
          extraMeta.audioMuxError = muxErr.message;
        }
      } else if (audioLocal && !audioPublicId) {
        extraMeta.audioMuxError = 'Audio file present but Cloudinary audio upload failed';
      } else if (audioMode === 'ai' && !audioLocal) {
        extraMeta.audioNote =
          'AI voice-over script was provided but no audio file was generated/uploaded. Upload an audio file or enable TTS.';
      }
    }

    if (!finalUrl) throw new Error('Video generation produced no URL');

    await record.update({
      status: 'completed',
      videoUrl: finalUrl,
      thumbnailUrl: imageUrls[0],
      errorMessage: extraMeta.cloudinaryError
        ? `Cloudinary warning: ${extraMeta.cloudinaryError}`
        : extraMeta.audioMuxError
        ? `Video OK; audio mux warning: ${extraMeta.audioMuxError}`
        : null,
      metadata: {
        engine,
        frameCount: imageUrls.length,
        cloudinaryPublicId,
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
  // Re-run generation pipeline for this record (images + audio)
  const video = await GeneratedVideo.findOne({ where: { id, userId } });
  if (!video) {
    const err = new Error('Video not found');
    err.status = 404;
    throw err;
  }
  // Soft-delete old row state by regenerating via createAndGenerate-like path
  const payload = {
    title: video.title,
    imageUrls: video.imageUrls || [],
    audioMode: video.audioMode || 'none',
    audioUrl: video.audioUrl || null,
    audioScript: video.audioScript || null,
    audioLanguage: video.audioLanguage || 'en',
    voiceGender: video.voiceGender || 'female',
    durationSeconds: video.durationSeconds || 5,
  };

  ensureDirs();
  const videoId = video.id;
  const imageUrls = payload.imageUrls;
  const perImage = payload.durationSeconds;
  const outputPath = path.join(VIDEOS_DIR, `video_${videoId}.mp4`);
  const gifPath = path.join(VIDEOS_DIR, `video_${videoId}.gif`);
  const audioLocal = payload.audioUrl ? resolveLocalPath(payload.audioUrl) : null;

  let audioPublicId = null;
  let audioDuration = null;
  let extraMeta = {};

  if (audioLocal && fs.existsSync(audioLocal)) {
    const audioUp = await uploadAudioToCloudinary(audioLocal, videoId);
    audioPublicId = audioUp.publicId;
    audioDuration = audioUp.duration;
    extraMeta.audioPublicId = audioPublicId;
    extraMeta.audioDuration = audioDuration;
  }

  const totalDuration =
    audioDuration && audioDuration > 0
      ? audioDuration
      : perImage * Math.max(1, imageUrls.length);

  const ffmpegBin = await checkFfmpeg();
  let finalUrl;
  let cloudinaryPublicId;
  let engine;

  if (ffmpegBin) {
    await buildSlideshowWithFfmpeg(
      imageUrls,
      audioLocal && fs.existsSync(audioLocal) ? audioLocal : null,
      outputPath,
      perImage,
      totalDuration,
      ffmpegBin
    );
    const cloudinary = getCloudinary();
    const uploaded = await cloudinary.uploader.upload(outputPath, {
      resource_type: 'video',
      folder: 'ai_videos',
      public_id: `ai_video_${videoId}`,
      overwrite: true,
    });
    finalUrl = uploaded.secure_url || uploaded.url;
    cloudinaryPublicId = uploaded.public_id;
    engine = 'ffmpeg+cloudinary';
  } else {
    await buildAnimatedGif(imageUrls, perImage, totalDuration, gifPath);
    const silent = await uploadSilentVideoFromGif(gifPath, videoId);
    finalUrl = silent.url;
    cloudinaryPublicId = silent.publicId;
    engine = 'gif+cloudinary';
    if (audioPublicId && !silent.asImage) {
      const muxed = await muxAudioOnCloudinary(cloudinaryPublicId, audioPublicId);
      finalUrl = muxed.url;
      engine = 'gif+cloudinary+audio';
      extraMeta.audioMuxMethod = muxed.method;
    }
  }

  await video.update({
    status: 'completed',
    videoUrl: finalUrl,
    errorMessage: null,
    metadata: {
      ...(video.metadata || {}),
      engine,
      frameCount: imageUrls.length,
      cloudinaryPublicId,
      ...extraMeta,
    },
  });
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
      } catch (_) {
        try {
          await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        } catch (_) {}
      }
    }
  }
  if (video.metadata && video.metadata.localPath) {
    const filePath = resolveLocalPath(video.metadata.localPath);
    try {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) {}
  }
  await video.destroy();
  return true;
};

module.exports = {
  createAndGenerate,
  getById,
  listByUser,
  remove,
  reuploadToCloudinary,
};
