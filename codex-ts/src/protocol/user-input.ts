/**
 * User input types for protocol messages.
 *
 * This module defines the different types of input a user can provide,
 * including text and images (both pre-encoded and local file paths).
 */

/**
 * User input variants.
 *
 * Tagged union representing different types of user input that can be
 * included in protocol messages.
 */
export type UserInput =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image';
      /** Pre-encoded data URI image (e.g., "data:image/png;base64,...") */
      image_url: string;
    }
  | {
      type: 'local_image';
      /**
       * Local image path provided by the user. This will be converted to an
       * Image variant (base64 data URL) during request serialization.
       */
      path: string;
    };

/**
 * Create a text user input.
 *
 * @param text - The text content
 * @returns A text UserInput variant
 */
export function createTextInput(text: string): UserInput {
  return { type: 'text', text };
}

/**
 * Create an image user input from a data URL.
 *
 * @param imageUrl - Pre-encoded data URI image
 * @returns An image UserInput variant
 */
export function createImageInput(imageUrl: string): UserInput {
  return { type: 'image', image_url: imageUrl };
}

/**
 * Create a local image user input from a file path.
 *
 * @param path - Local file system path to the image
 * @returns A local_image UserInput variant
 */
export function createLocalImageInput(path: string): UserInput {
  return { type: 'local_image', path };
}
