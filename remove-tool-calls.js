#!/usr/bin/env node

/**
 * Script to remove tool call blocks from Gemini export
 *
 * Removes:
 * - Tool Command blocks (MODEL followed by ```json with "name" and "args")
 * - Tool Response blocks (USER followed by ```json with "id", "name", "response")
 *
 * Preserves:
 * - All other USER/MODEL conversation text
 * - All other code blocks (typescript, javascript, css, etc.)
 * - Document structure
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = '/Users/leemoore/code/codex-port-02/gemini-export.md';
const OUTPUT_FILE = '/Users/leemoore/code/codex-port-02/gemini-export-cleaned.md';

// No backup needed - writing to new file
console.log(`Reading from: ${INPUT_FILE}`);
console.log(`Writing to: ${OUTPUT_FILE}`);

// Read file
const content = fs.readFileSync(INPUT_FILE, 'utf8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);

const output = [];
let i = 0;
let toolCommandsRemoved = 0;
let toolResponsesRemoved = 0;

while (i < lines.length) {
  const line = lines[i];

  // Check if this is a potential tool command block
  // Pattern: MODEL section with **Tool Command**: followed by ```json
  if (line.includes('**Tool Command**:') || line.includes('**Tool Response**:')) {
    let isToolBlock = false;
    let blockType = '';

    // Look ahead to see if next non-empty line is ```json
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') {
      j++;
    }

    if (j < lines.length && lines[j].trim() === '```json') {
      // Found a json block, check if it's a tool call
      let jsonStart = j;
      let jsonEnd = j + 1;

      // Find the end of the json block
      while (jsonEnd < lines.length && lines[jsonEnd].trim() !== '```') {
        jsonEnd++;
      }

      if (jsonEnd < lines.length) {
        // Extract and parse JSON
        const jsonLines = lines.slice(jsonStart + 1, jsonEnd);
        const jsonText = jsonLines.join('\n');

        try {
          const jsonObj = JSON.parse(jsonText);

          // Check if it's a tool command (has "name" and "args")
          if (jsonObj.name && jsonObj.args) {
            isToolBlock = true;
            blockType = 'command';
            toolCommandsRemoved++;
          }
          // Check if it's a tool response (has "id", "name", and "response")
          else if (jsonObj.id && jsonObj.name && jsonObj.response) {
            isToolBlock = true;
            blockType = 'response';
            toolResponsesRemoved++;
          }
        } catch (e) {
          // Not valid JSON or not a tool block, keep it
        }

        if (isToolBlock) {
          // Skip this entire block including the header line, json block, and closing ```
          // Also skip any empty lines before the next section marker
          i = jsonEnd + 1;

          // Skip empty lines and separator
          while (i < lines.length && (lines[i].trim() === '' || lines[i].trim() === '---')) {
            i++;
          }

          // Don't add this block to output
          continue;
        }
      }
    }
  }

  // Not a tool block, keep the line
  output.push(line);
  i++;
}

// Write output
const outputContent = output.join('\n');
fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf8');

console.log(`\nProcessing complete:`);
console.log(`- Tool commands removed: ${toolCommandsRemoved}`);
console.log(`- Tool responses removed: ${toolResponsesRemoved}`);
console.log(`- Original lines: ${lines.length}`);
console.log(`- Output lines: ${output.length}`);
console.log(`- Lines removed: ${lines.length - output.length}`);
console.log(`\nNew file created: ${OUTPUT_FILE}`);
console.log(`Original file unchanged: ${INPUT_FILE}`);
