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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../src/components/ui/select';
import { Loader2, Folder as FolderIcon } from 'lucide-react';

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
                    aria-label="View comments"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 text-foreground transition hover:bg-accent hover:text-accent-foreground"
                  >
                    <HistoryIcon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>All comments</p>
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
                    aria-label="View comments"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 text-foreground transition hover:bg-accent hover:text-accent-foreground"
                  >
                    <HistoryIcon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>All comments</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Filter out Uncategorized from display list (it's the default)
  const displayFolders = folders.filter((f) => f.name !== 'Uncategorized');

  return (
    <div className="flex w-[320px] flex-col gap-2 bg-background p-2">
      {displayFolders.length > 0 && (
        <Select value={selectedFolder} onValueChange={setSelectedFolder}>
          <SelectTrigger className="h-8 text-xs">
            <FolderIcon className="mr-2 h-3 w-3" />
            <SelectValue placeholder="Save to folder..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Uncategorized">
              Uncategorized
            </SelectItem>
            {displayFolders.map((f) => (
              <SelectItem key={f.name} value={f.name}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <MinimalClipEditor
        url={url}
        initialThread={initialThread}
        showViewCommentsButton={true}
        showSidebarButton={false}
        onCommentAdded={handleSave}
        defaultFolder={selectedFolder}
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
