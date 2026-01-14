import type { ClipThread } from './types/clip';

const CACHE_PREFIX = 'comment-cache:thread:';

type CacheEntry = {
  thread: ClipThread;
};

function getStorageArea(): chrome.storage.StorageArea | null {
  try {
    if (typeof chrome !== 'undefined') {
      if (chrome.storage?.local) return chrome.storage.local;
    }
  } catch (error) {
    console.warn('Failed to access chrome.storage', error);
  }
  return null;
}

function makeCacheKey(url: string): string {
  return `${CACHE_PREFIX}${url}`;
}

export async function getCachedThread(url: string): Promise<ClipThread | undefined> {
  const storage = getStorageArea();
  if (!storage) return undefined;

  try {
    const key = makeCacheKey(url);
    const result = await storage.get(key);
    const entry = result[key] as CacheEntry | undefined;
    if (!entry) return undefined;

    return entry.thread;
  } catch (error) {
    console.warn('Failed to read cached thread', error);
    return undefined;
  }
}

export async function setCachedThread(url: string, thread: ClipThread): Promise<void> {
  const storage = getStorageArea();
  if (!storage) return;

  try {
    const key = makeCacheKey(url);
    const entry: CacheEntry = { thread };
    await storage.set({ [key]: entry });
  } catch (error) {
    console.warn('Failed to cache thread', error);
  }
}

export async function clearCachedThread(url: string): Promise<void> {
  const storage = getStorageArea();
  if (!storage) return;

  try {
    await storage.remove(makeCacheKey(url));
  } catch (error) {
    console.warn('Failed to clear cached thread', error);
  }
}
