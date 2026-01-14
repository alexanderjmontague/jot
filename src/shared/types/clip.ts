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
  name: string;       // The folder name, e.g., "Finance"
  path: string;       // Same as name (for compatibility)
  threadCount: number;
};

