# Technical & Coding Standards

## Infrastructure Rules

**NO MOCKING of infrastructure.** Tests use real:
- Redis (local)
- Convex (local)
- Workers

Only mock: External LLM API responses.

## Code Standards

- TypeScript strict mode
- Zod schemas for runtime validation
- Async/await (no raw promises)
- Error handling: throw typed errors, catch at boundaries

## Testing Standards

- Integration tests over unit tests
- Test at boundaries (API endpoints, workers)
- Exercise full pipeline where possible
- Mock only LLM responses

## Commit Standards

- Working states only (no broken commits)
- Clear commit messages
- Run full check suite before commit

## Anti-Patterns to Avoid

1. **No shims/adapters** - Integrate directly, no translation layers
2. **No scaffold corruption** - Don't modify test harness behavior to make tests pass
3. **No scope creep** - Do what's specified, note other improvements for later
4. **No convergent defaults** - Don't drift toward generic/minimal implementations
