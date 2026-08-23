const cloudinary = require('cloudinary').v2;
const fs = require('fs');

const cloudName =
  process.env.CLOUDINARY_CLOUD_NAME ||
  process.env.REACT_APP_CLOUDINARY_CLOUD_NAME ||
  'lovecart';

const apiKey =
  process.env.CLOUDINARY_API_KEY ||
  process.env.REACT_APP_CLOUDINARY_API_KEY;

const apiSecret =
  process.env.CLOUDINARY_API_SECRET ||
  process.env.REACT_APP_CLOUDINARY_API_SECRET;

const uploadPreset =
  process.env.CLOUDINARY_UPLOAD_PRESET ||
  process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET ||
  'product_videos';

if (!apiKey || !apiSecret) {
  console.warn(
    '[cloudinary] API key/secret missing. Checked CLOUDINARY_* and REACT_APP_CLOUDINARY_* env vars.'
  );
} else {
  console.log(
    `[cloudinary] Configured cloud_name=${cloudName}, api_key=${String(apiKey).slice(0, 4)}...`
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

async function uploadFileToCloudinary(filePath, options = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found for Cloudinary upload: ${filePath}`);
  }
  if (!apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary credentials missing. Set REACT_APP_CLOUDINARY_API_KEY and REACT_APP_CLOUDINARY_API_SECRET in .env'
    );
  }

  const resourceType = options.resource_type || 'image';
  const folder = options.folder || 'products';

  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: resourceType,
    folder,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    ...options,
  });

  return {
    url: result.secure_url || result.url,
    publicId: result.public_id,
    resourceType: result.resource_type,
  };
}

module.exports = {
  cloudinary,
  uploadFileToCloudinary,
  uploadPreset,
};
