import { useState, type SVGProps } from 'react';
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

function MoreVerticalIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
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

function ListIcon(props: SVGProps<SVGSVGElement>) {
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
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  );
}

type FolderSidebarProps = {
  folders: Folder[];
  selectedFolder: string | null; // null means "All"
  collapsed: boolean;
  totalThreadCount: number;
  onSelectFolder: (name: string | null) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onRenameFolder: (oldName: string, newName: string) => Promise<void>;
  onDeleteFolder: (name: string) => Promise<void>;
  onToggleCollapsed: () => void;
};

export function FolderSidebar({
  folders,
  selectedFolder,
  collapsed,
  totalThreadCount,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onToggleCollapsed,
}: FolderSidebarProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingName, setRenamingName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);

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

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 px-2 border-r bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggleCollapsed}
        >
          <PanelLeftOpenIcon className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-56 border-r bg-muted/30">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium">Folders</span>
        <div className="flex items-center gap-1">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
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
            className="h-7 w-7"
            onClick={onToggleCollapsed}
          >
            <PanelLeftCloseIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* All Items */}
          <div
            className={`group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm cursor-pointer transition-colors ${
              selectedFolder === null
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted/50'
            }`}
            onClick={() => onSelectFolder(null)}
          >
            <ListIcon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">All Clips</span>
            <span className="text-xs text-muted-foreground">{totalThreadCount}</span>
          </div>

          {/* Folder list */}
          {folders.map((folder) => (
            <div
              key={folder.name}
              className={`group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                selectedFolder === folder.name
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => onSelectFolder(folder.name)}
            >
              {selectedFolder === folder.name ? (
                <FolderOpenIcon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FolderIcon className="h-4 w-4 text-muted-foreground" />
              )}

              <span className="flex-1 truncate">{folder.name}</span>

              <span className="text-xs text-muted-foreground">{folder.threadCount}</span>

              {folder.name !== 'Uncategorized' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVerticalIcon className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openRenameDialog(folder.name)}>
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDeleteFolder(folder.name)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
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
