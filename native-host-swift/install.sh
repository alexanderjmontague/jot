#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Ask for extension ID
echo "Please paste your Chrome extension ID."
echo "(Find it at chrome://extensions with Developer mode enabled)"
echo ""
read -p "Extension ID: " EXTENSION_ID

if [ -z "$EXTENSION_ID" ]; then
    echo -e "${RED}Error: Extension ID is required.${NC}"
    exit 1
fi

# Validate extension ID format (32 lowercase letters)
if ! [[ "$EXTENSION_ID" =~ ^[a-z]{32}$ ]]; then
    echo -e "${YELLOW}Warning: Extension ID should be 32 lowercase letters.${NC}"
    echo "Continuing anyway..."
fi

echo ""
echo "Installing..."

# 1. Copy binary to /usr/local/bin
echo "  - Copying jot-host to /usr/local/bin..."
sudo mkdir -p /usr/local/bin
sudo cp "$BINARY_PATH" /usr/local/bin/jot-host
sudo chmod 755 /usr/local/bin/jot-host

# 2. Create native messaging manifest directory
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$MANIFEST_DIR"

# 3. Create manifest file
echo "  - Creating native messaging manifest..."
cat > "$MANIFEST_DIR/com.jot.host.json" << EOF
{
  "name": "com.jot.host",
  "description": "Jot native helper for saving comments to Obsidian",
  "path": "/usr/local/bin/jot-host",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://${EXTENSION_ID}/"
  ]
}
EOF

# 4. Create config directory
echo "  - Creating config directory..."
mkdir -p "$HOME/.jot"

echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Open Chrome and click the Jot extension"
echo "  2. Enter your Obsidian vault path"
echo "  3. Start commenting!"
echo ""
