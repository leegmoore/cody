#!/usr/bin/env node
/**
 * Prompt Assembly Script
 *
 * Assembles coder and verifier prompts from reusable artifacts.
 *
 * Usage:
 *   node scripts/assemble-prompt.js --phase 1 --type coder
 *   node scripts/assemble-prompt.js --phase 1 --type verifier
 */

const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
const phaseArg = args.find(a => a.startsWith('--phase'));
const typeArg = args.find(a => a.startsWith('--type'));

if (!phaseArg || !typeArg) {
  console.error('Usage: node assemble-prompt.js --phase <N> --type <coder|verifier>');
  process.exit(1);
}

const phaseNum = phaseArg.split('=')[1] || args[args.indexOf(phaseArg) + 1];
const promptType = typeArg.split('=')[1] || args[args.indexOf(typeArg) + 1];

const basePath = path.join(__dirname, '..');
const phasePath = path.join(basePath, `phase-${phaseNum}`);
const sourceDir = path.join(phasePath, 'source');
const promptsDir = path.join(phasePath, 'prompts');

function readArtifact(relativePath) {
  const fullPath = path.join(basePath, relativePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`Warning: ${relativePath} not found, skipping`);
    return '';
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function assembleCoderPrompt(phaseNum) {
  const sections = [];

  sections.push(`===== PHASE ${phaseNum}: CODER PROMPT =====\n`);
  sections.push(readArtifact('artifacts/templates/role-coder.txt'));
  sections.push('\n\n---\n\nPRODUCT:\n\n');
  sections.push(readArtifact('artifacts/global/product-summary.md'));
  sections.push('\n\n---\n\nPROJECT CONTEXT:\n\n');
  sections.push(readArtifact('artifacts/global/project-context.md'));
  sections.push('\n\n---\n\nPHASE ' + phaseNum + ' TECHNICAL DESIGN:\n\n');
  sections.push(readArtifact(`phase-${phaseNum}/source/design.md`));
  sections.push('\n\n---\n\nTEST CONDITIONS:\n\n');
  sections.push(readArtifact(`phase-${phaseNum}/source/test-conditions.md`));
  sections.push('\n\n---\n\nTASKS (update source/checklist.md as you work):\n\n');
  sections.push(readArtifact(`phase-${phaseNum}/source/checklist.md`));
  sections.push('\n\n---\n\nSTANDARDS:\n\n');
  sections.push('See docs/core/dev-standards.md for complete coding standards.\n');
  sections.push('See docs/core/contract-testing-tdd-philosophy.md for testing approach.\n\n');
  sections.push('Key requirements:\n');
  sections.push('- TypeScript strict mode, no any types\n');
  sections.push('- ESLint 0 errors\n');
  sections.push('- Prettier formatted\n');
  sections.push('- Mocked-service tests at library boundaries\n');
  sections.push('- Mock all external dependencies\n');
  sections.push('\n\n---\n\nEXECUTION WORKFLOW:\n\n');
  sections.push(readArtifact('artifacts/templates/coder-workflow.txt'));
  sections.push('\n\n---\n\nMANUAL VERIFICATION:\n\n');
  sections.push(readArtifact(`phase-${phaseNum}/source/manual-test-script.md`));
  sections.push('\n\n---\n\nFINAL QUALITY CHECK:\n\n');
  sections.push('Before declaring phase complete:\n\n');
  sections.push('Run: npm run format && npm run lint && npx tsc --noEmit && npm test\n\n');
  sections.push('ALL must pass. Document results.\n');
  sections.push('Update checklist.md and decisions.md.\n');
  sections.push('Commit and push.\n');
  sections.push('Ready for verification stages.\n\n');
  sections.push('===== END CODER PROMPT =====\n');

  return sections.join('');
}

function assembleVerifierPrompt(phaseNum) {
  const sections = [];

  sections.push(`===== PHASE ${phaseNum}: QUALITY VERIFIER PROMPT =====\n`);
  sections.push(readArtifact('artifacts/templates/role-verifier.txt'));
  sections.push('\n\n---\n\nVERIFICATION TASKS:\n\n');
  sections.push('1. Run quality checks in sequence:\n\n');
  sections.push('   npx tsc --noEmit     → 0 errors\n');
  sections.push('   npm run lint         → 0 errors\n');
  sections.push('   npm run format       → no changes\n');
  sections.push('   npm test             → all pass, 0 skip\n\n');
  sections.push(`2. Read phase-${phaseNum}/source/checklist.md → all checked?\n`);
  sections.push(`3. Read phase-${phaseNum}/decisions.md → reasonable?\n`);
  sections.push('4. Verify files from checklist exist\n\n');
  sections.push('---\n\nOUTPUT FORMAT:\n\n');
  sections.push('**QUALITY VERIFICATION REPORT**\n\n');
  sections.push(`Phase: ${phaseNum}\n`);
  sections.push('Status: PASS / FAIL\n\n');
  sections.push('Checks:\n');
  sections.push('- TypeScript: [PASS/FAIL]\n');
  sections.push('- ESLint: [PASS/FAIL]\n');
  sections.push('- Format: [PASS/FAIL]\n');
  sections.push('- Tests: [PASS/FAIL]\n');
  sections.push('- Checklist: [complete/incomplete]\n');
  sections.push('- Decisions: [reviewed]\n\n');
  sections.push('Issues: [list with file:line]\n\n');
  sections.push('Recommendation: PASS → code review / FAIL → return to coder\n\n');
  sections.push('===== END QUALITY VERIFICATION =====\n');

  return sections.join('');
}

// Generate prompt
let prompt;
if (promptType === 'coder') {
  prompt = assembleCoderPrompt(phaseNum);
} else if (promptType === 'verifier') {
  prompt = assembleVerifierPrompt(phaseNum);
} else {
  console.error('Invalid type. Use: coder or verifier');
  process.exit(1);
}

// Ensure prompts directory exists
if (!fs.existsSync(promptsDir)) {
  fs.mkdirSync(promptsDir, {recursive: true});
}

// Write to prompts directory
const outputPath = path.join(promptsDir, `${promptType.toUpperCase()}.txt`);
fs.writeFileSync(outputPath, prompt, 'utf8');

console.log(`✓ Generated: ${outputPath}`);
console.log(`  Length: ${prompt.length} characters (~${Math.round(prompt.length/4)} tokens)`);
