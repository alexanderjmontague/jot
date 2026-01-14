import { useCallback, useEffect, useMemo, useState, type SVGProps } from 'react';
import { useColorScheme } from '../../src/shared/hooks/useColorScheme';
import { Button } from '../../src/components/ui/button';
import { Card, CardContent } from '../../src/components/ui/card';
import { Input } from '../../src/components/ui/input';
import { ScrollArea } from '../../src/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../../src/components/ui/tooltip';
import {
  deleteComment,
  deleteThread,
  getAllThreads,
  isHostInstalled,
  isHostConfigured,
  getFolders,
  createFolder,
  renameFolder as renameFolderApi,
  deleteFolder as deleteFolderApi,
  moveThread,
  type ClipThread,
  type Folder,
} from '../../src/shared/storage';
import { SetupView } from '../../src/shared/components/SetupView';
import { FolderSidebar } from '../../src/shared/components/FolderSidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../src/components/ui/dropdown-menu';
import { DownloadHelperView } from '../../src/shared/components/DownloadHelperView';
import { formatAbsolute, formatRelativeOrAbsolute } from '../../src/shared/datetime';
import { formatDisplayUrl, stripWwwPrefix, getBaseDomainInfo } from '../../src/shared/url';
import { Loader2, RefreshCw, Settings, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../src/components/ui/dialog';
import { Label } from '../../src/components/ui/label';
import { getConfig, setVaultPath } from '../../src/shared/storage';

type ThreadErrors = Record<string, string | null>;
type FaviconFailures = Record<string, true>;
type PreviewFailures = Record<string, true>;
type PreviewFit = 'cover' | 'contain';
type PreviewFits = Record<string, PreviewFit>;
type AppState = 'loading' | 'not-installed' | 'setup' | 'ready' | 'error';

const PREVIEW_FRAME_ASPECT = 1.91;
const PREVIEW_SIMILARITY_TOLERANCE = 0.25;

function determinePreviewFit(width: number, height: number): PreviewFit {
  if (width <= 0 || height <= 0) {
    return 'contain';
  }
  const aspect = width / height;
  if (!Number.isFinite(aspect) || aspect <= 0) {
    return 'contain';
  }
  if (aspect >= PREVIEW_FRAME_ASPECT) {
    return 'cover';
  }
  if (Math.abs(aspect - PREVIEW_FRAME_ASPECT) <= PREVIEW_SIMILARITY_TOLERANCE) {
    return 'cover';
  }
  return 'contain';
}

function LinkIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6" />
    </svg>
  );
}

function FolderMoveIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M12 10v6" />
      <path d="m15 13-3 3-3-3" />
    </svg>
  );
}

function getThreadDisplayTitle(thread: ClipThread): string {
  const stored = thread.title?.trim();
  if (stored) {
    return stored;
  }

  try {
    const parsed = new URL(thread.url);
    if (parsed.hostname) {
      return stripWwwPrefix(parsed.hostname);
    }
  } catch {
    // fall through to formatted URL string
  }

  return formatDisplayUrl(thread.url);
}

function useThreads() {
  const [threads, setThreads] = useState<ClipThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await getAllThreads();
      setThreads(data);
    } catch (error) {
      console.error('Failed to load threads', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  const replaceThread = useCallback(
    (nextThread: ClipThread) => {
      setThreads((prev) => {
        const index = prev.findIndex((thread) => thread.url === nextThread.url);
        if (index === -1) {
          return prev;
        }
        const next = prev.slice();
        next[index] = nextThread;
        return next;
      });
    },
    [setThreads],
  );

  const removeThread = useCallback(
    (url: string) => {
      setThreads((prev) => prev.filter((thread) => thread.url !== url));
    },
    [setThreads],
  );

  return { threads, loading, refreshing, refresh, replaceThread, removeThread };
}

type SettingsStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';

function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [fullPath, setFullPath] = useState('');
  const [status, setStatus] = useState<SettingsStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  const loadConfig = async () => {
    setStatus('loading');
    setError(null);
    try {
      const config = await getConfig();
      if (config) {
        // Combine vaultPath and commentFolder into single path
        const combined = config.vaultPath.replace(/\/+$/, '') + '/' + config.commentFolder;
        setFullPath(combined);
      }
      setStatus('idle');
    } catch (err) {
      console.error('Failed to load config', err);
      setError('Failed to load settings');
      setStatus('error');
    }
  };

  const checkForUpdate = async () => {
    try {
      const latest = await getLatestVersion();
      if (latest) {
        const current = getCurrentVersion();
        if (isNewerVersion(latest, current)) {
          setUpdateAvailable(true);
          setLatestVersion(latest);
        }
      }
    } catch (err) {
      console.error('Failed to check for updates', err);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      void loadConfig();
      void checkForUpdate();
    } else {
      // Reset state when closing
      setStatus('idle');
      setError(null);
    }
  };

  const handleSave = async () => {
    const cleanPath = fullPath.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');

    if (!cleanPath) {
      setError('Please enter a folder path');
      return;
    }

    // Split into vaultPath (parent) and commentFolder (last segment)
    const lastSlash = cleanPath.lastIndexOf('/');
    if (lastSlash <= 0) {
      setError('Please enter a valid folder path (e.g., /Users/you/Documents/Jot)');
      return;
    }
    const vaultPath = cleanPath.substring(0, lastSlash);
    const commentFolder = cleanPath.substring(lastSlash + 1);

    if (!commentFolder) {
      setError('Path must include a folder name at the end');
      return;
    }

    setStatus('saving');
    setError(null);

    try {
      await setVaultPath(vaultPath, commentFolder);
      setStatus('success');

      // Brief delay to show success state, then close
      setTimeout(() => {
        setOpen(false);
        setStatus('idle');
      }, 500);
    } catch (err) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'Failed to save settings';

      if (message.includes('PATH_NOT_FOUND') || message.includes('does not exist')) {
        setError('That folder does not exist. Please check the path and try again.');
      } else {
        setError(message);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && status !== 'saving' && status !== 'loading') {
      void handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Settings</p>
        </TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {status === 'loading' ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="settings-full-path">Folder Path</Label>
                <p className="text-xs text-muted-foreground">
                  The folder where your comments are saved.
                </p>
                <Input
                  id="settings-full-path"
                  type="text"
                  placeholder="/Users/you/Documents/Jot"
                  value={fullPath}
                  onChange={(e) => setFullPath(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={status === 'saving'}
                  className="font-mono text-sm"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {status === 'success' && (
                <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Settings saved!</span>
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={status === 'saving' || status === 'success'}
                className="w-full"
              >
                {status === 'saving' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : status === 'success' ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Saved
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ListApp() {
  const { threads, loading, refreshing, refresh, replaceThread, removeThread } = useThreads();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilterId, setActiveFilterId] = useState('all');
  const [errors, setErrors] = useState<ThreadErrors>({});
  const [faviconFailures, setFaviconFailures] = useState<FaviconFailures>({});
  const [previewFailures, setPreviewFailures] = useState<PreviewFailures>({});
  const [previewFits, setPreviewFits] = useState<PreviewFits>({});

  // Folder state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null); // null = "All"
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load folders
  useEffect(() => {
    void getFolders().then(setFolders);
  }, []);

  // Reload folders when threads change (thread counts may have changed)
  useEffect(() => {
    void getFolders().then(setFolders);
  }, [threads]);

  const handleCreateFolder = useCallback(async (name: string) => {
    await createFolder(name);
    const updated = await getFolders();
    setFolders(updated);
  }, []);

  const handleRenameFolder = useCallback(async (oldName: string, newName: string) => {
    await renameFolderApi(oldName, newName);
    const updated = await getFolders();
    setFolders(updated);
    // If the renamed folder was selected, update selection
    if (selectedFolder === oldName) {
      setSelectedFolder(newName);
    }
  }, [selectedFolder]);

  const handleDeleteFolder = useCallback(async (name: string) => {
    try {
      await deleteFolderApi(name, false);
      const updated = await getFolders();
      setFolders(updated);
      // If deleted folder was selected, go back to All
      if (selectedFolder === name) {
        setSelectedFolder(null);
      }
    } catch (err) {
      const error = err as Error & { code?: string };
      if (error.code === 'NOT_EMPTY') {
        // Could show a confirmation dialog here
        console.error('Folder not empty');
      } else {
        throw err;
      }
    }
  }, [selectedFolder]);

  const handleMoveThread = useCallback(async (url: string, toFolder: string) => {
    try {
      const updated = await moveThread(url, toFolder);
      replaceThread(updated);
      // Refresh folders to update counts
      const updatedFolders = await getFolders();
      setFolders(updatedFolders);
    } catch (err) {
      console.error('Failed to move thread', err);
    }
  }, [replaceThread]);

  const filters = useMemo(() => {
    const groups = new Map<string, { label: string; count: number }>();

    threads.forEach((thread) => {
      const base = getBaseDomainInfo(thread.url);
      if (!base) {
        return;
      }

      const entry = groups.get(base.key);
      if (entry) {
        entry.count += 1;
      } else {
        groups.set(base.key, { label: base.label, count: 1 });
      }
    });

    const domainFilters = Array.from(groups.entries())
      .filter(([, { count }]) => count > 1)
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
      .map(([key, { label, count }]) => ({
        id: key,
        label,
        count,
      }));

    return [{ id: 'all', label: 'All', count: threads.length }, ...domainFilters];
  }, [threads]);

  useEffect(() => {
    if (activeFilterId !== 'all' && !filters.some((option) => option.id === activeFilterId)) {
      setActiveFilterId('all');
    }
  }, [filters, activeFilterId]);

  // Filter by folder first
  const filteredByFolder = useMemo(() => {
    if (selectedFolder === null) {
      return threads; // "All" - show everything
    }
    return threads.filter((thread) => thread.folder === selectedFolder);
  }, [threads, selectedFolder]);

  const filteredByDomain = useMemo(() => {
    if (activeFilterId === 'all') {
      return filteredByFolder;
    }

    return filteredByFolder.filter((thread) => {
      const base = getBaseDomainInfo(thread.url);
      return base?.key === activeFilterId;
    });
  }, [filteredByFolder, activeFilterId]);

  const displayThreads = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return filteredByDomain;
    return filteredByDomain.filter((thread) => {
      const haystacks = [thread.url.toLowerCase(), ...thread.comments.map((comment) => comment.body.toLowerCase())];
      return haystacks.some((text) => text.includes(needle));
    });
  }, [filteredByDomain, searchTerm]);

  const setErrorForThread = (url: string, message: string | null) => {
    setErrors((prev) => {
      if (message === null) {
        if (!(url in prev)) return prev;
        const next = { ...prev };
        delete next[url];
        return next;
      }
      return { ...prev, [url]: message };
    });
  };

  const clearThreadState = (url: string) => {
    setFaviconFailures((prev) => {
      if (!prev[url]) return prev;
      const next = { ...prev };
      delete next[url];
      return next;
    });
    setPreviewFailures((prev) => {
      if (!prev[url]) return prev;
      const next = { ...prev };
      delete next[url];
      return next;
    });
    setPreviewFits((prev) => {
      if (!prev[url]) return prev;
      const next = { ...prev };
      delete next[url];
      return next;
    });
  };

  const handleDeleteComment = async (url: string, commentId: string) => {
    try {
      const nextThread = await deleteComment(url, commentId);
      setErrorForThread(url, null);
      if (nextThread) {
        replaceThread(nextThread);
      } else {
        removeThread(url);
        clearThreadState(url);
      }
      chrome.runtime
        .sendMessage({ type: 'comment-saved', url })
        .catch((err) => console.error('Failed to notify background about thread update', err));
    } catch (err) {
      console.error('Failed to delete comment from list view', err);
      setErrorForThread(url, 'Failed to delete comment.');
    }
  };

  const handleDeleteThread = async (url: string) => {
    try {
      await deleteThread(url);
      setErrorForThread(url, null);
      removeThread(url);
      clearThreadState(url);
      chrome.runtime
        .sendMessage({ type: 'comment-saved', url })
        .catch((err) => console.error('Failed to notify background about thread update', err));
    } catch (err) {
      console.error('Failed to delete thread from list view', err);
      setErrorForThread(url, 'Failed to delete thread.');
    }
  };

  const handleFaviconError = (url: string) => {
    setFaviconFailures((prev) => {
      if (prev[url]) {
        return prev;
      }
      return { ...prev, [url]: true };
    });
  };

  const handlePreviewError = (url: string) => {
    setPreviewFailures((prev) => {
      if (prev[url]) {
        return prev;
      }
      return { ...prev, [url]: true };
    });
  };

  const showEmptyState = !loading && displayThreads.length === 0;
  const emptyStateContent =
    threads.length === 0
      ? {
          title: 'No comments yet',
          description: 'Your saved pages will appear here once you start adding comments.',
        }
      : {
          title: 'No matches',
          description: 'Try adjusting your search.',
        };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen flex-col bg-muted/20">
        {/* Full-width navbar */}
        <nav className="flex w-full items-center justify-between gap-2 border-b border-border bg-background px-6 py-3">
          <div className="flex items-center gap-2">
            <img
              src="/thinking-bubble.png"
              alt="Thinking bubble"
              className="mt-0.5 select-none"
              style={{ width: 28, height: 21.7 }}
              draggable={false}
            />
            <h1 className="text-xl font-semibold text-foreground">Comments</h1>
          </div>
          <div className="flex items-center gap-1">
            <SettingsDialog />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={refresh}
                  disabled={refreshing}
                  className="h-8 w-8"
                  aria-label="Refresh comments"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </nav>

        {/* Main content with sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Folder sidebar */}
          <FolderSidebar
            folders={folders}
            selectedFolder={selectedFolder}
            collapsed={sidebarCollapsed}
            totalThreadCount={threads.length}
            onSelectFolder={setSelectedFolder}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
          />

          {/* Main content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Filter navbar - only visible when there are domain filters */}
            {filters.length > 1 && (
              <nav className="flex w-full items-center gap-2 overflow-x-auto border-b border-border bg-background px-6 py-2">
                {filters.map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    size="sm"
                    variant={option.id === activeFilterId ? 'secondary' : 'ghost'}
                    className="rounded-full"
                    aria-pressed={option.id === activeFilterId}
                    onClick={() => setActiveFilterId(option.id)}
                  >
                    <span className="whitespace-nowrap">{option.label}</span>
                    <span className="ml-1 text-xs text-muted-foreground/70">({option.count})</span>
                  </Button>
                ))}
              </nav>
            )}

            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-2 py-4">
              {loading ? <p className="text-sm text-muted-foreground">Loading comments...</p> : null}

              <header className="flex flex-col gap-3 px-4 pt-4 pb-6">
                <div className="flex w-full items-center gap-2 border-b border-border py-1 text-muted-foreground focus-within:border-primary transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
                    <path d="m21 21-4.34-4.34"/>
                    <circle cx="11" cy="11" r="8"/>
                  </svg>
                  <Input
                    placeholder="Search comments or URLs"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full border-0 bg-transparent px-0 py-1 text-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </header>

              <div className="flex flex-1 flex-col overflow-hidden px-4 pb-6">
                <ScrollArea className="flex-1">
              {showEmptyState ? (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-lg px-6 py-16 text-center text-muted-foreground">
                  <h2 className="text-lg font-semibold text-muted-foreground">{emptyStateContent.title}</h2>
                  <p className="text-sm">{emptyStateContent.description}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {displayThreads.map((thread) => {
                    const error = errors[thread.url] ?? null;
                    const displayTitle = getThreadDisplayTitle(thread);
                    const showFavicon = Boolean(thread.faviconUrl && !faviconFailures[thread.url]);
                    const showPreview = Boolean(thread.previewImageUrl && !previewFailures[thread.url]);
                    const displayUrl = formatDisplayUrl(thread.url);
                    const previewFrameClass = showPreview ? 'bg-muted/50' : 'bg-muted/80 dark:bg-muted/60';
                    const currentFit = previewFits[thread.url] ?? 'contain';
                    const previewObjectClass = currentFit === 'cover' ? 'object-cover' : 'object-contain';

                    return (
                      <Card key={thread.url} className="rounded-none border-0 bg-transparent shadow-none">
                        <CardContent className="flex min-w-0 items-start gap-4 px-0 py-5">
                          <a
                            href={thread.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex aspect-[1.91/1] h-[120px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-[1.5px] border-black/20 dark:border-white/15 ${previewFrameClass}`}
                            aria-label="Open saved page"
                          >
                            {showPreview ? (
                              <img
                                src={thread.previewImageUrl ?? undefined}
                                alt=""
                                className={`h-full w-full ${previewObjectClass}`}
                                onError={() => handlePreviewError(thread.url)}
                                onLoad={(event) => {
                                  const nextFit = determinePreviewFit(
                                    event.currentTarget.naturalWidth,
                                    event.currentTarget.naturalHeight,
                                  );
                                  setPreviewFits((prev) => {
                                    if (prev[thread.url] === nextFit) {
                                      return prev;
                                    }
                                    return { ...prev, [thread.url]: nextFit };
                                  });
                                }}
                                referrerPolicy="no-referrer"
                              />
                            ) : showFavicon ? (
                              <img
                                src={thread.faviconUrl ?? undefined}
                                alt=""
                                className="h-12 w-12 shrink-0"
                                onError={() => handleFaviconError(thread.url)}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <LinkIcon className="h-12 w-12 shrink-0 text-muted-foreground" />
                            )}
                          </a>
                          <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
                            <div className="flex min-w-0 items-start justify-between gap-3 overflow-hidden">
                              <div className="flex w-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden">
                                <a
                                  href={thread.url}
                                  className="flex min-w-0 items-center gap-2 overflow-hidden text-sm font-semibold text-foreground hover:text-primary"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {showFavicon ? (
                                    <img
                                      src={thread.faviconUrl ?? undefined}
                                      alt=""
                                      className="size-4 shrink-0"
                                      onError={() => handleFaviconError(thread.url)}
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
                                  )}
                                  <span className="min-w-0 flex-1 truncate" title={displayUrl}>
                                    {displayUrl}
                                  </span>
                                </a>
                                <div className="min-w-0 truncate text-sm font-normal text-muted-foreground" title={displayTitle}>
                                  {displayTitle}
                                </div>
                              </div>
                              {/* Move to folder dropdown */}
                              {folders.length > 1 && (
                                <DropdownMenu>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 shrink-0 text-muted-foreground"
                                          aria-label="Move to folder"
                                        >
                                          <FolderMoveIcon className="size-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Move to folder</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <DropdownMenuContent align="end">
                                    {folders.map((folder) => (
                                      <DropdownMenuItem
                                        key={folder.name}
                                        onClick={() => handleMoveThread(thread.url, folder.name)}
                                        disabled={thread.folder === folder.name}
                                      >
                                        {folder.name}
                                        {thread.folder === folder.name && ' (current)'}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                    aria-label="Delete all comments for this page"
                                    onClick={() => handleDeleteThread(thread.url)}
                                  >
                                    <TrashIcon className="size-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete all</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <div className="space-y-2">
                              {thread.comments.map((comment) => (
                                <div
                                  key={comment.id}
                                  className="group rounded-lg bg-[hsl(var(--comment-surface))] px-2 pt-1 pb-2 text-sm leading-relaxed text-foreground dark:text-foreground"
                                >
                                  <div className="flex min-w-0 items-center justify-between gap-2 overflow-hidden text-xs text-muted-foreground">
                                    <span className="min-w-0 truncate text-muted-foreground/50" title={formatAbsolute(comment.createdAt)}>
                                      {formatRelativeOrAbsolute(comment.createdAt)}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 hover:text-destructive focus-visible:opacity-100 focus-visible:text-destructive focus-visible:pointer-events-auto group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none"
                                      aria-label="Delete comment"
                                      onClick={() => handleDeleteComment(thread.url, comment.id)}
                                    >
                                      <TrashIcon className="size-3.5" />
                                    </Button>
                                  </div>
                                  <div className="break-words whitespace-pre-wrap pt-0 text-sm leading-relaxed">{comment.body}</div>
                                </div>
                              ))}
                            </div>

                            {error ? (
                              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-sm text-destructive">
                                {error}
                              </div>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
              </ScrollArea>
            </div>
          </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Loading your comments...</p>
      </div>
    );
  }

  if (appState === 'not-installed') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <DownloadHelperView onRetry={checkSetup} />
      </div>
    );
  }

  if (appState === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-4 text-center">
        <p className="text-sm font-medium text-destructive">Something went wrong</p>
        {errorMessage && <p className="text-sm text-muted-foreground">{errorMessage}</p>}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-primary underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (appState === 'setup') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <SetupView onComplete={() => setAppState('ready')} />
      </div>
    );
  }

  return <ListApp />;
}

export default App;
