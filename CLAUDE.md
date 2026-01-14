# Claude Instructions for Jot (web-clipper)

## Testing

When asked to "restart", "rebuild", "restart for testing", "update for testing", or similar, run:

```bash
pnpm build
```

This builds to `.output/chrome-mv3/` which Alex loads as an unpacked extension in his normal Chrome browser. Do NOT use `pnpm dev` - that opens a separate dev browser which is not what he wants.

After building, remind him to reload the extension at `chrome://extensions`.
