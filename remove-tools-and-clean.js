#!/usr/bin/env node

/**
 * Remove tool calls AND clean up empty MODEL/USER sections
 */

const fs = require('fs');

const INPUT_FILE = '/Users/leemoore/code/codex-port-02/gemini-export.md';
const OUTPUT_FILE = '/Users/leemoore/code/codex-port-02/gemini-export-no-tools.md';

console.log(`Reading from: ${INPUT_FILE}`);
console.log(`Writing to: ${OUTPUT_FILE}`);

const content = fs.readFileSync(INPUT_FILE, 'utf8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);

const output = [];
let i = 0;
let toolCommandsRemoved = 0;
let toolResponsesRemoved = 0;

while (i < lines.length) {
  const line = lines[i];

  // Check if this is a potential tool block
  if (line.includes('**Tool Command**:') || line.includes('**Tool Response**:')) {
    let isToolBlock = false;
    let blockType = '';

    // Look ahead to see if next non-empty line is ```json
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') {
      j++;
    }

    if (j < lines.length && lines[j].trim() === '```json') {
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
          // Skip this entire block
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

// Now clean up empty MODEL/USER sections
const finalOutput = [];
let skipNextSeparator = false;

for (let i = 0; i < output.length; i++) {
  const line = output[i];
  const nextLine = i + 1 < output.length ? output[i + 1] : '';
  const lineAfterNext = i + 2 < output.length ? output[i + 2] : '';

  // Check for empty MODEL section: MODEL header followed immediately by USER or ---
  if (line === '✨ ## MODEL') {
    // Look ahead to see what comes next (skip empty lines)
    let lookAhead = i + 1;
    while (lookAhead < output.length && output[lookAhead].trim() === '') {
      lookAhead++;
    }

    if (lookAhead < output.length) {
      const nextContent = output[lookAhead];

      // If next content is USER or ---, this MODEL section is empty
      if (nextContent === '🧑‍💻 ## USER' || nextContent === '---') {
        // Skip this MODEL header and empty lines after it
        i = lookAhead - 1;
        skipNextSeparator = true;
        continue;
      }
    }
  }

  // Skip separator if we just removed an empty MODEL
  if (skipNextSeparator && line === '---') {
    skipNextSeparator = false;
    continue;
  }

  finalOutput.push(line);
}

// Write output
const outputContent = finalOutput.join('\n');
fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf8');

console.log(`\nProcessing complete:`);
console.log(`- Tool commands removed: ${toolCommandsRemoved}`);
console.log(`- Tool responses removed: ${toolResponsesRemoved}`);
console.log(`- Original lines: ${lines.length}`);
console.log(`- After tool removal: ${output.length}`);
console.log(`- Final lines: ${finalOutput.length}`);
console.log(`- Total lines removed: ${lines.length - finalOutput.length}`);
console.log(`\nNew file created: ${OUTPUT_FILE}`);
console.log(`Original file unchanged: ${INPUT_FILE}`);
