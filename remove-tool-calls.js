#!/usr/bin/env node
/**
 * Removes Claude Code tool calls from conversation transcript files.
 *
 * Tool calls have these patterns:
 * - ⏺ ToolName(...) on a line, followed by ⎿ output lines
 * - ⏺ ToolName just announcing a tool
 * - Lines starting with ⎿ are tool output
 * - Lines with "… +N lines (ctrl+o to expand)" are truncated output indicators
 *
 * Usage: node remove-tool-calls.js <input-file> [output-file]
 */

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const outputFile = process.argv[3] || inputFile.replace(/(\.[^.]+)?$/, '-no-tools$1');

if (!inputFile) {
  console.error('Usage: node remove-tool-calls.js <input-file> [output-file]');
  process.exit(1);
}

const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n');

// All known tool names
const toolNames = [
  'Bash', 'Read', 'Write', 'Update', 'Glob', 'Grep', 'Task', 'Edit',
  'WebFetch', 'WebSearch', 'Web Search', 'TodoWrite', 'NotebookEdit',
  'AskUserQuestion', 'Skill', 'SlashCommand', 'EnterPlanMode', 'ExitPlanMode',
  'BashOutput', 'KillShell'
].join('|');

// Tool call patterns
const toolCallPattern = new RegExp(`^⏺\\s*(${toolNames})\\s*\\(`);
const toolStartPattern = new RegExp(`^⏺\\s*(${toolNames})`);
const toolOutputPattern = /^\s*⎿/;
const expandIndicatorPattern = /…\s*\+\d+\s+lines?\s*\(ctrl\+o\s+to\s+expand\)/;

// Also match lines that are just the command being echoed (common in bash output context)
const bashCommandEchoPattern = /^(cd |ls |cat |grep |find |rm |mv |mkdir |bun |npm |pnpm |git )/;

const outputLines = [];
let inToolBlock = false;
let skipUntilNonToolOutput = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Check if this is a tool call start
  if (toolCallPattern.test(line) || toolStartPattern.test(line)) {
    inToolBlock = true;
    skipUntilNonToolOutput = true;
    continue;
  }

  // Check if this is tool output
  if (toolOutputPattern.test(line)) {
    // This is tool output, skip it
    continue;
  }

  // Check for expand indicator
  if (expandIndicatorPattern.test(line)) {
    continue;
  }

  // If we were skipping tool output, check if we should stop
  if (skipUntilNonToolOutput) {
    // If this looks like continued tool output (indented, starts with typical output patterns)
    // but doesn't have ⎿, it might still be part of the tool block
    const trimmed = line.trim();

    // Empty lines within a tool block - skip
    if (trimmed === '') {
      continue;
    }

    // Lines that look like bash output (file listings, command output)
    if (/^\s{2,}/.test(line) && (
      /^[-drwx]/.test(trimmed) ||  // ls -la output
      /^\+\d+\s+lines/.test(trimmed) ||  // +N lines indicator
      /^total\s+\d+/.test(trimmed)  // ls total line
    )) {
      continue;
    }

    // Once we hit a non-tool line, stop skipping
    skipUntilNonToolOutput = false;
    inToolBlock = false;
  }

  // Keep this line
  outputLines.push(line);
}

// Write output
const output = outputLines.join('\n');
fs.writeFileSync(outputFile, output);

console.log(`Processed ${inputFile}`);
console.log(`Input: ${lines.length} lines`);
console.log(`Output: ${outputLines.length} lines (${lines.length - outputLines.length} lines removed)`);
console.log(`Written to: ${outputFile}`);
