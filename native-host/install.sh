#!/bin/bash

# Jot Native Host Installer for macOS
# Run this script after loading the Chrome extension

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.jot.host"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "=================================="
echo "  Jot Native Host Installer"
echo "=================================="
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}Error: This installer only supports macOS${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js first: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js found: $(node --version)"

# Get the Chrome extension ID
echo ""
echo "To find your extension ID:"
echo "1. Open Chrome and go to chrome://extensions"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Find Jot and copy its ID (looks like: abcdefghijklmnopqrstuvwxyz123456)"
echo ""
read -p "Enter your Jot extension ID: " EXTENSION_ID

if [[ -z "$EXTENSION_ID" ]]; then
    echo -e "${RED}Error: Extension ID is required${NC}"
    exit 1
fi

# Validate extension ID format (32 lowercase letters)
if ! [[ "$EXTENSION_ID" =~ ^[a-z]{32}$ ]]; then
    echo -e "${YELLOW}Warning: Extension ID doesn't match expected format (32 lowercase letters)${NC}"
    read -p "Continue anyway? (y/n): " CONTINUE
    if [[ "$CONTINUE" != "y" ]]; then
        exit 1
    fi
fi

# Install the host script
echo ""
echo "Installing native host..."

# Copy host script
sudo cp "$SCRIPT_DIR/jot-host.js" /usr/local/bin/jot-host
sudo chmod +x /usr/local/bin/jot-host

echo -e "${GREEN}✓${NC} Host script installed to /usr/local/bin/jot-host"

# Create the manifest with the correct extension ID
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_DIR/$HOST_NAME.json" << EOF
{
  "name": "$HOST_NAME",
  "description": "Jot filesystem bridge for Obsidian vault integration",
  "path": "/usr/local/bin/jot-host",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo -e "${GREEN}✓${NC} Manifest installed to $MANIFEST_DIR/$HOST_NAME.json"

# Verify installation
echo ""
echo "Verifying installation..."

if [[ -x /usr/local/bin/jot-host ]]; then
    echo -e "${GREEN}✓${NC} Host script is executable"
else
    echo -e "${RED}✗${NC} Host script is not executable"
    exit 1
fi

if [[ -f "$MANIFEST_DIR/$HOST_NAME.json" ]]; then
    echo -e "${GREEN}✓${NC} Manifest file exists"
else
    echo -e "${RED}✗${NC} Manifest file not found"
    exit 1
fi

echo ""
echo "=================================="
echo -e "${GREEN}  Installation complete!${NC}"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Reload the Jot extension in Chrome (chrome://extensions)"
echo "2. Click the Jot icon to open the popup"
echo "3. Enter your Obsidian vault path when prompted"
echo ""
