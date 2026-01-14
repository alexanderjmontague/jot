import { hasCommentsForUrl, normalizeUrl } from '../src/shared/storage';

const DEFAULT_ACTION_ICONS = {
  16: 'icon/16.png',
  32: 'icon/32.png',
  48: 'icon/48.png',
  96: 'icon/96.png',
  128: 'icon/128.png',
} as const;

const COMMENT_ACTION_ICONS = {
  16: 'icon-comment/16.png',
  32: 'icon-comment/32.png',
  48: 'icon-comment/48.png',
  96: 'icon-comment/96.png',
  128: 'icon-comment/128.png',
} as const;

async function setIconForTab(tabId: number | undefined, hasComments: boolean) {
  const iconPaths = hasComments ? COMMENT_ACTION_ICONS : DEFAULT_ACTION_ICONS;
  try {
    if (tabId !== undefined) {
      await chrome.action.setIcon({ path: iconPaths, tabId });
    } else {
      await chrome.action.setIcon({ path: iconPaths });
    }
  } catch (error) {
    // Tab may have been closed
    console.debug('Failed to set icon for tab', error);
  }
}

async function updateIconForTab(tabId: number | undefined, url: string | undefined) {
  if (!url) {
    await setIconForTab(tabId, false);
    return;
  }

  try {
    const hasComments = await hasCommentsForUrl(url);
    await setIconForTab(tabId, hasComments);
  } catch (error) {
    // Native host may not be installed yet
    console.debug('Failed to check comments for URL', error);
    await setIconForTab(tabId, false);
  }
}

export default defineBackground(() => {
  // Update icon when user switches tabs
  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
      const tab = await chrome.tabs.get(tabId);
      const url = tab.url ? normalizeUrl(tab.url) : undefined;
      await updateIconForTab(tabId, url);
    } catch (error) {
      console.debug('Failed to get tab for icon update', error);
    }
  });

  // Update icon when page finishes loading
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      const url = tab.url ? normalizeUrl(tab.url) : undefined;
      await updateIconForTab(tabId, url);
    }
  });

  // Handle messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Update icon after a comment is saved
    if (message?.type === 'comment-saved') {
      void (async () => {
        try {
          const messageUrl =
            typeof message.url === 'string' && message.url
              ? normalizeUrl(message.url)
              : undefined;
          const senderUrl = sender.url ? normalizeUrl(sender.url) : undefined;
          const url = messageUrl ?? senderUrl;

          if (sender.tab?.id) {
            await updateIconForTab(sender.tab.id, url);
          } else if (url) {
            // Find all tabs with this URL and update their icons
            const tabs = await chrome.tabs.query({});
            await Promise.all(
              tabs
                .filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.id !== undefined)
                .filter((tab) => (tab.url ? normalizeUrl(tab.url) === url : false))
                .map((tab) => updateIconForTab(tab.id, url)),
            );
          }

          sendResponse({ ok: true });
        } catch (error) {
          console.error('Failed to update icon after comment saved', error);
          sendResponse({ ok: false, error: 'Failed to update icon' });
        }
      })();
      return true;
    }

    return undefined;
  });
});
