<p align="center">
  <img src="public/icon.svg" width="80" height="80" alt="Jot">
</p>

<h1 align="center">Jot</h1>

<p align="center"><strong>Save thoughts on any webpage, straight to your Obsidian vault.</strong></p>

<p align="center">No cloud. No account. Just your browser and your notes.</p>

<p align="center"><a href="https://github.com/alexanderjmontague/jot/releases/latest"><strong>→ Download Latest Release</strong></a></p>

<!-- TODO: Add screenshot/gif here -->

---

## What is this?

Ever read something online and want to jot down a quick thought? Jot lets you do exactly that — click the icon, type your comment, and it's saved as a markdown file in your Obsidian vault.

Your notes stay local. The extension talks directly to your filesystem through a tiny helper app (no servers, no sync, no BS).

## Install

1. **Download** [`jot-extension.zip`](https://github.com/alexanderjmontague/jot/releases/latest/download/jot-extension.zip) and unzip it
2. **Open Chrome** → go to `chrome://extensions` → enable **Developer mode**
3. **Click "Load unpacked"** → select the `chrome-mv3` folder you just unzipped
4. **Click the Jot icon** → follow prompts to install the helper app
5. **Set your vault path** → done!

Works with Chrome, Arc, Brave, Edge, and other Chromium browsers.

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
