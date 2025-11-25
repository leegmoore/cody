# Definition of Done

All checks must pass. Run sequentially. If any fail, fix and re-run all until clean.

## Check Sequence

```bash
# 1. Tests
bun test

# 2. Format
bun run format

# 3. Lint
bun run lint

# 4. Typecheck
bun run typecheck
```

## Loop Until Clean

```
Run tests → if fail → fix → restart from tests
Run format → if changes → restart from tests
Run lint → if fail → fix → restart from tests
Run typecheck → if fail → fix → restart from tests
All pass → Done
```

## Additional Checks (if specified)

- Specific test file(s) must pass: [specify in job]
- Manual verification: [specify in job]
- Integration point works: [specify in job]
