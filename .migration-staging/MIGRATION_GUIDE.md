# Tool Migration Guide - codex-port to codex-ts

## Overview

This guide provides step-by-step instructions for migrating 4 tools from the previous codex-port project into the current codex-ts port.

**Source:** `.migration-staging/tools-from-codex-port/`
**Destination:** `codex-ts/src/tools/`

---

## Dependencies Required

**Install these packages:**
```bash
cd codex-ts
npm install web-tree-sitter @vscode/tree-sitter-wasm
```

**Why:**
- `web-tree-sitter`: Tree-sitter WASM runtime for applyPatch
- `@vscode/tree-sitter-wasm`: Bash grammar for heredoc parsing

---

## Key Differences to Address

### 1. Import Paths (ESM)

**codex-port (CommonJS-style):**
```typescript
import { seekSequence } from "./seekSequence";
import { ToolResult } from "./types";
```

**codex-ts (ESM with .js):**
```typescript
import { seekSequence } from './seek-sequence.js';
import type { ToolResult } from './types.js';
```

**Rules:**
- Add `.js` extension to ALL relative imports
- Use kebab-case for file names (seekSequence → seek-sequence)
- Use `type` imports for types-only

### 2. Runtime Differences (Bun → Node.js)

**codex-port uses Bun:**
```typescript
import { spawn } from "bun";  // Bun's spawn

const subprocess = spawn({
  cmd: ['rg', pattern],
  stdout: "pipe"
});
```

**codex-ts uses Node.js:**
```typescript
import { spawn } from 'node:child_process';

const subprocess = spawn('rg', [pattern], {
  stdio: ['ignore', 'pipe', 'pipe']
});
```

**Conversion:**
- `spawn({ cmd: [prog, ...args] })` → `spawn(prog, args, options)`
- `subprocess.stdout` (ReadableStream) → `subprocess.stdout` (Stream)
- `subprocess.exited` → listen to 'exit' event

### 3. ToolResult Type

**codex-port ToolResult:**
```typescript
interface ToolResult {
  content: string;
  success: boolean;
}
```

**Our tools DON'T use this!** We return structured types:

**applyPatch returns:**
```typescript
interface AffectedPaths {
  added: string[];
  modified: string[];
  deleted: string[];
}
```

**exec returns:**
```typescript
interface ExecToolCallOutput {
  exitCode: number;
  stdout: StreamOutput<Buffer>;
  stderr: StreamOutput<Buffer>;
  aggregatedOutput: StreamOutput<Buffer>;
  timedOut: boolean;
}
```

**For migration:** Convert their `ToolResult` returns to match our structured types OR create adapter.

### 4. Test Framework

**codex-port tests:**
- Use Bun's test runner
- Import from "bun:test"

**codex-ts tests:**
- Use Vitest
- Import from 'vitest'

**Conversion:**
```typescript
// codex-port
import { test, expect } from "bun:test";

// codex-ts
import { describe, test, expect } from 'vitest';
```

---

## Migration Steps by Tool

### applyPatch (REPLACE)

**Files to copy:**
- applyPatch/applyPatch.ts
- applyPatch/parser.ts
- applyPatch/seekSequence.ts
- applyPatch.test.ts

**Steps:**

1. **Backup current:**
```bash
mv codex-ts/src/apply-patch codex-ts/.archive/apply-patch-old
```

2. **Copy files:**
```bash
cp -r .migration-staging/tools-from-codex-port/applyPatch codex-ts/src/tools/apply-patch
```

3. **Update imports in each file:**

**In applyPatch.ts:**
```typescript
// Change
import { seekSequence } from "./seekSequence";
// To
import { seekSequence } from './seek-sequence.js';

// Change
import { createRequire } from "node:module";
// To (already correct)
import { createRequire } from 'node:module';
```

**In parser.ts:**
```typescript
// All .ts imports become .js
```

4. **Return type:**
Their applyPatch returns `ApplyPatchResult`:
```typescript
interface ApplyPatchResult {
  success: boolean;
  stdout: string;
  stderr: string;
}
```

Our code expects `AffectedPaths`.

**Solution:** Change return type OR create wrapper:
```typescript
export function applyPatch(patch: string): AffectedPaths {
  const result = applyPatchInternal(patch);  // Their code
  // Convert to our format
  return extractAffectedPaths(result);
}
```

5. **Install dependency:**
```bash
npm install web-tree-sitter @vscode/tree-sitter-wasm
```

6. **Tests:**
Copy applyPatch.test.ts, update:
- `import from "bun:test"` → `import from 'vitest'`
- Test structure stays same
- Add `.js` to imports

---

### readFile (ADD NEW)

**Files:**
- readFile.ts
- readFile.test.ts
- types.ts (for reference)

**Steps:**

1. **Create directory:**
```bash
mkdir -p codex-ts/src/tools/read-file
```

2. **Copy file:**
```bash
cp .migration-staging/tools-from-codex-port/readFile.ts codex-ts/src/tools/read-file/index.ts
```

3. **Update imports:**
```typescript
// Change
import { ToolResult } from "./types";
// To
import type { ToolResult } from './types.js';
```

4. **Add types.ts:**
```bash
cp .migration-staging/tools-from-codex-port/types.ts codex-ts/src/tools/read-file/types.ts
```

Or integrate into our protocol (probably just keep their simple ToolResult locally).

5. **No Bun dependencies** - uses only Node.js `fs.promises`

6. **Tests:**
```bash
cp .migration-staging/tools-from-codex-port/readFile.test.ts codex-ts/src/tools/read-file/index.test.ts
```

Update test imports:
```typescript
// Change
import { test, expect, describe } from "bun:test";
import { readFile } from "./readFile";

// To
import { describe, test, expect } from 'vitest';
import { readFile } from './index.js';
```

---

### listDir (ADD NEW)

**Same pattern as readFile:**

1. Create `codex-ts/src/tools/list-dir/`
2. Copy listDir.ts → index.ts
3. Copy types.ts
4. Update imports (add .js)
5. Copy tests, update test framework imports
6. Run tests

**No Bun-specific code** - pure Node.js

---

### grepFiles (ADD NEW)

**Has Bun spawn - needs conversion:**

1. Create `codex-ts/src/tools/grep-files/`
2. Copy grepFiles.ts → index.ts
3. Copy types.ts

4. **Convert Bun spawn to Node.js:**

**Original (Bun):**
```typescript
import { spawn } from "bun";

subprocess = spawn({
  cmd: [command, ...args],
  cwd,
  stdout: "pipe",
  stderr: "pipe",
});

const [stdout, stderr] = await Promise.all([
  streamToString(subprocess.stdout),
  streamToString(subprocess.stderr),
]);
const exitCode = await subprocess.exited;
```

**Convert to (Node.js):**
```typescript
import { spawn } from 'node:child_process';

const subprocess = spawn(command, args, {
  cwd,
  stdio: ['ignore', 'pipe', 'pipe']
});

// Collect output
const stdoutChunks: Buffer[] = [];
const stderrChunks: Buffer[] = [];

subprocess.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
subprocess.stderr.on('data', (chunk) => stderrChunks.push(chunk));

const exitCode = await new Promise<number>((resolve) => {
  subprocess.on('exit', (code) => resolve(code ?? 1));
});

const stdout = Buffer.concat(stdoutChunks).toString('utf8');
const stderr = Buffer.concat(stderrChunks).toString('utf8');
```

5. **streamToString helper:**

Delete Bun version, use Buffer concatenation (shown above).

6. **Tests:** Copy, update imports

---

## Example: Our Current Tool Pattern

**Reference existing tools to match style:**

**Check:** `codex-ts/src/core/exec/engine.ts`
- Shows how we handle spawn
- Shows our error handling
- Shows our type patterns

**Check:** `codex-ts/src/file-search/search.ts`
- Shows our tool export pattern
- Shows our result types

---

## Checklist for Each Tool

For each tool (applyPatch, readFile, listDir, grepFiles):

✅ Copy source files to correct location
✅ Update ALL imports (add .js, kebab-case)
✅ Convert Bun → Node.js (if applicable)
✅ Update/adapt return types
✅ Copy test file
✅ Update test imports (bun:test → vitest)
✅ Run tests: `npm test -- [tool-name]`
✅ Fix any failures
✅ Verify 100% passing
✅ Commit: `git add -A && git commit -m "phase4.5: migrate [tool-name]"`

---

## Final Integration

**After all 4 tools migrated:**

1. **Create tool registry:**
```typescript
// codex-ts/src/tools/registry.ts

import { applyPatch } from './apply-patch/index.js';
import { executeCommand } from '../core/exec/engine.js';
import { searchFiles } from '../file-search/search.js';
import { readFile } from './read-file/index.js';
import { listDir } from './list-dir/index.js';
import { grepFiles } from './grep-files/index.js';

export const TOOL_REGISTRY = {
  applyPatch: {
    name: 'applyPatch',
    execute: applyPatch,
    requiresApproval: () => true,  // File modifications need approval
  },
  exec: {
    name: 'exec',
    execute: executeCommand,
    requiresApproval: (args) => true,  // Commands need approval
  },
  fileSearch: {
    name: 'fileSearch',
    execute: searchFiles,
    requiresApproval: () => false,
  },
  readFile: {
    name: 'readFile',
    execute: readFile,
    requiresApproval: () => false,
  },
  listDir: {
    name: 'listDir',
    execute: listDir,
    requiresApproval: () => false,
  },
  grepFiles: {
    name: 'grepFiles',
    execute: grepFiles,
    requiresApproval: () => false,
  },
};
```

2. **Wire to script harness:**
Update orchestrator to use registry when creating tool facade.

3. **Test all tools from script:**
```typescript
test('all tools callable from script', async () => {
  const script = `
    const patch = await tools.applyPatch({patch: "..."});
    const file = await tools.readFile({filePath: "test.txt"});
    const dir = await tools.listDir({dirPath: "."});
    const matches = await tools.grepFiles({pattern: "test"});
    const search = await tools.fileSearch({pattern: "*.ts"});
    const exec = await tools.exec({command: ["echo", "hi"]});
    return {allWork: true};
  `;

  const result = await executeScript(script);
  expect(result.returnValue.allWork).toBe(true);
});
```

---

## Common Issues & Solutions

**Issue 1: Import not found**
```
Error: Cannot find module './seekSequence'
```
**Solution:** Add .js extension: `'./seek-sequence.js'`

**Issue 2: Bun spawn not defined**
```
Error: spawn is not a function
```
**Solution:** Use Node.js spawn pattern (see grepFiles conversion above)

**Issue 3: ToolResult type mismatch**
```
Error: Type 'AffectedPaths' is not assignable to type 'ToolResult'
```
**Solution:** Either adapt their type or create wrapper function

**Issue 4: Test framework**
```
Error: Cannot find module 'bun:test'
```
**Solution:** Change to `import { describe, test, expect } from 'vitest'`

**Issue 5: web-tree-sitter not found**
```
Error: Cannot find module 'web-tree-sitter'
```
**Solution:** `npm install web-tree-sitter @vscode/tree-sitter-wasm`

---

## Success Criteria

Each tool is successfully migrated when:

✅ Source copied to correct location with correct file names
✅ All imports updated (. js extensions, correct paths)
✅ All Bun code converted to Node.js
✅ Tests copied and updated
✅ `npm test -- [tool-name]` passes 100%
✅ Tool callable from script harness
✅ No TypeScript errors
✅ Prettier formatted

---

**This guide ensures the agent has everything needed for successful migration.**
