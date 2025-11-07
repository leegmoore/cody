/**
 * ViewImage tool - validates image path and injects into conversation
 *
 * Ported from: codex-rs/core/src/tools/handlers/view_image.rs
 */

import { promises as fs } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { ToolResult } from '../types.js'

export interface ViewImageParams {
  path: string
  workdir?: string
}

/**
 * Validate and prepare an image for injection into the conversation.
 *
 * This tool:
 * 1. Validates the image path exists
 * 2. Checks it's a file (not a directory)
 * 3. Reads the file and converts to base64 data URL
 * 4. Returns success with the path information
 *
 * @param params - View image parameters
 * @returns Tool result with success status
 * @throws Error if path is invalid or not a file
 */
export async function viewImage(params: ViewImageParams): Promise<ToolResult> {
  // Resolve the path
  let workingDir = params.workdir ?? process.cwd()
  if (!isAbsolute(workingDir)) {
    workingDir = resolve(process.cwd(), workingDir)
  }

  let imagePath = params.path
  if (!isAbsolute(imagePath)) {
    imagePath = resolve(workingDir, imagePath)
  }

  // Check if file exists
  let metadata
  try {
    metadata = await fs.stat(imagePath)
  } catch (error) {
    throw new Error(
      `unable to locate image at \`${imagePath}\`: ${(error as Error).message}`,
    )
  }

  // Check if it's a file
  if (!metadata.isFile()) {
    throw new Error(`image path \`${imagePath}\` is not a file`)
  }

  // Read file and convert to base64
  let fileBuffer: Buffer
  try {
    fileBuffer = await fs.readFile(imagePath)
  } catch (error) {
    throw new Error(`failed to read image file: ${(error as Error).message}`)
  }

  // Determine MIME type from extension
  const mimeType = getMimeType(imagePath)
  const base64Data = fileBuffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64Data}`

  // Return success with the image information
  // Note: The actual injection into conversation happens at a higher level
  // This tool just validates and prepares the image
  return {
    content: `attached local image path: ${imagePath}`,
    success: true,
  }
}

/**
 * Get MIME type from file extension.
 *
 * @param path - File path
 * @returns MIME type string
 */
function getMimeType(path: string): string {
  const ext = path.toLowerCase().split('.').pop()

  switch (ext) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'bmp':
      return 'image/bmp'
    case 'svg':
      return 'image/svg+xml'
    default:
      return 'image/png' // Default fallback
  }
}
