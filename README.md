# Jot

A Chrome extension that saves comments on webpages as markdown files in your Obsidian vault.

## Installation

### Step 1: Install the Chrome Extension

1. Clone this repo and run `npm install && npm run build`
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** and select the `.output/chrome-mv3` folder
5. Copy the **Extension ID** (shown under the extension name, looks like `abcdefghijklmnop...`)

### Step 2: Install the Native Helper

The extension needs a small helper app to read/write files on your computer.

```bash
cd native-host
./install.sh
```

When prompted, paste your Extension ID from Step 1.

### Step 3: Configure Your Vault

1. Click the Jot icon in Chrome
2. Paste the path to your Obsidian vault (e.g., `/Users/you/Documents/Obsidian/MyVault`)
3. Click **Save & Continue**

That's it! Your comments will be saved to a `Jot` folder inside your vault.

## Usage

- **Save a comment**: Click the Jot icon on any webpage and type a comment
- **View all comments**: Click the book icon in the popup, or go to the extension's options page
- **Toolbar indicator**: The icon shows a dot when the current page has saved comments

## How It Works

```
Chrome Extension  <-->  Native Helper (Node.js)  <-->  Obsidian Vault
                         ~/.jot/config.json           ~/Vault/Jot/*.md
```

Each comment is saved as a markdown file with YAML frontmatter:

```markdown
---
url: "https://example.com/page"
title: "Page Title"
created_at: 2025-01-10T14:30:00.000Z
---

## Comments

### 2025-01-10 14:30
Your comment here.
```

## Development

```bash
npm install
npm run dev
```

Load the extension from `.output/chrome-mv3` in Chrome.

## Uninstall

To remove the native helper:

```bash
rm /usr/local/bin/jot-host
rm ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.jot.host.json
rm -rf ~/.jot
```
