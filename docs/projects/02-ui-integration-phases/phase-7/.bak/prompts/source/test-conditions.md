# Phase 7: Test Conditions

Because Phase 7 is polish, tests are mostly regression checks:

1. **CLI Snapshot Tests** – run scripted sessions and capture stdout; ensure formatting matches expectations.
2. **Error Scenarios** – intentionally break config/auth and confirm messages include remediation hints.
3. **Performance** – script measuring CLI startup time (<500ms) and response latency (<100ms overhead).
4. **Documentation lints** – run markdown lint / link checker.
