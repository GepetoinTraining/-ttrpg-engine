import { z } from "zod";

// ============================================
// UPLOAD HANDLING
// ============================================
//
// Server-side upload processing and validation.
//

// ============================================
// TYPES
// ============================================

export type AssetType =
  | "map"
  | "portrait"
  | "handout"
  | "token"
  | "audio"
  | "video";

export interface UploadRequest {
  file: File | Blob;
  type: AssetType;
  name: string;
  campaignId: string;
  uploadedBy: string;
  metadata?: Record<string, any>;
}

export interface ProcessedUpload {
  buffer: Buffer;
  mimeType: string;
  size: number;
  hash: string;
  dimensions?: { width: number; height: number };
}

export interface UploadValidation {
  valid: boolean;
  errors: string[];
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

export const UploadMetadataSchema = z.object({
  // Map metadata
  gridSize: z.number().int().min(1).max(100).optional(),
  width: z.number().int().min(1).optional(),
  height: z.number().int().min(1).optional(),

  // Portrait metadata
  entityType: z.enum(["character", "npc", "faction"]).optional(),
  entityId: z.string().uuid().optional(),

  // Handout metadata
  description: z.string().max(1000).optional(),
  isSecret: z.boolean().optional(),

  // Token metadata
  tokenSize: z
    .enum(["tiny", "small", "medium", "large", "huge", "gargantuan"])
    .optional(),

  // Audio metadata
  category: z.enum(["music", "ambiance", "sfx"]).optional(),
  duration: z.number().optional(),

  // Generic
  tags: z.array(z.string()).optional(),
});

export type UploadMetadata = z.infer<typeof UploadMetadataSchema>;

// ============================================
// MIME TYPE CONFIGS
// ============================================

export const ALLOWED_MIME_TYPES: Record<AssetType, string[]> = {
  map: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  portrait: ["image/png", "image/jpeg", "image/webp"],
  handout: [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/pdf",
  ],
  token: ["image/png", "image/webp"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"],
  video: ["video/mp4", "video/webm"],
};

export const MAX_FILE_SIZES: Record<AssetType, number> = {
  map: 50 * 1024 * 1024, // 50MB
  portrait: 5 * 1024 * 1024, // 5MB
  handout: 20 * 1024 * 1024, // 20MB
  token: 2 * 1024 * 1024, // 2MB
  audio: 100 * 1024 * 1024, // 100MB
  video: 500 * 1024 * 1024, // 500MB
};

// ============================================
// VALIDATION
// ============================================

export function validateUpload(
  file: File | Blob,
  type: AssetType,
  mimeType: string,
): UploadValidation {
  const errors: string[] = [];

  // Check mime type
  if (!ALLOWED_MIME_TYPES[type].includes(mimeType)) {
    errors.push(
      `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES[type].join(", ")}`,
    );
  }

  // Check size
  const maxSize = MAX_FILE_SIZES[type];
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / 1024 / 1024);
    errors.push(`File too large. Maximum size is ${maxMB}MB`);
  }

  // Check minimum size
  if (file.size === 0) {
    errors.push("File is empty");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateMetadata(
  metadata: unknown,
  type: AssetType,
): UploadValidation {
  const errors: string[] = [];

  try {
    const parsed = UploadMetadataSchema.parse(metadata);

    // Type-specific validation
    if (type === "token" && !parsed.tokenSize) {
      // Default is fine
    }

    if (
      type === "map" &&
      parsed.gridSize &&
      (parsed.gridSize < 1 || parsed.gridSize > 100)
    ) {
      errors.push("Grid size must be between 1 and 100");
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      errors.push(
        ...e.errors.map((err) => `${err.path.join(".")}: ${err.message}`),
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// PROCESSING
// ============================================

export async function processUpload(
  file: File | Blob,
): Promise<ProcessedUpload> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = await computeHash(buffer);

  // Detect dimensions for images
  let dimensions: { width: number; height: number } | undefined;

  if (file.type.startsWith("image/")) {
    dimensions = await getImageDimensions(buffer, file.type);
  }

  return {
    buffer,
    mimeType: file.type,
    size: file.size,
    hash,
    dimensions,
  };
}

async function computeHash(buffer: Buffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getImageDimensions(
  buffer: Buffer,
  mimeType: string,
): Promise<{ width: number; height: number } | undefined> {
  // PNG
  if (mimeType === "image/png") {
    if (buffer.length < 24) return undefined;
    if (buffer.toString("hex", 0, 8) !== "89504e470d0a1a0a") return undefined;

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  // JPEG
  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;

      const marker = buffer[offset + 1];

      // SOF0 or SOF2
      if (marker === 0xc0 || marker === 0xc2) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }

      const length = buffer.readUInt16BE(offset + 2);
      offset += 2 + length;
    }
  }

  // WebP
  if (mimeType === "image/webp") {
    if (buffer.length < 30) return undefined;
    if (buffer.toString("ascii", 0, 4) !== "RIFF") return undefined;
    if (buffer.toString("ascii", 8, 12) !== "WEBP") return undefined;

    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8 ") {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return { width, height };
    }
  }

  return undefined;
}

// ============================================
// FILENAME GENERATION
// ============================================

export function generateFilename(
  type: AssetType,
  campaignId: string,
  originalName: string,
  hash: string,
): string {
  // Sanitize original name
  const sanitized = originalName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // Get extension
  const ext = sanitized.split(".").pop() || "bin";
  const base = sanitized.replace(/\.[^.]+$/, "");

  // Generate unique filename
  const shortHash = hash.slice(0, 8);

  return `${type}s/${campaignId}/${base}-${shortHash}.${ext}`;
}

// ============================================
// DUPLICATE DETECTION
// ============================================

export interface DuplicateCheck {
  isDuplicate: boolean;
  existingUrl?: string;
  existingId?: string;
}

// In-memory cache for hash -> url (would use DB in production)
const hashCache = new Map<string, { url: string; id: string }>();

export function checkDuplicate(
  campaignId: string,
  hash: string,
): DuplicateCheck {
  const key = `${campaignId}:${hash}`;
  const existing = hashCache.get(key);

  if (existing) {
    return {
      isDuplicate: true,
      existingUrl: existing.url,
      existingId: existing.id,
    };
  }

  return { isDuplicate: false };
}

export function registerUpload(
  campaignId: string,
  hash: string,
  url: string,
  id: string,
): void {
  const key = `${campaignId}:${hash}`;
  hashCache.set(key, { url, id });
}

// ============================================
// CLEANUP
// ============================================

export function clearHashCache(): void {
  hashCache.clear();
}
