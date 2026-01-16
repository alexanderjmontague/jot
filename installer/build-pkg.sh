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

# Fixed extension ID (derived from the key in manifest.json)
# This ID is the same across all Chromium browsers
EXTENSION_ID="lgjhokmhniplbigjblidponoailcldhd"

# Get the actual logged-in user (not root, which runs the installer)
INSTALLING_USER=$(stat -f '%Su' /dev/console)
USER_HOME=$(eval echo ~$INSTALLING_USER)

# Install locations
JOT_DIR="$USER_HOME/Library/Application Support/Jot"
BINARY_PATH="$JOT_DIR/jot-host"

# Create Jot directory and copy binary
mkdir -p "$JOT_DIR"
cp /tmp/jot-install/jot-host "$BINARY_PATH"
chmod 755 "$BINARY_PATH"

# Create config directory and ensure correct ownership
mkdir -p "$USER_HOME/.jot"
chown -R "$INSTALLING_USER" "$USER_HOME/.jot"
chown -R "$INSTALLING_USER" "$JOT_DIR"

# Manifest content
MANIFEST_CONTENT=$(cat << MANIFEST
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
)

# Install manifest for all Chromium browsers
BROWSER_DIRS=(
    "$USER_HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    "$USER_HOME/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts"
    "$USER_HOME/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
    "$USER_HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
    "$USER_HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
    "$USER_HOME/Library/Application Support/Arc/User Data/NativeMessagingHosts"
    "$USER_HOME/Library/Application Support/Chromium/NativeMessagingHosts"
    "$USER_HOME/Library/Application Support/Vivaldi/NativeMessagingHosts"
    "$USER_HOME/Library/Application Support/Opera Software/Opera Stable/NativeMessagingHosts"
)

for MANIFEST_DIR in "${BROWSER_DIRS[@]}"; do
    PARENT_DIR="$(dirname "$MANIFEST_DIR")"
    if [ -d "$PARENT_DIR" ]; then
        mkdir -p "$MANIFEST_DIR"
        echo "$MANIFEST_CONTENT" > "$MANIFEST_DIR/com.jot.host.json"
    fi
done

# Cleanup temp files
rm -rf /tmp/jot-install

# Success message
osascript -e 'display alert "Jot Helper Installed!" message "Installation complete. Jot will now work in Chrome, Edge, Brave, Arc, and other Chromium browsers."'

exit 0
POSTINSTALL

chmod +x "$SCRIPT_DIR/scripts/postinstall"
echo "  Done."

# Step 4: Build the component .pkg
echo "Step 4: Building component package..."
COMPONENT_PKG="$BUILD_DIR/JotHelper-component.pkg"

pkgbuild \
    --root "$PKG_ROOT" \
    --scripts "$SCRIPT_DIR/scripts" \
    --identifier "com.jot.host" \
    --version "$VERSION" \
    --install-location "/" \
    "$COMPONENT_PKG"

echo "  Done."

# Step 5: Build the final installer with custom UI
echo "Step 5: Building final installer with custom UI..."
PKG_FILE="$BUILD_DIR/JotHelper.pkg"

productbuild \
    --distribution "$SCRIPT_DIR/Distribution.xml" \
    --resources "$SCRIPT_DIR/Resources" \
    --package-path "$BUILD_DIR" \
    "$PKG_FILE"

# Clean up component package
rm "$COMPONENT_PKG"

echo ""
echo "========================================="
echo "Build complete!"
echo ""
echo "Package: $PKG_FILE"
echo ""
echo "To install: double-click the .pkg file"
echo "The installer will prompt for the extension ID."
echo "========================================="
