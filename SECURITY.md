# Security

This document describes Jot's security model and how to report vulnerabilities.

## Architecture Overview

Jot consists of two components:

1. **Chrome Extension** - Runs in the browser, captures page metadata and user comments
2. **Native Host** (Swift) - Runs locally, reads/writes markdown files to your vault

These communicate via Chrome's [Native Messaging API](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging), which provides OS-level process isolation.

## Threat Model

### What the extension CAN do (if compromised)

- Read all saved bookmarks/comments in your vault
- Write new entries to your vault
- Delete entries from your vault
- Create `bookmarks.md` and `.jot-meta.json` files in directories under `~/`

### What the extension CANNOT do

- **Execute arbitrary code** - The native host has no shell/exec capability
- **Read arbitrary files** - Only files named `bookmarks.md` and `.jot-meta.json` can be read
- **Write arbitrary filenames** - Filenames are hardcoded, not user-controllable
- **Access files outside home directory** - Vault path must be under `~/`
- **Transmit data over the network** - All data stays local

### Security Boundaries

| Boundary | Enforcement |
|----------|-------------|
| Extension-to-host communication | Browser-enforced origin check (extension ID whitelist) |
| Vault path location | Must be within `~/` (home directory) |
| Filenames | Hardcoded to `bookmarks.md` and `.jot-meta.json` |
| Folder names | Alphanumeric, spaces, hyphens, underscores only (max 100 chars) |
| Comment length | Maximum 50,000 characters |

### Input Validation

The native host validates:

- **Vault path**: No `..` allowed, symlinks resolved, must be under home directory
- **Folder names**: Whitelist of allowed characters, length limit, no path traversal
- **Comment body**: Length limit to prevent resource exhaustion

## Data Storage

All data is stored locally:

- **Config**: `~/.jot/config.json` (vault path setting)
- **Bookmarks**: `${vaultPath}/${commentFolder}/bookmarks.md`
- **Metadata**: `${vaultPath}/${commentFolder}/.jot-meta.json`

No data is transmitted to external servers. No analytics or telemetry.

## Reporting Vulnerabilities

If you discover a security vulnerability, please DM [@axmont](https://x.com/axmont) on X.
