/**
 * File Cabinet Tools - Document Storage Stubs
 *
 * These are stub implementations with proper interfaces.
 * Full implementation will be added in a future phase.
 */

export interface SaveToFCParams {
  fileKey: string;
  note?: string; // Optional note/description
}

export interface SaveToFCResult {
  success: boolean;
  fileKey: string;
  expiresAt: Date; // 30 days from now
  message: string;
}

export interface FetchFromFCParams {
  fileKeys: string | string[];
}

export interface FetchedFile {
  fileKey: string;
  url: string;
  content: string;
  note?: string;
  savedAt: Date;
}

export interface FetchFromFCResult {
  files: FetchedFile[];
}

export interface WriteFileParams {
  fileKey: string;
  path: string; // Filesystem path to write to
  overwrite?: boolean; // Default false
}

export interface WriteFileResult {
  success: boolean;
  path: string;
  bytes: number;
}

/**
 * Save fileKey to File Cabinet (30 day storage)
 *
 * TODO: Implement File Cabinet backend storage
 * - Redis or database for persistent storage
 * - 30 day TTL
 * - Associate with user session
 */
export async function saveToFC(params: SaveToFCParams): Promise<SaveToFCResult> {
  const { fileKey } = params;

  // Validate parameters
  if (!fileKey || typeof fileKey !== 'string') {
    throw new Error('fileKey is required and must be a string');
  }

  // Stub implementation
  console.warn('[STUB] saveToFC called - not yet implemented');

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  return {
    success: true,
    fileKey,
    expiresAt,
    message: 'File saved to cabinet (stub - not persisted)',
  };
}

/**
 * Retrieve content by fileKey from File Cabinet
 *
 * TODO: Implement File Cabinet backend retrieval
 * - Fetch from Redis/database
 * - Return associated content
 * - Handle expired entries
 */
export async function fetchFromFC(params: FetchFromFCParams): Promise<FetchFromFCResult> {
  const { fileKeys } = params;

  // Handle single or multiple keys
  const keyList = Array.isArray(fileKeys) ? fileKeys : [fileKeys];

  // Validate parameters
  if (keyList.length === 0) {
    throw new Error('At least one fileKey is required');
  }

  for (const key of keyList) {
    if (!key || typeof key !== 'string') {
      throw new Error('All fileKeys must be non-empty strings');
    }
  }

  // Stub implementation
  console.warn('[STUB] fetchFromFC called - not yet implemented');

  // Return mock data
  const files: FetchedFile[] = keyList.map(key => ({
    fileKey: key,
    url: 'https://example.com',
    content: '(stub content - not yet implemented)',
    savedAt: new Date(),
  }));

  return { files };
}

/**
 * Write fileKey content directly to filesystem
 *
 * TODO: Implement zero-token file writing
 * - Fetch content from File Cabinet by fileKey
 * - Write to local filesystem
 * - Handle permissions and overwrite logic
 */
export async function writeFile(params: WriteFileParams): Promise<WriteFileResult> {
  const { fileKey, path } = params;

  // Validate parameters
  if (!fileKey || typeof fileKey !== 'string') {
    throw new Error('fileKey is required and must be a string');
  }

  if (!path || typeof path !== 'string') {
    throw new Error('path is required and must be a string');
  }

  // Stub implementation
  console.warn('[STUB] writeFile called - not yet implemented');

  return {
    success: true,
    path,
    bytes: 0,
  };
}
