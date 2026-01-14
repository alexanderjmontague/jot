# Jot

```
     ╭──────────────────────────────╮
     │  ✏️  jot it down, move on.   │
     ╰──────────────────────────────╯
```

**Save thoughts on any webpage, straight to your Obsidian vault.**

No cloud. No account. Just your browser and your notes.

<!-- TODO: Add screenshot/gif here -->

---

## What is this?

Ever read something online and want to jot down a quick thought? Jot lets you do exactly that — click the icon, type your comment, and it's saved as a markdown file in your Obsidian vault.

Your notes stay local. The extension talks directly to your filesystem through a tiny helper app (no servers, no sync, no BS).

## Quick Start

### 1. Install the extension

```bash
git clone https://github.com/alexanderjmontague/jot.git
cd jot
pnpm install && pnpm build
```

Then in Chrome (or any Chromium browser):
- Go to `chrome://extensions`
- Enable **Developer mode** (top right)
- Click **Load unpacked** → select the `.output/chrome-mv3` folder

### 2. Install the native helper

This is what lets the extension read/write files on your machine. Requires Xcode (for Swift).

```bash
cd native-host-swift
./install.sh
```

This auto-detects your installed browsers (Chrome, Arc, Brave, Edge, etc.) and sets up the helper for all of them.

### 3. Point it at your vault

Click the Jot icon in Chrome, paste your Obsidian vault path, done.

Your comments will live in a `Jot/` folder inside your vault.

---

## How it works

```
Chrome Extension  ←→  Native Helper  ←→  Obsidian Vault
                      (local only)        ~/Vault/Jot/*.md
```

Each page you comment on gets its own markdown file:

```markdown
---
url: "https://example.com/article"
title: "Some Article"
created_at: 2025-01-10T14:30:00.000Z
---

## Comments

### 2025-01-10 14:30
This is a really interesting point about...
```

---

## Development

```bash
pnpm install
pnpm dev
```

Load the extension from `.output/chrome-mv3` in Chrome.

---

## Uninstall

To fully remove the native helper:

```bash
# Remove the binary
sudo rm /usr/local/bin/jot-host

# Remove browser manifests (for whichever browsers you have)
rm ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.jot.host.json
rm ~/Library/Application\ Support/Arc/User\ Data/NativeMessagingHosts/com.jot.host.json
rm ~/Library/Application\ Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/com.jot.host.json
# ... etc for other browsers

# Remove config
rm -rf ~/.jot
```

---

**Made for people who think while they browse.**
