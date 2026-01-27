import { useState, useMemo, useRef, type SVGProps } from 'react';
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
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ScrollArea } from '../../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '../../components/ui/tooltip';
import type { Folder } from '../types/clip';

function FolderIcon(props: SVGProps<SVGSVGElement>) {
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
    </svg>
  );
}

function FolderOpenIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function MoreHorizontalIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

function LayersIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    </svg>
  );
}

function InboxIcon(props: SVGProps<SVGSVGElement>) {
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
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

type DropPosition = 'before' | 'inside' | 'after' | null;

type FolderSidebarProps = {
  folders: Folder[];
  selectedFolder: string | null;
  totalThreadCount: number;
  expandedFolders: Set<string>;
  onSelectFolder: (name: string | null) => void;
  onCreateFolder: (name: string, parentId?: string) => Promise<void>;
  onRenameFolder: (oldName: string, newName: string) => Promise<void>;
  onDeleteFolder: (name: string) => Promise<void>;
  onToggleExpanded: (id: string) => void;
  onNestFolder: (folderId: string, targetParentId: string | null) => Promise<void>;
  onReorderFolder: (folderId: string, beforeId?: string, afterId?: string) => Promise<void>;
  // Thread drag-drop props
  activeThreadDrag?: boolean;
  threadDropTargetId?: string | null;
  // Logo slot rendered at the top
  logoSlot?: React.ReactNode;
};

// Overlay drop target for threads
function FolderThreadDropTarget({ folderId, isActive }: { folderId: string; isActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `folder-drop:${folderId}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`absolute inset-0 z-10 rounded-[3px] pointer-events-auto ${
        isOver || isActive ? 'ring-2 ring-primary ring-inset' : ''
      }`}
    />
  );
}

// Collect all folder names from tree
function getAllFolderNames(folders: Folder[]): Set<string> {
  const names = new Set<string>();
  function traverse(items: Folder[]) {
    for (const folder of items) {
      names.add(folder.name.toLowerCase());
      traverse(folder.children);
    }
  }
  traverse(folders);
  return names;
}

// Flatten folder tree for display
function flattenFolders(folders: Folder[], expandedSet: Set<string>): { folder: Folder; depth: number }[] {
  const result: { folder: Folder; depth: number }[] = [];

  function traverse(items: Folder[], depth: number) {
    for (const folder of items) {
      result.push({ folder, depth });
      if (folder.children.length > 0 && expandedSet.has(folder.id)) {
        traverse(folder.children, depth + 1);
      }
    }
  }

  traverse(folders, 0);
  return result;
}

// Find a folder by ID in the tree
function findFolderById(folders: Folder[], id: string): Folder | null {
  for (const folder of folders) {
    if (folder.id === id) return folder;
    const found = findFolderById(folder.children, id);
    if (found) return found;
  }
  return null;
}

// Check if a folder is a descendant of another
function isDescendant(folders: Folder[], folderId: string, ancestorId: string): boolean {
  function findInChildren(children: Folder[]): boolean {
    for (const child of children) {
      if (child.id === folderId) return true;
      if (findInChildren(child.children)) return true;
    }
    return false;
  }

  function findAncestor(items: Folder[]): Folder | null {
    for (const item of items) {
      if (item.id === ancestorId) return item;
      const found = findAncestor(item.children);
      if (found) return found;
    }
    return null;
  }

  const ancestor = findAncestor(folders);
  if (!ancestor) return false;
  return findInChildren(ancestor.children);
}

// Get max depth of a folder subtree
function getMaxDepth(folder: Folder): number {
  if (folder.children.length === 0) return 1;
  return 1 + Math.max(...folder.children.map(getMaxDepth));
}

type DraggableFolderItemProps = {
  folder: Folder;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  dropPosition: DropPosition;
  isDragging: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onRename: () => void;
  onDelete: () => void;
};

function DraggableFolderItem({
  folder,
  depth,
  isSelected,
  isExpanded,
  hasChildren,
  dropPosition,
  isDragging,
  onSelect,
  onToggleExpand,
  onRename,
  onDelete,
}: DraggableFolderItemProps) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging: isDraggingThis } = useDraggable({
    id: folder.id,
  });

  const { setNodeRef: setDropRef } = useDroppable({
    id: folder.id,
  });

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  // Subtle indentation: 10px per nesting level, only for nested items
  const indentPadding = depth > 0 ? depth * 10 : 0;

  return (
    <div
      ref={setNodeRef}
      className={`relative w-full overflow-hidden ${isDragging || isDraggingThis ? 'opacity-40' : ''}`}
    >
      {/* Drop indicator: before */}
      {dropPosition === 'before' && (
        <div className="absolute left-0 right-0 top-0 h-0.5 bg-primary z-10" />
      )}

      {/* Drop indicator: inside */}
      {dropPosition === 'inside' && (
        <div className="absolute inset-0 ring-2 ring-primary ring-inset rounded-[3px] pointer-events-none z-10" />
      )}

      {/* Drop indicator: after */}
      {dropPosition === 'after' && (
        <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary z-10" />
      )}

      <button
        type="button"
        style={{ paddingLeft: 12 + indentPadding }}
        className={`group relative flex w-full min-w-0 items-center gap-2 rounded-[3px] pr-3 py-2 text-sm overflow-hidden ${
          isSelected
            ? 'bg-primary/15 text-foreground'
            : 'text-foreground/80 hover:bg-accent/40 hover:text-foreground'
        }`}
        onClick={onSelect}
        {...attributes}
        {...listeners}
      >
        {/* Expand/collapse chevron - positioned in left padding area */}
        {hasChildren && (
          <span
            role="button"
            tabIndex={0}
            className="absolute -left-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-accent/60"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onToggleExpand();
              }
            }}
          >
            <ChevronRightIcon
              className={`h-3 w-3 ${isExpanded ? 'rotate-90' : ''}`}
            />
          </span>
        )}

        {isSelected ? (
          <FolderOpenIcon className="h-4 w-4 text-foreground shrink-0" />
        ) : (
          <FolderIcon className="h-4 w-4 text-muted-foreground group-hover:text-foreground/70 shrink-0" />
        )}

        <span className="flex-1 min-w-0 truncate text-left">{folder.name}</span>

        {/* Right side - fixed width container for count/menu */}
        <div className="relative w-8 shrink-0 flex items-center justify-end">
          <span
            className={`text-xs tabular-nums group-hover:opacity-0 ${
              isSelected ? 'text-foreground/70' : 'text-muted-foreground'
            }`}
          >
            {folder.threadCount}
          </span>

          {/* Three-dot menu - overlays count on hover */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                role="button"
                tabIndex={0}
                className={`absolute inset-0 flex items-center justify-end opacity-0 group-hover:opacity-50 hover:!opacity-100`}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                  }
                }}
              >
                <div className={`p-1 rounded-md ${isSelected ? 'hover:bg-accent-foreground/10' : 'hover:bg-accent/60'}`}>
                  <MoreHorizontalIcon className="h-3.5 w-3.5" />
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[120px]">
              <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </button>
    </div>
  );
}

function FolderDragPreview({ folder }: { folder: Folder }) {
  return (
    <div className="flex items-center gap-2 rounded-[3px] bg-background border border-border px-3 py-2 text-sm shadow-lg">
      <FolderIcon className="h-4 w-4" />
      <span>{folder.name}</span>
    </div>
  );
}

export function FolderSidebar({
  folders,
  selectedFolder,
  totalThreadCount,
  expandedFolders,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onToggleExpanded,
  onNestFolder,
  onReorderFolder,
  activeThreadDrag,
  threadDropTargetId,
  logoSlot,
}: FolderSidebarProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingName, setRenamingName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  // Get all existing folder names for duplicate checking
  const existingNames = useMemo(() => getAllFolderNames(folders), [folders]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition>(null);

  // Track mouse Y position during drag
  const mouseYRef = useRef<number>(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    // Check for duplicate name
    if (existingNames.has(trimmed.toLowerCase())) {
      setFolderError('A folder with this name already exists');
      return;
    }

    setCreating(true);
    setFolderError(null);
    try {
      await onCreateFolder(trimmed);
      setNewFolderName('');
      setCreateDialogOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const handleRenameFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || !renamingName) return;

    // Check for duplicate name (but allow keeping the same name)
    if (trimmed.toLowerCase() !== renamingName.toLowerCase() && existingNames.has(trimmed.toLowerCase())) {
      setFolderError('A folder with this name already exists');
      return;
    }

    setRenaming(true);
    setFolderError(null);
    try {
      await onRenameFolder(renamingName, trimmed);
      setNewFolderName('');
      setRenamingName(null);
      setRenameDialogOpen(false);
    } finally {
      setRenaming(false);
    }
  };

  const openRenameDialog = (name: string) => {
    setRenamingName(name);
    setNewFolderName(name);
    setFolderError(null);
    setRenameDialogOpen(true);
  };

  const openCreateDialog = () => {
    setNewFolderName('');
    setFolderError(null);
    setCreateDialogOpen(true);
  };

  // Separate Uncategorized from other folders
  const uncategorizedFolder = folders.find((f) => f.name === 'Uncategorized');
  const userFolders = folders.filter((f) => f.name !== 'Uncategorized');

  // Flatten for display
  const flattenedFolders = useMemo(
    () => flattenFolders(userFolders, expandedFolders),
    [userFolders, expandedFolders]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    // Track the current pointer position
    const pointerEvent = event.activatorEvent as PointerEvent;
    if (pointerEvent) {
      mouseYRef.current = pointerEvent.clientY + (event.delta?.y ?? 0);
    }

    const { over } = event;
    if (!over) {
      setOverId(null);
      setDropPosition(null);
      return;
    }

    const currentOverId = over.id as string;
    setOverId(currentOverId);

    // Get the over element's bounding rect
    const overElement = document.querySelector(`[data-folder-id="${currentOverId}"]`);
    if (!overElement) {
      setDropPosition(null);
      return;
    }

    const rect = overElement.getBoundingClientRect();
    const mouseY = mouseYRef.current;
    const relativeY = mouseY - rect.top;
    const ratio = relativeY / rect.height;

    const activeFolder = findFolderById(folders, activeId!);
    const overFolder = findFolderById(folders, currentOverId);

    if (!activeFolder || !overFolder) {
      setDropPosition(null);
      return;
    }

    // Check constraints
    const isSelf = activeId === currentOverId;
    const isDescendantOfActive = isDescendant(folders, currentOverId, activeId!);
    const canNestInside =
      overFolder.level < 3 && overFolder.level + getMaxDepth(activeFolder) <= 3;

    if (isSelf || isDescendantOfActive) {
      setDropPosition(null);
      return;
    }

    // Determine drop position based on mouse position within the element
    if (ratio < 0.3) {
      setDropPosition('before');
    } else if (ratio > 0.7) {
      setDropPosition('after');
    } else if (canNestInside) {
      setDropPosition('inside');
    } else {
      setDropPosition(ratio < 0.5 ? 'before' : 'after');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over } = event;

    const finalDropPosition = dropPosition;
    const finalOverId = overId;

    setActiveId(null);
    setOverId(null);
    setDropPosition(null);

    if (!over || !finalOverId || !finalDropPosition || activeId === finalOverId) return;

    try {
      if (finalDropPosition === 'inside') {
        await onNestFolder(activeId!, finalOverId);
      } else if (finalDropPosition === 'before' || finalDropPosition === 'after') {
        // When dropping before/after a folder, use the TARGET's parent
        // so the dragged folder becomes a sibling, not moved to root
        const targetFolder = findFolderById(folders, finalOverId);
        const targetParentId = targetFolder?.parentId ?? null;
        await onNestFolder(activeId!, targetParentId);
        if (finalDropPosition === 'before') {
          await onReorderFolder(activeId!, finalOverId, undefined);
        } else {
          await onReorderFolder(activeId!, undefined, finalOverId);
        }
      }
    } catch (err) {
      console.error('Failed to move folder:', err);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
    setDropPosition(null);
  };

  const activeFolder = activeId ? findFolderById(folders, activeId) : null;

  return (
    <div className="flex flex-col w-56 border-r bg-muted/20 overflow-hidden">
      {/* Header: Logo + Collections + New folder button */}
      <TooltipProvider delayDuration={0}>
        <div className="flex items-center h-12 px-3 border-b border-border/50 gap-2">
          {logoSlot}
          <span className="text-sm font-medium text-foreground/80 flex-1">Collections</span>
          <Dialog open={createDialogOpen} onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) setFolderError(null);
          }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>New folder</p>
              </TooltipContent>
            </Tooltip>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => {
                    setNewFolderName(e.target.value);
                    setFolderError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleCreateFolder();
                    }
                  }}
                  autoFocus
                />
                {folderError && (
                  <p className="text-sm text-destructive">{folderError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNewFolderName('');
                      setFolderError(null);
                      setCreateDialogOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateFolder} disabled={creating || !newFolderName.trim()}>
                    {creating ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>

      <ScrollArea className="flex-1 w-full min-w-0">
        <div className="py-2 px-2 w-full overflow-hidden">
          {/* All - Primary */}
          <button
            type="button"
            style={{ paddingLeft: 12 }}
            className={`group relative flex w-full items-center gap-2 rounded-[3px] pr-3 py-2 text-sm cursor-pointer overflow-hidden ${
              selectedFolder === null
                ? 'bg-primary/15 text-foreground'
                : 'text-foreground/80 hover:bg-accent/40 hover:text-foreground'
            }`}
            onClick={() => onSelectFolder(null)}
          >
            <LayersIcon
              className={`h-4 w-4 ${
                selectedFolder === null ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground/70'
              }`}
            />
            <span className="flex-1 min-w-0 truncate text-left font-medium">All</span>
            <div className="w-8 shrink-0 flex items-center justify-end">
              <span
                className={`text-xs tabular-nums ${
                  selectedFolder === null ? 'text-foreground/70' : 'text-muted-foreground'
                }`}
              >
                {totalThreadCount}
              </span>
            </div>
          </button>

          {/* Uncategorized - Secondary */}
          {uncategorizedFolder && activeThreadDrag ? (
            <div className="relative w-full">
              <FolderThreadDropTarget
                folderId="uncategorized"
                isActive={threadDropTargetId === 'folder-drop:uncategorized'}
              />
              <button
                type="button"
                style={{ paddingLeft: 12 }}
                className={`group relative flex w-full items-center gap-2 rounded-[3px] pr-3 py-2 text-sm cursor-pointer overflow-hidden ${
                  selectedFolder === 'Uncategorized'
                    ? 'bg-primary/15 text-foreground'
                    : 'text-foreground/80 hover:bg-accent/40 hover:text-foreground'
                }`}
                onClick={() => onSelectFolder('Uncategorized')}
              >
                <InboxIcon
                  className={`h-4 w-4 ${
                    selectedFolder === 'Uncategorized'
                      ? 'text-foreground'
                      : 'text-muted-foreground group-hover:text-foreground/70'
                  }`}
                />
                <span className="flex-1 min-w-0 truncate text-left">Unsorted</span>
                <div className="w-8 shrink-0 flex items-center justify-end">
                  <span
                    className={`text-xs tabular-nums ${
                      selectedFolder === 'Uncategorized' ? 'text-foreground/70' : 'text-muted-foreground'
                    }`}
                  >
                    {uncategorizedFolder.threadCount}
                  </span>
                </div>
              </button>
            </div>
          ) : uncategorizedFolder ? (
            <button
              type="button"
              style={{ paddingLeft: 12 }}
              className={`group relative flex w-full items-center gap-2 rounded-[3px] pr-3 py-2 text-sm cursor-pointer overflow-hidden ${
                selectedFolder === 'Uncategorized'
                  ? 'bg-primary/15 text-foreground'
                  : 'text-foreground/80 hover:bg-accent/40 hover:text-foreground'
              }`}
              onClick={() => onSelectFolder('Uncategorized')}
            >
              <InboxIcon
                className={`h-4 w-4 ${
                  selectedFolder === 'Uncategorized'
                    ? 'text-foreground'
                    : 'text-muted-foreground group-hover:text-foreground/70'
                }`}
              />
              <span className="flex-1 min-w-0 truncate text-left">Unsorted</span>
              <div className="w-8 shrink-0 flex items-center justify-end">
                <span
                  className={`text-xs tabular-nums ${
                    selectedFolder === 'Uncategorized' ? 'text-foreground/70' : 'text-muted-foreground'
                  }`}
                >
                  {uncategorizedFolder.threadCount}
                </span>
              </div>
            </button>
          ) : null}

          {/* Divider */}
          {userFolders.length > 0 && <div className="my-2 mx-3 border-t border-border/40" />}

          {/* User Folders with Drag and Drop */}
          {/*
            CRITICAL: When dragging a THREAD, we must NOT wrap folders in the inner DndContext.
            Otherwise FolderThreadDropTarget registers with the inner context instead of
            the outer context (App.tsx), and thread-to-folder drops won't work.
          */}
          {activeThreadDrag ? (
            // Thread drag mode: NO inner DndContext - drop targets register with outer context
            flattenedFolders.map(({ folder, depth }) => (
              <div key={folder.id} className="relative w-full">
                <FolderThreadDropTarget
                  folderId={folder.id}
                  isActive={threadDropTargetId === `folder-drop:${folder.id}`}
                />
                <button
                  type="button"
                  style={{ paddingLeft: 12 + (depth > 0 ? depth * 10 : 0) }}
                  className={`group relative flex w-full items-center gap-2 rounded-[3px] pr-3 py-2 text-sm cursor-pointer overflow-hidden ${
                    selectedFolder === folder.name
                      ? 'bg-primary/15 text-foreground'
                      : 'text-foreground/80 hover:bg-accent/40 hover:text-foreground'
                  }`}
                  onClick={() => onSelectFolder(folder.name)}
                >
                  {folder.children.length > 0 && (
                    <span
                      role="button"
                      tabIndex={0}
                      className="absolute -left-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-accent/60"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpanded(folder.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          onToggleExpanded(folder.id);
                        }
                      }}
                    >
                      <ChevronRightIcon
                        className={`h-3 w-3 ${expandedFolders.has(folder.id) ? 'rotate-90' : ''}`}
                      />
                    </span>
                  )}
                  {selectedFolder === folder.name ? (
                    <FolderOpenIcon className="h-4 w-4 text-foreground shrink-0" />
                  ) : (
                    <FolderIcon className="h-4 w-4 text-muted-foreground group-hover:text-foreground/70 shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 truncate text-left">{folder.name}</span>
                  <div className="w-8 shrink-0 flex items-center justify-end">
                    <span
                      className={`text-xs tabular-nums ${
                        selectedFolder === folder.name ? 'text-foreground/70' : 'text-muted-foreground'
                      }`}
                    >
                      {folder.threadCount}
                    </span>
                  </div>
                </button>
              </div>
            ))
          ) : (
            // Normal mode: inner DndContext for folder reordering
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              {flattenedFolders.map(({ folder, depth }) => (
                <div key={folder.id} data-folder-id={folder.id} className="relative w-full overflow-hidden">
                  <DraggableFolderItem
                    folder={folder}
                    depth={depth}
                    isSelected={selectedFolder === folder.name}
                    isExpanded={expandedFolders.has(folder.id)}
                    hasChildren={folder.children.length > 0}
                    dropPosition={overId === folder.id ? dropPosition : null}
                    isDragging={activeId === folder.id}
                    onSelect={() => onSelectFolder(folder.name)}
                    onToggleExpand={() => onToggleExpanded(folder.id)}
                    onRename={() => openRenameDialog(folder.name)}
                    onDelete={() => onDeleteFolder(folder.name)}
                  />
                </div>
              ))}
              <DragOverlay dropAnimation={null}>
                {activeFolder && <FolderDragPreview folder={activeFolder} />}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </ScrollArea>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={(open) => {
        setRenameDialogOpen(open);
        if (!open) setFolderError(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="New folder name"
              value={newFolderName}
              onChange={(e) => {
                setNewFolderName(e.target.value);
                setFolderError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleRenameFolder();
                }
              }}
              autoFocus
            />
            {folderError && (
              <p className="text-sm text-destructive">{folderError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setNewFolderName('');
                  setRenamingName(null);
                  setFolderError(null);
                  setRenameDialogOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleRenameFolder} disabled={renaming || !newFolderName.trim()}>
                {renaming ? 'Renaming...' : 'Rename'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
