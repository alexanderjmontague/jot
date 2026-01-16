# Claude Instructions for Jot

## Building

```bash
pnpm build
```

Builds to `.output/chrome-mv3/` for loading as an unpacked extension in Chrome.

After building, remind the user to reload the extension at `chrome://extensions`.

**Note:** If the user reports that changes aren't appearing, they may have forgotten to run `pnpm build`. The extension won't reflect code changes until rebuilt.

## Releasing to GitHub

Build, create zip with folder named "jot", and update the release:

```bash
pnpm build

cd .output && rm -f jot-extension.zip && \
  zip -r temp.zip chrome-mv3 && mkdir -p temp && unzip -d temp temp.zip && \
  mv temp/chrome-mv3 temp/jot && cd temp && zip -r ../jot-extension.zip jot && \
  cd .. && rm -rf temp temp.zip && cd ..

gh release delete v1.0.0 --yes 2>/dev/null
git tag -d v1.0.0 2>/dev/null
git push origin :refs/tags/v1.0.0 2>/dev/null
gh release create v1.0.0 .output/jot-extension.zip installer/build/JotHelper.pkg \
  --title "v1.0.0" \
  --notes "See [README](https://github.com/alexanderjmontague/jot#readme) for install instructions."
```

## Fresh Install Testing

To completely wipe Jot from the system for testing a fresh install:

1. Remove the extension from Chrome
2. Run these commands:

```bash
# Remove native helper binary (requires sudo)
sudo rm -f /usr/local/bin/jot-host

# Remove config
rm -rf ~/.jot

# Remove browser manifests
rm -f ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.jot.host.json
rm -f ~/Library/Application\ Support/Arc/User\ Data/NativeMessagingHosts/com.jot.host.json
rm -f ~/Library/Application\ Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/com.jot.host.json
```

Then download fresh from GitHub releases to test.
