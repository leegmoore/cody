# Phase 5: Authentication & CLI

## Overview

Phase 5 adds authentication (login flow, credential storage) and CLI interface with JSONL output.

## Goals

1. **Authentication** - Login flows for ChatGPT, API keys, OAuth
2. **Credential storage** - Secure keyring integration
3. **CLI interface** - Command-line entry point
4. **App server** - IDE integration server

## Modules to Port

### Authentication

1. **keyring-store** - Secure credential storage
2. **login** - Login flow orchestration
3. **core/auth** - AuthManager and auth integration

### CLI & Integration

4. **cli** - Command-line interface
5. **app-server** - IDE integration server
6. **app-server-protocol** - Server protocol types

### Utilities

7. **utils/git** - Git operations
8. **utils/image** - Image processing
9. **utils/pty** - Pseudo-terminal handling

## Porting Order

**Start with:**
1. keyring-store (credential storage)
2. login (login flows)
3. core/auth (auth manager)

**Then:**
4. cli (command-line interface)
5. app-server-protocol (protocol types)
6. app-server (IDE server)

**Finally:**
7. utils/git
8. utils/image
9. utils/pty

## Success Criteria

- [ ] Can login with ChatGPT
- [ ] Can login with API key
- [ ] Credentials stored securely
- [ ] CLI works for basic commands
- [ ] App server can communicate with IDE
- [ ] 100% test pass rate
