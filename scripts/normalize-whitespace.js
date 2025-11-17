#!/usr/bin/env node

/**
 * Normalize Whitespace Script
 * 
 * This script performs two operations in order:
 * 1. Removes all trailing whitespace (spaces and tabs) from each line
 * 2. Collapses 3 or more consecutive blank lines to exactly 2 blank lines
 * 
 * Usage: node normalize-whitespace.js <input-file> [output-file]
 *   If output-file is omitted, changes are written back to input-file
 */

const fs = require('fs');
const path = require('path');

function normalizeWhitespace(content) {
  // Step 1: Remove trailing whitespace from each line
  let lines = content.split('\n');
  lines = lines.map(line => line.replace(/[ \t]+$/, ''));
  
  // Step 2: Collapse 3+ consecutive blank lines to 2
  const result = [];
  let consecutiveBlankLines = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line === '') {
      consecutiveBlankLines++;
      
      // Only add blank lines if we haven't exceeded our limit of 2
      if (consecutiveBlankLines <= 2) {
        result.push(line);
      }
    } else {
      consecutiveBlankLines = 0;
      result.push(line);
    }
  }
  
  return result.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Error: No input file specified');
    console.error('Usage: node normalize-whitespace.js <input-file> [output-file]');
    process.exit(1);
  }
  
  const inputFile = args[0];
  const outputFile = args[1] || inputFile;
  
  // Check if input file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file '${inputFile}' not found`);
    process.exit(1);
  }
  
  try {
    // Read the file
    console.log(`Reading: ${inputFile}`);
    const content = fs.readFileSync(inputFile, 'utf8');
    
    // Normalize whitespace
    console.log('Normalizing whitespace...');
    const normalized = normalizeWhitespace(content);
    
    // Write the result
    fs.writeFileSync(outputFile, normalized, 'utf8');
    console.log(`✓ Successfully written to: ${outputFile}`);
    
    // Report statistics
    const originalLines = content.split('\n').length;
    const normalizedLines = normalized.split('\n').length;
    const linesDiff = originalLines - normalizedLines;
    
    if (linesDiff > 0) {
      console.log(`✓ Removed ${linesDiff} excess blank line(s)`);
    }
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
