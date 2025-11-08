/**
 * Script block detector for response text
 *
 * Scans assistant messages for <tool-calls> XML tags containing
 * TypeScript/JavaScript code to be executed in the sandbox.
 *
 * Phase 4.4 - Script Harness: Detection & Parsing
 * Design reference: SCRIPT_HARNESS_DESIGN_FINAL.md Section 8
 */

/**
 * Information about a detected script block
 */
export interface ScriptBlock {
  /** Format of the script block (XML tags only for now) */
  format: "xml";

  /** Extracted script code */
  code: string;

  /** Start index in the original text */
  startIndex: number;

  /** End index in the original text (exclusive) */
  endIndex: number;

  /** Language (always 'ts' for now) */
  language: "ts" | "js";
}

/**
 * Result of text segmentation with scripts
 */
export interface SegmentedText {
  /** Text segments in chronological order */
  segments: TextSegment[];

  /** Detected script blocks */
  scripts: ScriptBlock[];
}

/**
 * A segment of text (either plain text or a script)
 */
export type TextSegment =
  | { type: "text"; content: string; index: number }
  | { type: "script"; scriptIndex: number; index: number };

/**
 * Detect script blocks in response text
 *
 * Scans for <tool-calls>...</tool-calls> XML tags.
 * Note: Fenced blocks (```ts tool-calls) are NOT supported per design decision.
 *
 * @param text - Response text to scan
 * @returns Array of detected script blocks
 */
export function detectScriptBlocks(text: string): ScriptBlock[] {
  const blocks: ScriptBlock[] = [];

  // Regex for XML tags: <tool-calls>...</tool-calls>
  // Use /gs flags: g = global, s = . matches newlines
  const xmlRegex = /<tool-calls>(.*?)<\/tool-calls>/gs;

  let match: RegExpExecArray | null;
  while ((match = xmlRegex.exec(text)) !== null) {
    const code = match[1].trim();
    const startIndex = match.index;
    const endIndex = match.index + match[0].length;

    blocks.push({
      format: "xml",
      code,
      startIndex,
      endIndex,
      language: "ts", // Default to TypeScript
    });
  }

  return blocks;
}

/**
 * Segment text into alternating text and script blocks
 *
 * This preserves the chronological order of all content, which is
 * critical for maintaining conversation context.
 *
 * Example:
 * ```
 * "Let me help.\n<tool-calls>code</tool-calls>\nDone!"
 * ```
 * Becomes:
 * ```
 * [
 *   { type: "text", content: "Let me help.\n", index: 0 },
 *   { type: "script", scriptIndex: 0, index: 1 },
 *   { type: "text", content: "\nDone!", index: 2 }
 * ]
 * ```
 *
 * @param text - Original response text
 * @returns Segmented text with scripts and plain text in order
 */
export function segmentText(text: string): SegmentedText {
  const scripts = detectScriptBlocks(text);
  const segments: TextSegment[] = [];

  if (scripts.length === 0) {
    // No scripts, return entire text as one segment
    if (text.length > 0) {
      segments.push({ type: "text", content: text, index: 0 });
    }
    return { segments, scripts };
  }

  // Sort scripts by startIndex (should already be sorted, but be safe)
  scripts.sort((a, b) => a.startIndex - b.startIndex);

  let lastIndex = 0;
  let segmentIndex = 0;

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];

    // Add text before this script (if any)
    if (script.startIndex > lastIndex) {
      const textContent = text.substring(lastIndex, script.startIndex);
      if (textContent.length > 0) {
        segments.push({
          type: "text",
          content: textContent,
          index: segmentIndex++,
        });
      }
    }

    // Add script segment
    segments.push({ type: "script", scriptIndex: i, index: segmentIndex++ });

    lastIndex = script.endIndex;
  }

  // Add remaining text after last script (if any)
  if (lastIndex < text.length) {
    const textContent = text.substring(lastIndex);
    if (textContent.length > 0) {
      segments.push({
        type: "text",
        content: textContent,
        index: segmentIndex++,
      });
    }
  }

  return { segments, scripts };
}

/**
 * Validate XML tag structure
 *
 * Ensures:
 * - No nested <tool-calls> blocks
 * - Tags are properly balanced
 * - No malformed structures
 *
 * @param text - Text to validate
 * @returns Validation result with errors
 */
export function validateXmlStructure(text: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for nested <tool-calls> blocks (opening tag before closing tag)
  // This regex looks for: <tool-calls> ... <tool-calls> before any </tool-calls>
  const nestedRegex = /<tool-calls>(?:(?!<\/tool-calls>).)*<tool-calls>/s;
  if (nestedRegex.test(text)) {
    errors.push("Nested <tool-calls> blocks are not allowed");
  }

  // Check for unbalanced tags
  const openTags = (text.match(/<tool-calls>/g) || []).length;
  const closeTags = (text.match(/<\/tool-calls>/g) || []).length;

  if (openTags !== closeTags) {
    errors.push(
      `Unbalanced tags: ${openTags} opening, ${closeTags} closing tags`,
    );
  }

  // Check for unclosed tags (opening without matching closing)
  const blocks = text.match(/<tool-calls>.*?<\/tool-calls>/gs) || [];
  const expectedPairs = Math.min(openTags, closeTags);

  if (blocks.length !== expectedPairs) {
    errors.push("Malformed XML: tags not properly paired");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if text contains any script blocks
 *
 * Quick check without full parsing.
 *
 * @param text - Text to check
 * @returns True if script blocks are present
 */
export function hasScriptBlocks(text: string): boolean {
  return /<tool-calls>/.test(text);
}

/**
 * Extract script code without full segmentation
 *
 * Useful for quick extraction when text preservation isn't needed.
 *
 * @param text - Text containing scripts
 * @returns Array of script code strings
 */
export function extractScriptCode(text: string): string[] {
  const blocks = detectScriptBlocks(text);
  return blocks.map((block) => block.code);
}

/**
 * Count script blocks in text
 *
 * @param text - Text to analyze
 * @returns Number of script blocks found
 */
export function countScriptBlocks(text: string): number {
  return (text.match(/<tool-calls>/g) || []).length;
}

/**
 * Remove all script blocks from text
 *
 * Useful for displaying text-only version to user.
 *
 * @param text - Original text with scripts
 * @param replacement - Optional replacement text (default: empty string)
 * @returns Text with scripts removed
 */
export function removeScriptBlocks(
  text: string,
  replacement: string = "",
): string {
  return text.replace(/<tool-calls>.*?<\/tool-calls>/gs, replacement);
}

/**
 * Replace script blocks with placeholders
 *
 * Useful for preview/display purposes.
 *
 * @param text - Original text with scripts
 * @param placeholder - Placeholder function (receives script index)
 * @returns Text with placeholders
 */
export function replaceScriptBlocks(
  text: string,
  placeholder: (index: number) => string,
): string {
  let index = 0;
  return text.replace(/<tool-calls>.*?<\/tool-calls>/gs, () => {
    return placeholder(index++);
  });
}
