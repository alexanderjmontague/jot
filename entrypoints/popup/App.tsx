import { useEffect, useState, type SVGProps } from 'react';
import { useColorScheme } from '../../src/shared/hooks/useColorScheme';
import { normalizeUrl, isHostInstalled, isHostConfigured, getFolders } from '../../src/shared/storage';
import { MinimalClipEditor } from '../../src/shared/components/MinimalClipEditor';
import { SetupView } from '../../src/shared/components/SetupView';
import { DownloadHelperView } from '../../src/shared/components/DownloadHelperView';
import { isValidWebUrl } from '../../src/shared/url';
import { getCachedThread } from '../../src/shared/threadCache';
import type { ClipThread, Folder } from '../../src/shared/storage';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../../src/components/ui/tooltip';

// Flatten folder tree for dropdown display (shows all folders with depth info)
function flattenFoldersForDropdown(folders: Folder[]): { folder: Folder; depth: number }[] {
  const result: { folder: Folder; depth: number }[] = [];

  function traverse(items: Folder[], depth: number) {
    for (const folder of items) {
      result.push({ folder, depth });
      if (folder.children.length > 0) {
        traverse(folder.children, depth + 1);
      }
    }
  }

  traverse(folders, 0);
  return result;
}
import { Loader2 } from 'lucide-react';

type AppState = 'loading' | 'not-installed' | 'setup' | 'ready' | 'error';

function PopupApp() {
  const [url, setUrl] = useState<string>('');
  const [initialThread, setInitialThread] = useState<ClipThread | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('Uncategorized');

  useEffect(() => {
    async function init() {
      try {
        setIsInitializing(true);

        // Load folders in parallel with tab info
        const foldersPromise = getFolders().catch(() => []);

        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!activeTab?.url) {
          setError('Unable to determine active tab.');
          setInitialThread(undefined);
          setIsInitializing(false);
          return;
        }

        if (!isValidWebUrl(activeTab.url)) {
          setError('No active page');
          setInitialThread(undefined);
          setIsInitializing(false);
          return;
        }

        const normalized = normalizeUrl(activeTab.url);
        const [cached, loadedFolders] = await Promise.all([
          getCachedThread(normalized),
          foldersPromise,
        ]);
        setUrl(normalized);
        setInitialThread(cached ?? undefined);
        setFolders(loadedFolders);
        // If there's a cached thread, use its folder as default
        if (cached?.folder) {
          setSelectedFolder(cached.folder);
        }
        setError(null);
        setIsInitializing(false);
      } catch (err) {
        console.error(err);
        setError('Failed to load active tab.');
        setInitialThread(undefined);
        setIsInitializing(false);
      }
    }

    void init();
  }, []);

  const handleSave = () => {
    window.close();
  };

  const handleOpenList = () => {
    chrome.tabs
      .create({ url: chrome.runtime.getURL('list.html') })
      .catch((err) => console.error('Failed to open list view', err));
  };

  if (isInitializing) {
    return (
      <div className="flex w-[320px] flex-col items-center justify-center gap-2 bg-background p-4 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <p>Loading saved comments...</p>
      </div>
    );
  }

  if (error) {
    const isInactivePageError = error === 'No active page';

    if (isInactivePageError) {
      return (
        <TooltipProvider delayDuration={0}>
          <div className="flex w-[320px] min-h-[200px] flex-col bg-background p-2 text-sm text-foreground">
            {/* Header bar */}
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5">
              <span className="truncate text-muted-foreground/60">{error}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleOpenList}
                    aria-label="View saved"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 text-foreground transition hover:bg-accent hover:text-accent-foreground"
                  >
                    <img src="/logo.svg" alt="Saved" className="size-5" draggable={false} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Saved</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {/* Empty state message */}
            <div className="flex flex-1 items-center justify-center">
              <p className="max-w-[200px] text-center text-xs text-muted-foreground/50">
                Comments can only be added on web pages.
              </p>
            </div>
          </div>
        </TooltipProvider>
      );
    }

    return (
      <TooltipProvider delayDuration={0}>
        <div className="flex w-[320px] flex-col gap-2 bg-background p-2 text-sm text-foreground">
          <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
            <span className="truncate">{error}</span>
            <div className="flex shrink-0 gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleOpenList}
                    aria-label="View saved"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 text-foreground transition hover:bg-accent hover:text-accent-foreground"
                  >
                    <img src="/logo.svg" alt="Saved" className="size-5" draggable={false} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Saved</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Flatten folder tree and filter out Uncategorized (it's the default)
  const flattenedFolders = flattenFoldersForDropdown(folders).filter(
    ({ folder }) => folder.name !== 'Uncategorized'
  );

  return (
    <div className="flex w-[320px] flex-col gap-2 bg-background p-2">
      <MinimalClipEditor
        url={url}
        initialThread={initialThread}
        showViewCommentsButton={true}
        showSidebarButton={false}
        onCommentAdded={handleSave}
        defaultFolder={selectedFolder}
        flattenedFolders={flattenedFolders}
        selectedFolder={selectedFolder}
        onFolderChange={setSelectedFolder}
      />
    </div>
  );
}

function App() {
  useColorScheme();
  const [appState, setAppState] = useState<AppState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkSetup = async () => {
    setAppState('loading');
    try {
      const installed = await isHostInstalled();
      if (!installed) {
        setAppState('not-installed');
        return;
      }

      const configured = await isHostConfigured();
      setAppState(configured ? 'ready' : 'setup');
    } catch (err) {
      console.error('Failed to check host configuration', err);
      const message = err instanceof Error ? err.message : 'Unknown error';

      if (message.includes('Native host') || message.includes('disconnected')) {
        setAppState('not-installed');
      } else {
        setErrorMessage(message);
        setAppState('error');
      }
    }
  };

  useEffect(() => {
    void checkSetup();
  }, []);

  if (appState === 'loading') {
    return (
      <div className="flex w-[320px] flex-col items-center justify-center gap-2 bg-background p-4 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <p className="text-sm">Preparing Jot...</p>
      </div>
    );
  }

  if (appState === 'not-installed') {
    return (
      <div className="w-[360px] bg-background">
        <DownloadHelperView onRetry={checkSetup} />
      </div>
    );
  }

  if (appState === 'error') {
    return (
      <div className="flex w-[320px] flex-col items-center justify-center gap-3 bg-background p-4 text-center">
        <p className="text-sm font-medium text-destructive">Something went wrong</p>
        {errorMessage && <p className="text-xs text-muted-foreground">{errorMessage}</p>}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-xs text-primary underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (appState === 'setup') {
    return (
      <div className="w-[360px] bg-background">
        <SetupView onComplete={() => setAppState('ready')} />
      </div>
    );
  }

  return <PopupApp />;
}

export default App;

function HistoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 7v14" />
      <path d="M16 12h2" />
      <path d="M16 8h2" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      <path d="M6 12h2" />
      <path d="M6 8h2" />
    </svg>
  );
}
