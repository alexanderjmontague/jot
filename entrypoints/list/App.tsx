import { useCallback, useEffect, useMemo, useState, useRef, type SVGProps } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { useColorScheme } from '../../src/shared/hooks/useColorScheme';
import { Button } from '../../src/components/ui/button';
import { Card, CardContent } from '../../src/components/ui/card';
import { Input } from '../../src/components/ui/input';
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
  nestFolder as nestFolderApi,
  reorderFolder as reorderFolderApi,
  importBookmarks,
  type ClipThread,
  type Folder,
  type ImportBookmark,
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
import { Loader2, RefreshCw, Settings, CheckCircle2, AlertCircle, Globe, AlertTriangle, Github, GripVertical } from 'lucide-react';
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

const PREVIEW_FRAME_ASPECT = 1.2;
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

function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Drag preview for threads
function ThreadDragPreview({ thread }: { thread: ClipThread }) {
  const displayTitle = thread.title?.trim() || formatDisplayUrl(thread.url);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-background border border-border px-3 py-2 text-sm shadow-lg max-w-[280px]">
      {thread.faviconUrl ? (
        <img src={thread.faviconUrl} alt="" className="size-4 shrink-0" referrerPolicy="no-referrer" />
      ) : (
        <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate">{displayTitle}</span>
    </div>
  );
}

type DropPosition = 'before' | 'after' | null;

// Draggable thread wrapper - also acts as drop target for reordering
type DraggableThreadCardProps = {
  thread: ClipThread;
  children: React.ReactNode;
  isDragDisabled?: boolean;
  dropPosition: DropPosition;
};

function DraggableThreadCard({ thread, children, isDragDisabled, dropPosition }: DraggableThreadCardProps) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `thread:${thread.url}`,
    data: { type: 'thread', thread },
    disabled: isDragDisabled,
  });

  const { setNodeRef: setDropRef } = useDroppable({
    id: `thread-drop:${thread.url}`,
  });

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  return (
    <div
      ref={setNodeRef}
      data-thread-url={thread.url}
      className={`group/drag relative ${isDragging ? 'opacity-30' : ''}`}
    >
      {/* Drop indicator: before */}
      {dropPosition === 'before' && (
        <div className="absolute left-0 right-0 -top-px h-[3px] bg-blue-500 z-20 rounded-full" />
      )}

      {/* Drop indicator: after */}
      {dropPosition === 'after' && (
        <div className="absolute left-0 right-0 -bottom-px h-[3px] bg-blue-500 z-20 rounded-full" />
      )}

      {/* Drag handle - visible on hover */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-1 opacity-0 group-hover/drag:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="size-4 text-muted-foreground/50 hover:text-muted-foreground" />
      </div>
      {children}
    </div>
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

  const reorderThread = useCallback(
    (sourceUrl: string, targetUrl: string, position: 'before' | 'after') => {
      setThreads((prev) => {
        const sourceIndex = prev.findIndex((t) => t.url === sourceUrl);
        const targetIndex = prev.findIndex((t) => t.url === targetUrl);
        if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
          return prev;
        }

        const next = prev.slice();
        const [removed] = next.splice(sourceIndex, 1);

        // Recalculate target index after removal
        let insertIndex = targetIndex;
        if (sourceIndex < targetIndex) {
          insertIndex -= 1;
        }
        if (position === 'after') {
          insertIndex += 1;
        }

        next.splice(insertIndex, 0, removed);
        return next;
      });
    },
    [setThreads],
  );

  return { threads, loading, refreshing, refresh, replaceThread, removeThread, reorderThread };
}

type SettingsStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';
type ImportStatus = 'idle' | 'confirming' | 'importing' | 'done' | 'error';

type ChromeBookmarkNode = {
  id: string;
  title: string;
  url?: string;
  children?: ChromeBookmarkNode[];
};

function flattenChromeBookmarks(nodes: ChromeBookmarkNode[]): ImportBookmark[] {
  const results: ImportBookmark[] = [];
  const topLevelContainers = new Set(['Bookmarks Bar', 'Other Bookmarks', 'Mobile Bookmarks', 'Other bookmarks', 'Mobile bookmarks']);

  function traverse(children: ChromeBookmarkNode[], folderPath: string[], depth: number) {
    for (const node of children) {
      if (node.url) {
        // It's a bookmark - filter non-http(s) URLs
        if (!node.url.startsWith('http://') && !node.url.startsWith('https://')) {
          continue;
        }

        let folder = 'Uncategorized';
        if (folderPath.length > 0) {
          // Max 3 levels of folder path
          folder = folderPath.slice(0, 3).join('/');
        }

        let faviconUrl: string | undefined;
        try {
          const domain = new URL(node.url).hostname;
          faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        } catch {
          // skip favicon
        }

        results.push({
          url: node.url,
          title: node.title || undefined,
          faviconUrl,
          folder,
        });
      } else if (node.children) {
        // It's a folder
        if (depth === 0 && topLevelContainers.has(node.title)) {
          // Skip top-level containers as folder names, just traverse children
          traverse(node.children, folderPath, depth + 1);
        } else {
          // Flatten at max 3 levels
          const newPath = folderPath.length < 3
            ? [...folderPath, node.title]
            : folderPath;
          traverse(node.children, newPath, depth + 1);
        }
      }
    }
  }

  traverse(nodes, [], 0);
  return results;
}

function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [fullPath, setFullPath] = useState('');
  const [status, setStatus] = useState<SettingsStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  // Import state
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importBookmarksList, setImportBookmarksList] = useState<ImportBookmark[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

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
      setImportStatus('idle');
      setImportBookmarksList([]);
      setImportResult(null);
      setImportError(null);
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

  const handleImportClick = async () => {
    setImportError(null);
    setImportResult(null);
    try {
      const tree = await chrome.bookmarks.getTree();
      const root = tree[0]?.children ?? [];
      const mapped = flattenChromeBookmarks(root);
      if (mapped.length === 0) {
        setImportError('No importable bookmarks found (only http/https URLs are imported).');
        return;
      }
      setImportBookmarksList(mapped);
      setImportStatus('confirming');
    } catch (err) {
      console.error('Failed to read Chrome bookmarks', err);
      setImportError('Failed to read Chrome bookmarks. Make sure the extension has the bookmarks permission.');
    }
  };

  const handleImportConfirm = async () => {
    setImportStatus('importing');
    setImportError(null);
    try {
      const result = await importBookmarks(importBookmarksList);
      setImportResult(result);
      setImportStatus('done');
    } catch (err) {
      console.error('Import failed', err);
      setImportError(err instanceof Error ? err.message : 'Import failed');
      setImportStatus('error');
    }
  };

  const handleImportCancel = () => {
    setImportStatus('idle');
    setImportBookmarksList([]);
    setImportError(null);
    setImportResult(null);
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
                <p className="flex items-start gap-1.5 text-xs text-yellow-600 dark:text-yellow-500">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  <span>Changing this doesn't move the existing folder. Move it first, then update the path here.</span>
                </p>
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

              {/* Import Chrome Bookmarks */}
              <div className="border-t border-border pt-4 mt-2 space-y-2">
                <Label>Import</Label>
                {importStatus === 'idle' && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleImportClick}
                  >
                    Import Chrome Bookmarks
                  </Button>
                )}

                {importStatus === 'confirming' && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Import {importBookmarksList.length} bookmark{importBookmarksList.length !== 1 ? 's' : ''} from Chrome?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={handleImportConfirm}
                      >
                        Import
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleImportCancel}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {importStatus === 'importing' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Importing bookmarks...</span>
                  </div>
                )}

                {importStatus === 'done' && importResult && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        Imported {importResult.imported} bookmark{importResult.imported !== 1 ? 's' : ''}
                        {importResult.skipped > 0 && `, skipped ${importResult.skipped} duplicate${importResult.skipped !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleImportCancel}
                    >
                      Done
                    </Button>
                  </div>
                )}

                {(importStatus === 'error' || importError) && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{importError}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleImportCancel}
                    >
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <a
                  href="https://github.com/alexanderjmontague/jot"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Github className="size-3" />
                  <span>GitHub</span>
                </a>
                <a
                  href="https://x.com/axmont"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <XIcon className="size-2.5" />
                  <span>Built by @axmont</span>
                </a>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ListApp() {
  const { threads, loading, refreshing, refresh, replaceThread, removeThread, reorderThread } = useThreads();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilterId, setActiveFilterId] = useState('all');
  const [errors, setErrors] = useState<ThreadErrors>({});
  const [faviconFailures, setFaviconFailures] = useState<FaviconFailures>({});
  const [previewFailures, setPreviewFailures] = useState<PreviewFailures>({});
  const [previewFits, setPreviewFits] = useState<PreviewFits>({});

  // Drag and drop state
  const [activeThreadUrl, setActiveThreadUrl] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [threadDropPosition, setThreadDropPosition] = useState<DropPosition>(null);
  const mouseYRef = useRef<number>(0);

  // Track actual pointer position via pointermove during drag (more accurate than delta calculation)
  useEffect(() => {
    if (!activeThreadUrl) return;

    const handlePointerMove = (e: PointerEvent) => {
      mouseYRef.current = e.clientY;
    };

    document.addEventListener('pointermove', handlePointerMove);
    return () => document.removeEventListener('pointermove', handlePointerMove);
  }, [activeThreadUrl]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Folder state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null); // null = "All"
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Load from localStorage
    try {
      const saved = localStorage.getItem('jot-expanded-folders');
      if (saved) {
        return new Set(JSON.parse(saved) as string[]);
      }
    } catch {
      // ignore
    }
    return new Set<string>();
  });

  // Load folders
  useEffect(() => {
    void getFolders().then(setFolders);
  }, []);

  // Reload folders when threads change (thread counts may have changed)
  useEffect(() => {
    void getFolders().then(setFolders);
  }, [threads]);

  // Auto-refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refresh]);

  const handleCreateFolder = useCallback(async (name: string, parentId?: string) => {
    const updated = await createFolder(name, parentId);
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

  const handleToggleExpanded = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      // Persist to localStorage
      localStorage.setItem('jot-expanded-folders', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleNestFolder = useCallback(async (folderId: string, targetParentId: string | null) => {
    try {
      const updated = await nestFolderApi(folderId, targetParentId);
      setFolders(updated);
    } catch (err) {
      console.error('Failed to nest folder', err);
    }
  }, []);

  const handleReorderFolder = useCallback(async (folderId: string, beforeId?: string, afterId?: string) => {
    try {
      const updated = await reorderFolderApi(folderId, beforeId, afterId);
      setFolders(updated);
    } catch (err) {
      console.error('Failed to reorder folder', err);
    }
  }, []);

  // Thread drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;
    if (activeId.startsWith('thread:')) {
      setActiveThreadUrl(activeId.replace('thread:', ''));
    }
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { over } = event;
    // Mouse position is tracked via pointermove listener (more accurate for tall elements)

    if (!over) {
      setDropTargetId(null);
      setThreadDropPosition(null);
      return;
    }

    const overId = over.id as string;
    setDropTargetId(overId);

    // Calculate drop position for thread reordering
    if (overId.startsWith('thread-drop:')) {
      const threadUrl = overId.replace('thread-drop:', '');
      const overElement = document.querySelector(`[data-thread-url="${CSS.escape(threadUrl)}"]`);
      if (!overElement) {
        setThreadDropPosition(null);
        return;
      }

      const rect = overElement.getBoundingClientRect();
      const mouseY = mouseYRef.current;
      const relativeY = mouseY - rect.top;
      const ratio = relativeY / rect.height;

      // Don't show drop position on self
      if (threadUrl === activeThreadUrl) {
        setThreadDropPosition(null);
        return;
      }

      // Top half = before, bottom half = after
      setThreadDropPosition(ratio < 0.5 ? 'before' : 'after');
    } else {
      setThreadDropPosition(null);
    }
  }, [activeThreadUrl]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id as string;
    const finalDropPosition = threadDropPosition;

    setActiveThreadUrl(null);
    setDropTargetId(null);
    setThreadDropPosition(null);

    if (!over || !activeId.startsWith('thread:')) return;

    const threadUrl = activeId.replace('thread:', '');
    const overId = over.id as string;

    // Dropped on a folder in sidebar
    if (overId.startsWith('folder-drop:')) {
      const folderName = overId.replace('folder-drop:', '');
      await handleMoveThread(threadUrl, folderName);
      return;
    }

    // Dropped on another thread for reordering
    if (overId.startsWith('thread-drop:') && finalDropPosition) {
      const targetThreadUrl = overId.replace('thread-drop:', '');
      reorderThread(threadUrl, targetThreadUrl, finalDropPosition);
    }
  }, [handleMoveThread, threadDropPosition, reorderThread]);

  const handleDragCancel = useCallback(() => {
    setActiveThreadUrl(null);
    setDropTargetId(null);
    setThreadDropPosition(null);
  }, []);

  // Get the active thread for drag preview
  const activeThread = useMemo(() => {
    if (!activeThreadUrl) return null;
    return threads.find((t) => t.url === activeThreadUrl) ?? null;
  }, [activeThreadUrl, threads]);

  // Disable thread dragging when filtering/searching
  const isDragDisabled = Boolean(searchTerm.trim());

  // Memoize flattened folders for dropdown to avoid recalculating on every render
  const flattenedFolders = useMemo(() => flattenFoldersForDropdown(folders), [folders]);

  // Filter by folder first
  const filteredByFolder = useMemo(() => {
    if (selectedFolder === null) {
      return threads; // "All" - show everything
    }
    return threads.filter((thread) => thread.folder === selectedFolder);
  }, [threads, selectedFolder]);

  // Check if domain filter bar should be visible (based on all threads, not filtered)
  const showDomainFilter = useMemo(() => {
    const groups = new Map<string, number>();
    threads.forEach((thread) => {
      const base = getBaseDomainInfo(thread.url);
      if (!base) return;
      groups.set(base.key, (groups.get(base.key) ?? 0) + 1);
    });
    // Show if any domain has more than one thread
    return Array.from(groups.values()).some((count) => count > 1);
  }, [threads]);

  // Calculate counts based on folder-filtered threads
  const filters = useMemo(() => {
    const groups = new Map<string, { label: string; count: number }>();

    filteredByFolder.forEach((thread) => {
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

    return [{ id: 'all', label: 'All sites', count: filteredByFolder.length }, ...domainFilters];
  }, [filteredByFolder]);

  useEffect(() => {
    if (activeFilterId !== 'all' && !filters.some((option) => option.id === activeFilterId)) {
      setActiveFilterId('all');
    }
  }, [filters, activeFilterId]);

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

  // Logo element to pass to sidebar
  const logoElement = (
    <button
      type="button"
      onClick={() => setSelectedFolder(null)}
      className="flex items-center shrink-0 rounded-md hover:bg-accent/50 transition-colors"
    >
      <img
        src="/logo.svg"
        alt="Jot"
        className="select-none"
        style={{ width: 28, height: 28 }}
        draggable={false}
      />
    </button>
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <TooltipProvider delayDuration={0}>
        <div className="flex h-screen overflow-hidden bg-muted/20">
          {/* Full-height sidebar with logo */}
          <FolderSidebar
            folders={folders}
            selectedFolder={selectedFolder}
            totalThreadCount={threads.length}
            expandedFolders={expandedFolders}
            onSelectFolder={setSelectedFolder}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onToggleExpanded={handleToggleExpanded}
            onNestFolder={handleNestFolder}
            onReorderFolder={handleReorderFolder}
            activeThreadDrag={Boolean(activeThreadUrl)}
            threadDropTargetId={dropTargetId}
            logoSlot={logoElement}
          />

          {/* Right column: nav bar + main content */}
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            {/* Top navbar (no logo) */}
            <nav className="shrink-0 flex w-full items-center gap-4 h-12 border-b border-border bg-background px-3">
              {/* Search bar */}
              <div className={`flex flex-1 items-center gap-2 px-1 py-1 text-muted-foreground transition-all border-b ${searchTerm ? 'border-border/60' : 'border-transparent'} hover:border-border/40 focus-within:border-border`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground/40">
                  <path d="m21 21-4.34-4.34"/>
                  <circle cx="11" cy="11" r="8"/>
                </svg>
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-auto w-full rounded-none border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 ring-offset-transparent"
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
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

            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="mx-auto w-full max-w-4xl px-4 py-6">
                {loading ? <p className="text-sm text-muted-foreground">Loading comments...</p> : null}

                {/* Domain filters - visible if any domain has multiple threads globally */}
                {showDomainFilter && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2 mb-3">
                    {filters.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${option.id === activeFilterId ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground/60 hover:bg-accent hover:text-accent-foreground'}`}
                        aria-pressed={option.id === activeFilterId}
                        onClick={() => setActiveFilterId(option.id)}
                      >
                        <Globe className="size-2.5" />
                        <span className="whitespace-nowrap">{option.label}</span>
                        <span className="text-[9px] font-medium">{option.count}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="pb-6">
              {showEmptyState ? (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-lg px-6 py-16 text-center text-muted-foreground">
                  <h2 className="text-lg font-semibold text-muted-foreground">{emptyStateContent.title}</h2>
                  <p className="text-sm">{emptyStateContent.description}</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border/30">
                  {displayThreads.map((thread) => {
                    const error = errors[thread.url] ?? null;
                    const displayTitle = getThreadDisplayTitle(thread);
                    const showFavicon = Boolean(thread.faviconUrl && !faviconFailures[thread.url]);
                    const showPreview = Boolean(thread.previewImageUrl && !previewFailures[thread.url]);
                    const displayUrl = formatDisplayUrl(thread.url);
                    const previewFrameClass = showPreview ? 'bg-muted/50' : 'bg-muted/80 dark:bg-muted/60';
                    const currentFit = previewFits[thread.url] ?? 'contain';
                    const previewObjectClass = currentFit === 'cover' ? 'object-cover' : 'object-contain';
                    // Calculate drop position for this specific thread
                    const isDropTarget = dropTargetId === `thread-drop:${thread.url}`;
                    const thisDropPosition = isDropTarget ? threadDropPosition : null;

                    return (
                      <DraggableThreadCard
                        key={thread.url}
                        thread={thread}
                        isDragDisabled={isDragDisabled}
                        dropPosition={thisDropPosition}
                      >
                        <Card className="rounded-none border-0 bg-transparent shadow-none">
                          <CardContent className="flex min-w-0 items-start gap-4 px-0 py-6">
                          <a
                            href={thread.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex aspect-[6/5] h-[50px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/15 dark:border-white/10 ${previewFrameClass}`}
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
                                  <DropdownMenuContent align="end" className="max-w-[200px]">
                                    {flattenedFolders.map(({ folder, depth }) => (
                                      <DropdownMenuItem
                                        key={folder.id}
                                        onClick={() => handleMoveThread(thread.url, folder.name)}
                                        disabled={thread.folder === folder.name}
                                        className="overflow-hidden"
                                      >
                                        {depth > 0 && (
                                          <span className="text-muted-foreground/50 shrink-0" style={{ marginLeft: (depth - 1) * 10 }}>
                                            └
                                          </span>
                                        )}
                                        <span className="min-w-0 flex-1 truncate">
                                          {folder.name}
                                          {thread.folder === folder.name && ' (current)'}
                                        </span>
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
                            {thread.comments.length > 0 && (
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
                            )}

                            {error ? (
                              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-sm text-destructive">
                                {error}
                              </div>
                            ) : null}
                            </div>
                          </CardContent>
                        </Card>
                      </DraggableThreadCard>
                    );
                  })}
                </div>
              )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </TooltipProvider>
      <DragOverlay dropAnimation={null}>
        {activeThread && <ThreadDragPreview thread={activeThread} />}
      </DragOverlay>
    </DndContext>
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
