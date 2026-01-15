export type ClipComment = {
  id: string;
  body: string;
  createdAt: number;
};

export type ClipThread = {
  id: string;
  url: string;
  createdAt: number;
  updatedAt: number;
  comments: ClipComment[];
  title?: string | null;
  faviconUrl?: string | null;
  previewImageUrl?: string | null;
  folder: string; // Folder name, e.g., "Uncategorized", "Finance", "Tech"
};

export type ClipMetadata = {
  title?: string | null;
  faviconUrl?: string | null;
  previewImageUrl?: string | null;
};

export type Folder = {
  id: string;                  // Unique ID (path-based: "finance", "finance/banking")
  name: string;                // Display name, e.g., "Finance"
  path: string;                // Full path, e.g., "Finance/Banking"
  level: 1 | 2 | 3;            // Nesting depth (1 = root, 2 = child, 3 = grandchild)
  parentId: string | null;     // Parent folder ID, null for root folders
  threadCount: number;         // Number of entries directly in this folder
  children: Folder[];          // Child folders
};

