import { defineConfig } from 'wxt';
import { fileURLToPath } from 'node:url';

// See https://wxt.dev/api/config.html
export default defineConfig((context) => {
  const command = context?.command ?? 'build';
  return {
    modules: ['@wxt-dev/module-react'],
    vite: () => {
      const srcDir = fileURLToPath(new URL('./src', import.meta.url));
      return {
        resolve: {
          alias: [
            { find: /^@\//, replacement: `${srcDir}/` },
          ],
        },
        build: {},
      };
    },
    manifest: {
      name: 'Jot',
      description: 'Comment on webpages and save them to your Obsidian vault.',
      permissions: ['storage', 'activeTab', 'tabs', 'nativeMessaging', 'scripting'],
      host_permissions: ['<all_urls>'],
      icons: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        96: 'icon/96.png',
        128: 'icon/128.png',
      },
      action: {
        default_popup: 'popup.html',
        default_title: 'Jot',
      },
      options_ui: {
        page: 'list.html',
        open_in_tab: true,
      },
      commands: {
        _execute_action: {
          suggested_key: {
            default: 'Ctrl+Shift+E',
            mac: 'Command+Shift+E',
          },
          description: 'Open Jot popup',
        },
      },
      ...(command === 'serve'
        ? {
            // Allow the Vite dev server (which may pick any localhost port) when running the extension in dev mode.
            content_security_policy: {
              extension_pages: "script-src 'self' 'wasm-unsafe-eval' http://localhost:*; object-src 'self';",
              sandbox:
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; sandbox allow-scripts allow-forms allow-popups allow-modals; child-src 'self';",
            },
          }
        : {}),
    },
  };
});
