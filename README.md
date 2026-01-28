<p align="center">
  <img src="public/logo.svg" width="80" height="80" alt="Jot">
</p>

<h1 align="center">Jot</h1>

<p align="center"><strong>Leave notes on any webpage.</strong></p>

<p align="center">Modern bookmarks, captured locally – for you and Claude Code</p>

<p align="center"><a href="https://github.com/alexanderjmontague/jot/releases/latest"><strong>→ Download Latest Release</strong></a></p>

<!-- TODO: Add screenshot/gif here -->

---

## What is this?

Ever read something online and want to jot down a quick thought? Jot lets you do exactly that — click the icon, type your comment, and it's saved as a markdown file in your Obsidian vault.

Your notes stay local. The extension talks directly to your filesystem through a tiny helper app (no servers, no sync, no BS).

## Install

Download [`jot-extension.zip`](https://github.com/alexanderjmontague/jot/releases/latest/download/jot-extension.zip), unzip it, and load it in Chrome using [Developer mode](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked). Then follow the setup instructions in the extension.

Works with Chrome, Arc, Brave, Edge, and other Chromium browsers.

**Keyboard shortcut:** `⇧⌘E` (Shift+Cmd+E) to open Jot on any page.

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

Want to build from source?

```bash
git clone https://github.com/alexanderjmontague/jot.git
cd jot
pnpm install
pnpm build
```

Then load `.output/chrome-mv3` as an unpacked extension.

For the native helper, you'll need Xcode:

```bash
cd native-host-swift
./install.sh
```

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
