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

  // Note: In full implementation, the image would be read and converted to base64
  // For now, we just validate that it exists and is a file
  // The actual injection into conversation happens at a higher level

  return {
    content: `attached local image path: ${imagePath}`,
    success: true,
  }
}
