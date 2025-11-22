#!/usr/bin/env node

/**
 * Remove tool calls AND all MODEL sections (thinking/responses)
 * Keep only USER sections
 */

const fs = require('fs');

const INPUT_FILE = '/Users/leemoore/code/codex-port-02/gemini-export.md';
const OUTPUT_FILE = '/Users/leemoore/code/codex-port-02/gemini-export-no-thinking.md';

console.log(`Reading from: ${INPUT_FILE}`);
console.log(`Writing to: ${OUTPUT_FILE}`);

const content = fs.readFileSync(INPUT_FILE, 'utf8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);

const output = [];
let i = 0;
let insideModel = false;
let modelSectionsRemoved = 0;

while (i < lines.length) {
  const line = lines[i];

  // Check if we're entering a MODEL section
  if (line === '✨ ## MODEL') {
    insideModel = true;
    modelSectionsRemoved++;
    i++;
    continue;
  }

  // Check if we're leaving MODEL section (entering USER or hitting separator after MODEL)
  if (insideModel) {
    if (line === '🧑‍💻 ## USER' || line === '---') {
      insideModel = false;
      // Don't skip the USER line, but skip the --- separator after MODEL
      if (line === '---') {
        i++;
        continue;
      }
    } else {
      // Still inside MODEL, skip this line
      i++;
      continue;
    }
  }

  // Not inside MODEL, keep the line
  output.push(line);
  i++;
}

// Write output
const outputContent = output.join('\n');
fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf8');

console.log(`\nProcessing complete:`);
console.log(`- MODEL sections removed: ${modelSectionsRemoved}`);
console.log(`- Original lines: ${lines.length}`);
console.log(`- Output lines: ${output.length}`);
console.log(`- Lines removed: ${lines.length - output.length}`);
console.log(`\nNew file created: ${OUTPUT_FILE}`);
console.log(`Original file unchanged: ${INPUT_FILE}`);
