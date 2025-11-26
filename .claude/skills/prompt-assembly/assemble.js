#!/usr/bin/env node

/**
 * Prompt Assembly Script
 *
 * Assembles coder and verifier prompts from templates and parts.
 *
 * Usage:
 *   node assemble.js --config config.json
 *   node assemble.js --interactive
 *
 * Config JSON format:
 * {
 *   "project": "01-api",
 *   "jobName": "thinking-support",
 *   "jobOverview": "Add thinking event support to the reducer",
 *   "stateSummary": "Core pipeline working. Tests at 70% passing.",
 *   "techSpec": "...",
 *   "keyFiles": ["src/core/reducer.ts", "src/core/schema.ts"],
 *   "dodItems": ["Thinking events accumulate correctly", "UI displays thinking"],
 *   "projectWhy": "Optional: why we need this work",
 *   "knownIssues": "Optional: known issues",
 *   "avoidances": ["Optional: things to avoid"]
 * }
 */

const fs = require('fs');
const path = require('path');

// Simple Handlebars-like template engine
function compile(template, data, partials = {}) {
  let result = template;

  // Handle partials {{> partialName}}
  result = result.replace(/\{\{>\s*(\w[\w-]*)\s*\}\}/g, (match, name) => {
    return partials[name] || `<!-- Missing partial: ${name} -->`;
  });

  // Handle conditionals {{#if field}}...{{else}}...{{/if}} and {{#if field}}...{{/if}}
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, field, content) => {
    const parts = content.split('{{else}}');
    const ifContent = parts[0];
    const elseContent = parts[1] || '';
    return data[field] ? ifContent : elseContent;
  });

  // Handle unless {{#unless field}}...{{/unless}}
  result = result.replace(/\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (match, field, content) => {
    return !data[field] || (Array.isArray(data[field]) && data[field].length === 0) ? content : '';
  });

  // Handle each {{#each field}}...{{/each}}
  result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, field, content) => {
    const arr = data[field];
    if (!Array.isArray(arr)) return '';
    return arr.map(item => {
      return content.replace(/\{\{this\}\}/g, item);
    }).join('\n');
  });

  // Handle simple variables {{field}}
  result = result.replace(/\{\{(\w+)\}\}/g, (match, field) => {
    return data[field] !== undefined ? data[field] : '';
  });

  return result;
}

function loadPartials(partsDir) {
  const partials = {};
  const files = fs.readdirSync(partsDir);

  for (const file of files) {
    if (file.endsWith('.md')) {
      const name = file.replace('.md', '');
      const content = fs.readFileSync(path.join(partsDir, file), 'utf8');
      partials[name] = content;
    }
  }

  return partials;
}

function assemble(config) {
  const skillDir = __dirname;
  const templatesDir = path.join(skillDir, 'templates');
  const partsDir = path.join(skillDir, 'parts');
  const projectsDir = path.join(skillDir, '..', '..', '..', 'projects');

  // Load partials
  const partials = loadPartials(partsDir);

  // Add date to config
  config.date = new Date().toISOString().split('T')[0];

  // Load and compile coder template
  const coderTemplate = fs.readFileSync(path.join(templatesDir, 'coder-prompt.hbs'), 'utf8');
  const coderPrompt = compile(coderTemplate, config, partials);

  // Load and compile verifier template
  const verifierTemplate = fs.readFileSync(path.join(templatesDir, 'verifier-prompt.hbs'), 'utf8');
  const verifierPrompt = compile(verifierTemplate, config, partials);

  // Ensure output directory exists
  const outputDir = path.join(projectsDir, config.project, 'prompts');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output files
  const coderPath = path.join(outputDir, `${config.jobName}-coder.md`);
  const verifierPath = path.join(outputDir, `${config.jobName}-verifier.md`);

  fs.writeFileSync(coderPath, coderPrompt);
  fs.writeFileSync(verifierPath, verifierPrompt);

  console.log(`✓ Coder prompt: ${coderPath}`);
  console.log(`✓ Verifier prompt: ${verifierPath}`);

  return { coderPath, verifierPath };
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--config')) {
    const configIndex = args.indexOf('--config');
    const configPath = args[configIndex + 1];

    if (!configPath) {
      console.error('Error: --config requires a path argument');
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assemble(config);
  } else {
    console.log('Usage: node assemble.js --config config.json');
    console.log('');
    console.log('Config JSON format:');
    console.log(JSON.stringify({
      project: '01-api',
      jobName: 'example-job',
      jobOverview: 'What this work accomplishes',
      stateSummary: 'Current state of the system',
      techSpec: 'Technical specification...',
      keyFiles: ['src/file1.ts', 'src/file2.ts'],
      dodItems: ['Job-specific DoD item 1', 'Job-specific DoD item 2'],
      projectWhy: 'Optional: why we need this work',
      knownIssues: 'Optional: known issues',
      avoidances: ['Optional: things to avoid']
    }, null, 2));
  }
}

module.exports = { assemble, compile };
