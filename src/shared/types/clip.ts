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
};

export type ClipMetadata = {
  title?: string | null;
  faviconUrl?: string | null;
  previewImageUrl?: string | null;
};

