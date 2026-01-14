#!/bin/bash
set -e

# Build the Jot macOS .pkg installer

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/.."
SWIFT_DIR="$PROJECT_ROOT/native-host-swift"
BUILD_DIR="$SCRIPT_DIR/build"
PKG_ROOT="$BUILD_DIR/pkg-root"
VERSION="1.0.0"

echo "Building Jot Helper Installer v$VERSION"
echo "========================================="
echo ""

# Clean previous build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Step 1: Build Swift binary
echo "Step 1: Building Swift binary..."
cd "$SWIFT_DIR"
swift build -c release
echo "  Done."

# Step 2: Create package root structure (user-local, no admin needed)
echo "Step 2: Creating package structure..."

# We'll use a template structure - postinstall will copy to user's home
mkdir -p "$PKG_ROOT/tmp/jot-install"

# Copy binary to temp location (postinstall moves it to ~/Library/Application Support/Jot/)
cp "$SWIFT_DIR/.build/release/jot-host" "$PKG_ROOT/tmp/jot-install/jot-host"

echo "  Done."

# Step 3: Create postinstall script
echo "Step 3: Creating installer scripts..."
cat > "$SCRIPT_DIR/scripts/postinstall" << 'POSTINSTALL'
#!/bin/bash

# Prompt user for extension ID with instructions
EXTENSION_ID=$(osascript -e 'text returned of (display dialog "Enter your Chrome extension ID for Jot.
Jot Helper needs this to connect your local files to the extension.

To find it:
1. Open Chrome and go to chrome://extensions
2. Enable \"Developer mode\" (toggle in top right)
3. Find \"Jot\" and copy the ID
   (looks like: omicjbpmfoppjopnogokibbgmdopdlgl)

Paste your extension ID:" default answer "" buttons {"Cancel", "OK"} default button "OK")' 2>/dev/null)

# Check if user cancelled
if [ $? -ne 0 ] || [ -z "$EXTENSION_ID" ]; then
    osascript -e 'display alert "Installation Cancelled" message "Jot Helper was not installed. Please re-run the installer and enter your extension ID."'
    exit 1
fi

# Trim whitespace
EXTENSION_ID=$(echo "$EXTENSION_ID" | tr -d '[:space:]')

# Validate format (32 lowercase alphanumeric characters)
if [[ ! "$EXTENSION_ID" =~ ^[a-z]{32}$ ]]; then
    osascript -e 'display alert "Invalid Extension ID" message "The extension ID must be exactly 32 lowercase letters (a-z).

Please re-run the installer with a valid extension ID from chrome://extensions."'
    exit 1
fi

# Get the current user's home directory
USER_HOME="$HOME"
if [ -z "$USER_HOME" ] || [ "$USER_HOME" = "/" ]; then
    USER_HOME=$(eval echo ~$USER)
fi

# Install locations (all in user's home - no admin needed)
JOT_DIR="$USER_HOME/Library/Application Support/Jot"
CHROME_HOSTS_DIR="$USER_HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
BINARY_PATH="$JOT_DIR/jot-host"

# Create directories
mkdir -p "$JOT_DIR"
mkdir -p "$CHROME_HOSTS_DIR"

# Copy binary
cp /tmp/jot-install/jot-host "$BINARY_PATH"
chmod 755 "$BINARY_PATH"

# Create manifest with user's extension ID
cat > "$CHROME_HOSTS_DIR/com.jot.host.json" << MANIFEST
{
  "name": "com.jot.host",
  "description": "Jot native helper for saving clips to Obsidian",
  "path": "$BINARY_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://${EXTENSION_ID}/"
  ]
}
MANIFEST

# Cleanup temp files
rm -rf /tmp/jot-install

# Success message
osascript -e 'display alert "Jot Helper Installed!" message "Installation complete. Return to the Jot extension and click \"I'\''ve installed it\" to continue."'

exit 0
POSTINSTALL

chmod +x "$SCRIPT_DIR/scripts/postinstall"
echo "  Done."

# Step 4: Build the .pkg
echo "Step 4: Building .pkg..."
PKG_FILE="$BUILD_DIR/JotHelper.pkg"

pkgbuild \
    --root "$PKG_ROOT" \
    --scripts "$SCRIPT_DIR/scripts" \
    --identifier "com.jot.host" \
    --version "$VERSION" \
    --install-location "/" \
    "$PKG_FILE"

echo ""
echo "========================================="
echo "Build complete!"
echo ""
echo "Package: $PKG_FILE"
echo ""
echo "To install: double-click the .pkg file"
echo "The installer will prompt for the extension ID."
echo "========================================="
