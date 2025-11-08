/**
 * Image processing utilities for Codex.
 *
 * This module provides interfaces for image loading, resizing, and encoding.
 * The actual image processing implementation is intentionally stubbed, as it
 * typically requires native dependencies (e.g., sharp, canvas, or similar).
 * Library consumers should provide their own implementation if needed.
 */

/**
 * Maximum width for resized images.
 */
export const MAX_WIDTH = 2048;

/**
 * Maximum height for resized images.
 */
export const MAX_HEIGHT = 768;

/**
 * Encoded image with metadata.
 */
export interface EncodedImage {
  /** Image bytes */
  bytes: Buffer;
  /** MIME type (e.g., "image/png", "image/jpeg") */
  mime: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
}

/**
 * Image processing error types.
 */
export type ImageProcessingErrorType = "Read" | "Decode" | "Encode";

/**
 * Error that occurs during image processing.
 */
export class ImageProcessingError extends Error {
  constructor(
    public readonly type: ImageProcessingErrorType,
    message: string,
    public readonly path?: string,
    public readonly format?: string,
    public readonly source?: Error,
  ) {
    super(message);
    this.name = "ImageProcessingError";
  }
}

/**
 * Helper to create image processing errors with consistent formatting.
 */
export function createImageProcessingError(
  type: "Read",
  details: { path: string; message: string },
): ImageProcessingError;
export function createImageProcessingError(
  type: "Decode",
  details: { path: string; message: string },
): ImageProcessingError;
export function createImageProcessingError(
  type: "Encode",
  details: { format: string; message: string },
): ImageProcessingError;
export function createImageProcessingError(
  type: ImageProcessingErrorType,
  details: { path?: string; format?: string; message: string },
): ImageProcessingError {
  let message: string;
  switch (type) {
    case "Read":
      message = `failed to read image at ${details.path}: ${details.message}`;
      break;
    case "Decode":
      message = `failed to decode image at ${details.path}: ${details.message}`;
      break;
    case "Encode":
      message = `failed to encode image as ${details.format}: ${details.message}`;
      break;
  }

  return new ImageProcessingError(type, message, details.path, details.format);
}

/**
 * Convert an EncodedImage to a data URL.
 *
 * @param image - The encoded image
 * @returns Data URL string (e.g., "data:image/png;base64,...")
 */
export function toDataUrl(image: EncodedImage): string {
  const base64 = image.bytes.toString("base64");
  return `data:${image.mime};base64,${base64}`;
}

/**
 * Load and resize an image to fit within MAX_WIDTH x MAX_HEIGHT.
 *
 * **Note:** This function is intentionally left unimplemented as a stub.
 * Image processing typically requires native dependencies which would add
 * significant complexity to the library. Library consumers should provide
 * their own implementation using libraries like `sharp`, `canvas`, or similar.
 *
 * @param path - Path to the image file
 * @returns Promise resolving to encoded image
 * @throws ImageProcessingError if the image cannot be processed
 *
 * @example
 * ```typescript
 * // Example implementation using 'sharp' (not included):
 * import sharp from 'sharp'
 *
 * async function loadAndResizeToFit(path: string): Promise<EncodedImage> {
 *   const image = sharp(path)
 *   const metadata = await image.metadata()
 *
 *   if (metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT) {
 *     image.resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside' })
 *   }
 *
 *   const buffer = await image.toBuffer()
 *   return {
 *     bytes: buffer,
 *     mime: 'image/png',
 *     width: metadata.width,
 *     height: metadata.height,
 *   }
 * }
 * ```
 */
export const loadAndResizeToFit: undefined = undefined;
