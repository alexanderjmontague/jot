import { useState, useMemo, type SVGProps } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

function PanelLeftCloseIcon(props: SVGProps<SVGSVGElement>) {
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
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 15-3-3 3-3" />
    </svg>
  );
}

function PanelLeftOpenIcon(props: SVGProps<SVGSVGElement>) {
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
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
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
  selectedFolder: string | null; // null means "All"
  collapsed: boolean;
  totalThreadCount: number;
  expandedFolders: Set<string>;
  onSelectFolder: (name: string | null) => void;
  onCreateFolder: (name: string, parentId?: string) => Promise<void>;
  onRenameFolder: (oldName: string, newName: string) => Promise<void>;
  onDeleteFolder: (name: string) => Promise<void>;
  onToggleCollapsed: () => void;
  onToggleExpanded: (id: string) => void;
  onNestFolder: (folderId: string, targetParentId: string | null) => Promise<void>;
  onReorderFolder: (folderId: string, beforeId?: string, afterId?: string) => Promise<void>;
};

// Flatten folder tree for sortable context
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

// Find a folder by ID in the tree
function findFolderById(folders: Folder[], id: string): Folder | null {
  for (const folder of folders) {
    if (folder.id === id) return folder;
    const found = findFolderById(folder.children, id);
    if (found) return found;
  }
  return null;
}

type SortableFolderItemProps = {
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

function SortableFolderItem({
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
}: SortableFolderItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: folder.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${12 + depth * 16}px`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? 'opacity-50' : ''}`}
      {...attributes}
    >
      {/* Drop indicator: before */}
      {dropPosition === 'before' && (
        <div className="absolute left-0 right-0 top-0 h-0.5 bg-primary" />
      )}

      {/* Drop indicator: inside */}
      {dropPosition === 'inside' && (
        <div className="absolute inset-0 ring-2 ring-primary ring-inset rounded-lg pointer-events-none" />
      )}

      <button
        type="button"
        className={`group relative flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer transition-colors ${
          isSelected
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground/80 hover:bg-accent/40 hover:text-foreground'
        }`}
        onClick={onSelect}
        {...listeners}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <button
            type="button"
            className="p-0.5 -ml-1 rounded hover:bg-accent/60 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            <ChevronRightIcon
              className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span className="w-4" />
        )}

        {isSelected ? (
          <FolderOpenIcon className="h-4 w-4 text-foreground shrink-0" />
        ) : (
          <FolderIcon className="h-4 w-4 text-muted-foreground group-hover:text-foreground/70 shrink-0" />
        )}

        <span className="flex-1 truncate text-left">{folder.name}</span>

        <span
          className={`text-xs tabular-nums transition-opacity ${
            isSelected ? 'text-accent-foreground/70' : 'text-muted-foreground group-hover:opacity-0'
          }`}
        >
          {folder.threadCount}
        </span>

        {/* Three-dot menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              className={`absolute right-2 p-1 rounded-md transition-opacity ${
                isSelected
                  ? 'opacity-50 hover:opacity-100 hover:bg-accent-foreground/10'
                  : 'opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:bg-accent/60'
              }`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                }
              }}
            >
              <MoreHorizontalIcon className="h-3.5 w-3.5" />
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
      </button>

      {/* Drop indicator: after */}
      {dropPosition === 'after' && (
        <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary" />
      )}
    </div>
  );
}

function FolderDragPreview({ folder }: { folder: Folder }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm shadow-lg">
      <FolderIcon className="h-4 w-4" />
      <span>{folder.name}</span>
    </div>
  );
}

export function FolderSidebar({
  folders,
  selectedFolder,
  collapsed,
  totalThreadCount,
  expandedFolders,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onToggleCollapsed,
  onToggleExpanded,
  onNestFolder,
  onReorderFolder,
}: FolderSidebarProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingName, setRenamingName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    setCreating(true);
    try {
      await onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setCreateDialogOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const handleRenameFolder = async () => {
    if (!newFolderName.trim() || !renamingName) return;

    setRenaming(true);
    try {
      await onRenameFolder(renamingName, newFolderName.trim());
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
    setRenameDialogOpen(true);
  };

  // Separate Uncategorized from other folders
  const uncategorizedFolder = folders.find((f) => f.name === 'Uncategorized');
  const userFolders = folders.filter((f) => f.name !== 'Uncategorized');

  // Flatten for sortable context
  const flattenedFolders = useMemo(
    () => flattenFolders(userFolders, expandedFolders),
    [userFolders, expandedFolders]
  );
  const sortableIds = useMemo(() => flattenedFolders.map((f) => f.folder.id), [flattenedFolders]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setOverId(null);
      setDropPosition(null);
      return;
    }

    const overId = over.id as string;
    setOverId(overId);

    // Calculate drop position based on Y offset
    const overRect = over.rect;
    const mouseY = (event.activatorEvent as MouseEvent)?.clientY ?? 0;

    if (overRect) {
      const offsetY = mouseY - overRect.top;
      const height = overRect.height;
      const ratio = offsetY / height;

      const activeFolder = findFolderById(folders, active.id as string);
      const overFolder = findFolderById(folders, overId);

      if (!activeFolder || !overFolder) {
        setDropPosition(null);
        return;
      }

      // Check constraints
      const isSelf = active.id === overId;
      const isDescendantOfActive = isDescendant(folders, overId, active.id as string);
      const canNestInside =
        overFolder.level < 3 && overFolder.level + getMaxDepth(activeFolder) <= 3;

      if (isSelf || isDescendantOfActive) {
        setDropPosition(null);
        return;
      }

      if (ratio < 0.25) {
        setDropPosition('before');
      } else if (ratio > 0.75) {
        setDropPosition('after');
      } else if (canNestInside) {
        setDropPosition('inside');
      } else {
        setDropPosition('after');
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    setDropPosition(null);

    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const targetId = over.id as string;

    if (dropPosition === 'inside') {
      // Nest inside target folder
      await onNestFolder(activeId, targetId);
    } else if (dropPosition === 'before') {
      // Move to root and place before target
      await onNestFolder(activeId, null);
      await onReorderFolder(activeId, targetId, undefined);
    } else if (dropPosition === 'after') {
      // Move to root and place after target
      await onNestFolder(activeId, null);
      await onReorderFolder(activeId, undefined, targetId);
    }
  };

  const activeFolder = activeId ? findFolderById(folders, activeId) : null;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 px-2 border-r bg-muted/20">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
          onClick={onToggleCollapsed}
        >
          <PanelLeftOpenIcon className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-56 border-r bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
        <span className="text-sm font-medium text-foreground/80">Collections</span>
        <div className="flex items-center gap-0.5">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleCreateFolder();
                    }
                  }}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNewFolderName('');
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
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            onClick={onToggleCollapsed}
          >
            <PanelLeftCloseIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2 px-2">
          {/* All Clips - Primary */}
          <button
            type="button"
            className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${
              selectedFolder === null
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground/80 hover:bg-accent/40 hover:text-foreground'
            }`}
            onClick={() => onSelectFolder(null)}
          >
            <LayersIcon
              className={`h-4 w-4 transition-colors ${
                selectedFolder === null ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground/70'
              }`}
            />
            <span className="flex-1 truncate text-left font-medium">All Clips</span>
            <span
              className={`text-xs tabular-nums transition-colors ${
                selectedFolder === null ? 'text-accent-foreground/70' : 'text-muted-foreground'
              }`}
            >
              {totalThreadCount}
            </span>
          </button>

          {/* Uncategorized - Secondary */}
          {uncategorizedFolder && (
            <button
              type="button"
              className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${
                selectedFolder === 'Uncategorized'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground/80 hover:bg-accent/40 hover:text-foreground'
              }`}
              onClick={() => onSelectFolder('Uncategorized')}
            >
              <InboxIcon
                className={`h-4 w-4 transition-colors ${
                  selectedFolder === 'Uncategorized'
                    ? 'text-foreground'
                    : 'text-muted-foreground group-hover:text-foreground/70'
                }`}
              />
              <span className="flex-1 truncate text-left">Unsorted</span>
              <span
                className={`text-xs tabular-nums transition-colors ${
                  selectedFolder === 'Uncategorized' ? 'text-accent-foreground/70' : 'text-muted-foreground'
                }`}
              >
                {uncategorizedFolder.threadCount}
              </span>
            </button>
          )}

          {/* Divider */}
          {userFolders.length > 0 && <div className="my-2 mx-3 border-t border-border/40" />}

          {/* User Folders with Drag and Drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {flattenedFolders.map(({ folder, depth }) => (
                <SortableFolderItem
                  key={folder.id}
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
              ))}
            </SortableContext>
            <DragOverlay>
              {activeFolder && <FolderDragPreview folder={activeFolder} />}
            </DragOverlay>
          </DndContext>
        </div>
      </ScrollArea>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="New folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleRenameFolder();
                }
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setNewFolderName('');
                  setRenamingName(null);
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
