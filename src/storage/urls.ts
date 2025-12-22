// ============================================
// URL UTILITIES
// ============================================
//
// URL generation, signing, and transformations.
//

// ============================================
// TYPES
// ============================================

export interface UrlOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: "auto" | "webp" | "avif" | "jpeg" | "png";
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

export interface SignedUrlOptions {
  expiresIn?: number; // seconds
  allowedIps?: string[];
}

export interface AssetUrls {
  original: string;
  thumbnail?: string;
  medium?: string;
  large?: string;
}

// ============================================
// URL GENERATION
// ============================================

const CDN_BASE_URL = process.env.CDN_BASE_URL || "";
const BLOB_BASE_URL = process.env.BLOB_BASE_URL || "";

/**
 * Get base URL for assets
 */
export function getBaseUrl(): string {
  return CDN_BASE_URL || BLOB_BASE_URL;
}

/**
 * Build full URL from path
 */
export function buildUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const base = getBaseUrl();
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;

  return `${base}/${cleanPath}`;
}

/**
 * Get asset path from full URL
 */
export function getPathFromUrl(url: string): string {
  const base = getBaseUrl();
  if (url.startsWith(base)) {
    return url.slice(base.length + 1);
  }
  return url;
}

// ============================================
// IMAGE TRANSFORMATIONS
// ============================================

/**
 * Build URL with image transformations
 * Uses Vercel Image Optimization API format
 */
export function buildImageUrl(url: string, options: UrlOptions): string {
  const params = new URLSearchParams();

  if (options.width) params.set("w", options.width.toString());
  if (options.height) params.set("h", options.height.toString());
  if (options.quality) params.set("q", options.quality.toString());
  if (options.format && options.format !== "auto")
    params.set("fm", options.format);
  if (options.fit) params.set("fit", options.fit);

  const queryString = params.toString();
  if (!queryString) return url;

  // Use Next.js Image Optimization
  return `/_next/image?url=${encodeURIComponent(url)}&${queryString}`;
}

/**
 * Get thumbnail URL
 */
export function getThumbnailUrl(url: string, size = 150): string {
  return buildImageUrl(url, {
    width: size,
    height: size,
    fit: "cover",
    quality: 80,
  });
}

/**
 * Get medium-sized URL
 */
export function getMediumUrl(url: string): string {
  return buildImageUrl(url, {
    width: 800,
    quality: 85,
  });
}

/**
 * Get large URL
 */
export function getLargeUrl(url: string): string {
  return buildImageUrl(url, {
    width: 1920,
    quality: 90,
  });
}

/**
 * Get all size variants
 */
export function getAssetUrls(url: string, isImage: boolean): AssetUrls {
  if (!isImage) {
    return { original: url };
  }

  return {
    original: url,
    thumbnail: getThumbnailUrl(url),
    medium: getMediumUrl(url),
    large: getLargeUrl(url),
  };
}

// ============================================
// TOKEN URLS
// ============================================

const TOKEN_SIZES: Record<string, number> = {
  tiny: 32,
  small: 48,
  medium: 64,
  large: 96,
  huge: 128,
  gargantuan: 192,
};

/**
 * Get token URL at specific grid size
 */
export function getTokenUrl(
  url: string,
  size: keyof typeof TOKEN_SIZES,
  gridPx = 64,
): string {
  const multiplier = TOKEN_SIZES[size] / 64;
  const targetSize = Math.round(gridPx * multiplier);

  return buildImageUrl(url, {
    width: targetSize,
    height: targetSize,
    fit: "contain",
  });
}

// ============================================
// MAP URLS
// ============================================

/**
 * Get map URL at specific zoom level
 */
export function getMapUrl(url: string, zoom: number, maxWidth = 4096): string {
  const width = Math.min(Math.round(maxWidth * zoom), maxWidth);

  return buildImageUrl(url, {
    width,
    quality: zoom < 0.5 ? 70 : 85,
  });
}

// ============================================
// SIGNED URLS
// ============================================

const SIGNING_SECRET = process.env.URL_SIGNING_SECRET || "";

/**
 * Create signed URL with expiration
 */
export async function createSignedUrl(
  url: string,
  options: SignedUrlOptions = {},
): Promise<string> {
  const expiresIn = options.expiresIn || 3600; // 1 hour default
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

  const payload = {
    url,
    exp: expiresAt,
    ips: options.allowedIps,
  };

  const signature = await signPayload(payload);

  const params = new URLSearchParams();
  params.set("exp", expiresAt.toString());
  params.set("sig", signature);

  if (options.allowedIps) {
    params.set("ips", options.allowedIps.join(","));
  }

  return `${url}?${params.toString()}`;
}

/**
 * Verify signed URL
 */
export async function verifySignedUrl(
  url: string,
  signature: string,
  expiresAt: number,
  clientIp?: string,
  allowedIps?: string[],
): Promise<boolean> {
  // Check expiration
  if (Date.now() / 1000 > expiresAt) {
    return false;
  }

  // Check IP if restricted
  if (allowedIps && allowedIps.length > 0 && clientIp) {
    if (!allowedIps.includes(clientIp)) {
      return false;
    }
  }

  // Verify signature
  const payload = {
    url: url.split("?")[0],
    exp: expiresAt,
    ips: allowedIps,
  };

  const expectedSignature = await signPayload(payload);
  return signature === expectedSignature;
}

async function signPayload(payload: object): Promise<string> {
  const data = JSON.stringify(payload);
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));

  return Buffer.from(signature).toString("base64url");
}

// ============================================
// PRESIGNED UPLOAD URLS
// ============================================

export interface PresignedUploadUrl {
  uploadUrl: string;
  assetUrl: string;
  expiresAt: number;
  fields: Record<string, string>;
}

/**
 * Create presigned URL for direct upload
 * (Used with Vercel Blob client uploads)
 */
export async function createPresignedUploadUrl(
  filename: string,
  contentType: string,
  maxSize: number,
  expiresIn = 3600,
): Promise<PresignedUploadUrl> {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

  // Generate upload token
  const token = await generateUploadToken(
    filename,
    contentType,
    maxSize,
    expiresAt,
  );

  const baseUrl = getBaseUrl();

  return {
    uploadUrl: `${baseUrl}/upload`,
    assetUrl: `${baseUrl}/${filename}`,
    expiresAt,
    fields: {
      "Content-Type": contentType,
      "x-upload-token": token,
    },
  };
}

async function generateUploadToken(
  filename: string,
  contentType: string,
  maxSize: number,
  expiresAt: number,
): Promise<string> {
  const payload = { filename, contentType, maxSize, exp: expiresAt };
  return signPayload(payload);
}

// ============================================
// URL VALIDATION
// ============================================

/**
 * Check if URL is from our storage
 */
export function isStorageUrl(url: string): boolean {
  const base = getBaseUrl();
  return url.startsWith(base) || url.startsWith("/");
}

/**
 * Check if URL is an image
 */
export function isImageUrl(url: string): boolean {
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"];
  const lower = url.toLowerCase();
  return imageExtensions.some((ext) => lower.includes(ext));
}

/**
 * Check if URL is an audio file
 */
export function isAudioUrl(url: string): boolean {
  const audioExtensions = [".mp3", ".wav", ".ogg", ".webm", ".m4a"];
  const lower = url.toLowerCase();
  return audioExtensions.some((ext) => lower.includes(ext));
}

/**
 * Check if URL is a video file
 */
export function isVideoUrl(url: string): boolean {
  const videoExtensions = [".mp4", ".webm", ".mov"];
  const lower = url.toLowerCase();
  return videoExtensions.some((ext) => lower.includes(ext));
}

/**
 * Get file extension from URL
 */
export function getExtension(url: string): string {
  const path = url.split("?")[0];
  const parts = path.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}
