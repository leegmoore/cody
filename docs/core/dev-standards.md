# Development Standards

This document defines code quality standards, tooling choices, and development practices for the Codex TypeScript port.

---

## Tooling Standards

### Package Manager
**Use:** `npm` (not pnpm, yarn, or bun)

**Rationale:** Consistency across team, simpler CI/CD, wider compatibility

**Commands:**
```bash
npm install          # Install dependencies
npm test            # Run tests
npm run build       # TypeScript compilation
```

---

### TypeScript Configuration

**Compiler:** TypeScript 5.x with strict mode

**Key Settings:**
- `strict: true` - All strict checks enabled
- `noImplicitAny: true` - No implicit any types
- `strictNullChecks: true` - Null safety
- `esModuleInterop: true` - ESM compatibility
- `target: "ES2022"` - Modern JavaScript features
- `module: "ESNext"` - Native ES modules

**No `any` Types:**
- Use `unknown` if type is truly unknown
- Use proper types or discriminated unions
- Use type assertions only when necessary and safe

---

### Code Formatting

**Tool:** Prettier (automated, non-negotiable)

**Configuration:**
- Single quotes
- 100 character line width
- 2 space indentation
- Trailing commas where valid
- No semicolons (ASI)

**Commands:**
```bash
npm run format      # Auto-format all code
npm run format:check # Check formatting
```

**Rule:** Prettier handles ALL formatting. Do not argue with Prettier.

---

### Code Quality

**Tool:** ESLint (code quality ONLY, not formatting)

**Purpose:**
- Catch bugs and anti-patterns
- Enforce best practices
- TypeScript-specific checks
- No formatting rules (Prettier handles that)

**Required:** Code must pass ESLint before commit

**Commands:**
```bash
npm run lint        # Check code quality
npm run lint:fix    # Auto-fix issues
```

**TODO:** Add .eslintrc.json configuration (see KNOWN_BUGS.md #2)

---

### Testing Framework

**Tool:** Vitest (fast, ESM-native, Vite-powered)

**Why Vitest:**
- Fast execution (parallel, watch mode)
- Native ESM support
- TypeScript support built-in
- Jest-compatible API
- Better developer experience

**Standards:**
- Every module has `.test.ts` file
- Test-driven development preferred
- 100% pass rate maintained
- Tests run in CI/CD

**Commands:**
```bash
npm test            # Run all tests
npm test -- watch   # Watch mode
npm test -- run [file] # Run specific test
```

---

## Code Standards

### Module System

**Use:** ES Modules (ESM)

**Format:**
```typescript
// Import
import { foo } from './module'
import type { FooType } from './types'

// Export
export function bar() { }
export type { BarType }
```

**No CommonJS:**
- No `require()`
- No `module.exports`
- Use `import` and `export` only

---

### Type Safety

**Strict TypeScript:**
```typescript
// ✅ Good
function process(data: string | undefined): Result {
  if (!data) throw new Error('Missing data')
  return { ok: true, value: data }
}

// ❌ Bad - implicit any
function process(data) {
  return data
}

// ❌ Bad - explicit any
function process(data: any): any {
  return data
}
```

**Discriminated Unions:**
```typescript
// ✅ Prefer discriminated unions for variants
type Result =
  | { type: 'success', value: string }
  | { type: 'error', error: Error }

// ❌ Avoid complex conditionals
type Result = {
  success?: boolean
  value?: string
  error?: Error
}
```

---

### Naming Conventions

**Functions:** camelCase, descriptive verbs
```typescript
function parseConfig() { }
function createConversation() { }
async function loadHistory() { }
```

**Classes:** PascalCase, nouns
```typescript
class ConversationManager { }
class ModelClient { }
```

**Interfaces/Types:** PascalCase
```typescript
interface UserInput { }
type TurnItem = ...
```

**Constants:** UPPER_SNAKE_CASE for globals
```typescript
const MAX_RETRIES = 3
const DEFAULT_TIMEOUT = 5000
```

**Private Members:** Prefix with underscore
```typescript
class Foo {
  private _internalState: string

  public getData() {
    return this._internalState
  }
}
```

**No Abbreviations:**
```typescript
// ✅ Good
function getUserConfiguration() { }

// ❌ Bad
function getUserCfg() { }
function getUsrCfg() { }
```

---

### Documentation

**JSDoc for Public APIs:**
```typescript
/**
 * Creates a new conversation with the specified configuration.
 *
 * @param config - Conversation configuration options
 * @returns A new Conversation instance
 * @throws {ConfigError} If configuration is invalid
 */
export function createConversation(config: Config): Conversation {
  // ...
}
```

**Inline Comments:**
- Explain *why*, not *what*
- Complex algorithms need explanation
- Rust porting notes where helpful

```typescript
// Calculate nearest color in 256-color palette
// Uses Euclidean distance in RGB space (matching Rust implementation)
const nearest = findNearestColor(rgb, palette)
```

---

### Error Handling

**Prefer Throwing:**
```typescript
// ✅ Good - clear error types
if (!data) {
  throw new ConfigError('Missing required field: data')
}

// ❌ Bad - silent failures
if (!data) return undefined
```

**Custom Error Classes:**
```typescript
export class CodexError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CodexError'
  }
}

export class ConfigError extends CodexError {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}
```

---

### Async/Await

**Always use async/await** (not raw Promises)

```typescript
// ✅ Good
async function loadData(): Promise<Data> {
  const response = await fetch(url)
  return await response.json()
}

// ❌ Bad
function loadData(): Promise<Data> {
  return fetch(url)
    .then(r => r.json())
}
```

---

## Rust → TypeScript Patterns

### Option<T>
```typescript
// Rust: Option<T>
// TypeScript: T | undefined
function find(id: string): User | undefined {
  return users.get(id)
}

// Usage with optional chaining
const name = find('123')?.name
const nameOrDefault = find('123')?.name ?? 'Unknown'
```

### Result<T, E>
```typescript
// Rust: Result<T, E>
// TypeScript: Throw errors or use union types

// Option 1: Throw (preferred for most cases)
function parse(input: string): Config {
  if (!validate(input)) {
    throw new ParseError('Invalid input')
  }
  return config
}

// Option 2: Union type (for expected errors)
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E }

function tryParse(input: string): Result<Config, ParseError> {
  if (!validate(input)) {
    return { ok: false, error: new ParseError('Invalid') }
  }
  return { ok: true, value: config }
}
```

### Vec<T> and HashMap<K, V>
```typescript
// Rust: Vec<T>
// TypeScript: T[]
const items: User[] = []

// Rust: HashMap<K, V>
// TypeScript: Map<K, V> or Record<string, V>
const cache = new Map<string, Value>()
const config: Record<string, string> = {}
```

---

## Git Commit Standards

**Format:**
```
type(scope): brief description

Detailed explanation if needed

🤖 Generated with Claude Code
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `test:` Tests
- `refactor:` Code refactoring
- `chore:` Maintenance

**Examples:**
```bash
git commit -m "feat(protocol): port protocol/items module with 41 tests"
git commit -m "fix(cache): resolve TypeScript generic constraint error"
git commit -m "docs: add development standards guide"
```

---

## CI/CD Requirements

**All PRs must pass:**
1. `npm test` - All tests passing
2. `npm run build` - TypeScript compilation (once ESLint added)
3. `npm run lint` - ESLint checks (once configured)
4. `npm run format:check` - Prettier formatting

**Branch naming:**
- `claude/port-[module]-[session-id]`
- `claude/fix-[issue]-[session-id]`

---

## Development Workflow

### Starting Work
```bash
cd codex-ts
npm install          # First time only
npm test            # Verify baseline
```

### During Development
```bash
npm test -- watch   # Run tests in watch mode
# Write code, save, tests auto-run
```

### Before Commit
```bash
npm run format      # Auto-format code
npm test           # Verify all tests pass
npm run build      # Check TypeScript compilation
# npm run lint      # TODO: Add when ESLint configured
git add -A
git commit -m "feat(module): description"
git push
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Run tests | `npm test` |
| Watch tests | `npm test -- watch` |
| Build | `npm run build` |
| Format code | `npm run format` |
| Check format | `npm run format:check` |
| Lint (TODO) | `npm run lint` |
| Type check | `npx tsc --noEmit` |

---

**Last Updated:** 2025-11-05
**Maintainer:** Codex Port Team
