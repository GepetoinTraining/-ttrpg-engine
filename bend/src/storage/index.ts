// ============================================
// STORAGE LAYER
// ============================================
//
// Asset storage using Vercel Blob.
//
// Server Usage:
//
//   import { BlobStorage, getStorage } from '@/storage';
//
//   const storage = getStorage();
//   const result = await storage.uploadMap(file, campaignId, userId, 'Battle Map');
//   console.log(result.url);
//
// Client Usage:
//
//   import { StorageClient, initStorageClient } from '@/storage';
//
//   const client = initStorageClient({
//     uploadUrl: '/api/storage/upload',
//     campaignId: 'xxx',
//     onProgress: (p) => console.log(`${p.percent}%`),
//   });
//
//   const result = await client.uploadMap(file, 'Dragon Lair');
//
// URL Utilities:
//
//   import { getThumbnailUrl, createSignedUrl } from '@/storage';
//
//   const thumb = getThumbnailUrl(imageUrl, 150);
//   const signed = await createSignedUrl(url, { expiresIn: 3600 });
//

// Blob storage (server)
export {
  BlobStorage,
  getStorage,
  initStorage,
  type AssetType,
  type AssetMetadata,
  type UploadOptions,
  type UploadResult,
  type StorageConfig,
} from "./blob";

// Storage client (frontend)
export {
  StorageClient,
  getStorageClient,
  initStorageClient,
  type UploadProgress,
  type UploadResult as ClientUploadResult,
  type StorageClientConfig,
} from "./client";

// Upload processing (server)
export {
  validateUpload,
  validateMetadata,
  processUpload,
  generateFilename,
  checkDuplicate,
  registerUpload,
  clearHashCache,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZES,
  UploadMetadataSchema,
  type UploadRequest,
  type ProcessedUpload,
  type UploadValidation,
  type UploadMetadata,
  type DuplicateCheck,
} from "./upload";

// URL utilities
export {
  getBaseUrl,
  buildUrl,
  getPathFromUrl,
  buildImageUrl,
  getThumbnailUrl,
  getMediumUrl,
  getLargeUrl,
  getAssetUrls,
  getTokenUrl,
  getMapUrl,
  createSignedUrl,
  verifySignedUrl,
  createPresignedUploadUrl,
  isStorageUrl,
  isImageUrl,
  isAudioUrl,
  isVideoUrl,
  getExtension,
  type UrlOptions,
  type SignedUrlOptions,
  type AssetUrls,
  type PresignedUploadUrl,
} from "./urls";
