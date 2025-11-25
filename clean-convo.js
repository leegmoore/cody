#!/usr/bin/env bun
// Clean Claude Code conversation history by removing tool calls and results

import { readFileSync, writeFileSync } from 'fs';

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
  console.error('Usage: bun clean-convo.js <input-file> <output-file>');
  process.exit(1);
}

const content = readFileSync(inputFile, 'utf-8');
const lines = content.split('\n');

const cleaned = [];
let skipUntilNextSection = false;
let inToolResult = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  // Check if this is a tool invocation line
  // Pattern: ⏺ ToolName(...) or ⏺ ToolName
  const isToolCall = /^⏺\s+\w+\(/.test(trimmed);

  // Check if this is a tool result marker
  const isToolResult = /^⎿/.test(trimmed);

  // Check if this is an expandable section
  const isExpandable = /^…\s+\+\d+\s+lines/.test(trimmed);

  // Check if this is an assistant text response (starts with ⏺ but not a tool call)
  const isAssistantText = /^⏺\s+[^A-Z]/.test(trimmed) ||
                          /^⏺\s+[A-Z][a-z]/.test(trimmed) && !isToolCall;

  if (isToolCall) {
    // Skip tool call line
    skipUntilNextSection = true;
    continue;
  }

  if (isToolResult) {
    // Start skipping tool result and its indented content
    inToolResult = true;
    continue;
  }

  if (isExpandable) {
    // Skip expandable sections
    continue;
  }

  // If we're in a tool result, skip indented lines
  if (inToolResult) {
    // Check if line is indented (starts with spaces)
    if (/^\s{2,}/.test(line) || trimmed === '') {
      continue;
    } else {
      // We've exited the tool result block
      inToolResult = false;
    }
  }

  // If we skipped a tool call, check if we've moved to next section
  if (skipUntilNextSection) {
    // If this is a user message (>) or assistant text, stop skipping
    if (trimmed.startsWith('>') || isAssistantText || trimmed === '') {
      skipUntilNextSection = false;
    } else {
      continue;
    }
  }

  // Keep this line
  cleaned.push(line);
}

// Write cleaned output
const output = cleaned.join('\n');
writeFileSync(outputFile, output, 'utf-8');

console.log(`✓ Cleaned ${lines.length} lines → ${cleaned.length} lines`);
console.log(`✓ Removed ${lines.length - cleaned.length} lines of tool calls/results`);
console.log(`✓ Output written to: ${outputFile}`);
