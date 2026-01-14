#!/bin/bash
set -e

# Jot Native Host Installer (Swift) for macOS
# Works automatically with Chrome, Edge, Brave, Arc, and other Chromium browsers

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

HOST_NAME="com.jot.host"

# Fixed extension ID (derived from the key in manifest.json)
# This ID is the same across all Chromium browsers
EXTENSION_ID="lgjhokmhniplbigjblidponoailcldhd"

echo ""
echo "=========================================="
echo "  Jot Native Helper Installer (Swift)  "
echo "=========================================="
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}Error: This installer is for macOS only.${NC}"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if binary exists in build directory
BINARY_PATH="$SCRIPT_DIR/.build/release/jot-host"
if [ ! -f "$BINARY_PATH" ]; then
    echo "Building jot-host..."
    cd "$SCRIPT_DIR"
    swift build -c release
    echo ""
fi

echo "Installing..."

# 1. Copy binary to /usr/local/bin
echo "  - Copying jot-host to /usr/local/bin..."
sudo mkdir -p /usr/local/bin
sudo cp "$BINARY_PATH" /usr/local/bin/jot-host
sudo chmod 755 /usr/local/bin/jot-host

echo -e "${GREEN}✓${NC} Host binary installed"

# Create the manifest content
MANIFEST_CONTENT=$(cat << EOF
{
  "name": "$HOST_NAME",
  "description": "Jot native helper for saving comments to Obsidian",
  "path": "/usr/local/bin/jot-host",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF
)

# Install manifest for all Chromium browsers
echo ""
echo "Installing browser manifests..."

# Array of browser manifest directories
BROWSER_DIRS=(
    "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    "$HOME/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts"
    "$HOME/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
    "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
    "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
    "$HOME/Library/Application Support/Arc/User Data/NativeMessagingHosts"
    "$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
    "$HOME/Library/Application Support/Vivaldi/NativeMessagingHosts"
    "$HOME/Library/Application Support/Opera Software/Opera Stable/NativeMessagingHosts"
)

INSTALLED_COUNT=0

for MANIFEST_DIR in "${BROWSER_DIRS[@]}"; do
    # Only install if the browser's parent directory exists (browser is installed)
    PARENT_DIR="$(dirname "$MANIFEST_DIR")"
    if [[ -d "$PARENT_DIR" ]]; then
        mkdir -p "$MANIFEST_DIR"
        echo "$MANIFEST_CONTENT" > "$MANIFEST_DIR/$HOST_NAME.json"
        BROWSER_NAME="$(basename "$PARENT_DIR")"
        echo -e "${GREEN}✓${NC} Installed for $BROWSER_NAME"
        ((INSTALLED_COUNT++))
    fi
done

if [[ $INSTALLED_COUNT -eq 0 ]]; then
    echo -e "${RED}Warning: No supported browsers found${NC}"
    echo "Creating manifest for Chrome anyway..."
    MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    mkdir -p "$MANIFEST_DIR"
    echo "$MANIFEST_CONTENT" > "$MANIFEST_DIR/$HOST_NAME.json"
fi

# Create config directory
mkdir -p "$HOME/.jot"

echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo "The extension will work in any installed Chromium browser"
echo "(Chrome, Edge, Brave, Arc, Vivaldi, Opera, etc.)"
echo ""
echo "Next steps:"
echo "  1. Reload the Jot extension in your browser"
echo "  2. Enter your Obsidian vault path"
echo "  3. Start commenting!"
echo ""
