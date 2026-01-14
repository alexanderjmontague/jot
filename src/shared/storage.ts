/**
 * Storage layer using Chrome Native Messaging
 *
 * Communicates with the jot-host app to read/write
 * markdown files in the user's Obsidian vault.
 */

import type { ClipComment, ClipThread, ClipMetadata } from './types/clip';
import { setCachedThread, clearCachedThread } from './threadCache';

export type { ClipComment, ClipThread, ClipMetadata } from './types/clip';

const NATIVE_HOST_NAME = 'com.jot.host';

// ============================================================================
// Native Messaging Connection
// ============================================================================

let port: chrome.runtime.Port | null = null;
let messageId = 0;
const pendingRequests = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }
>();

function getPort(): chrome.runtime.Port {
  if (!port) {
    port = chrome.runtime.connectNative(NATIVE_HOST_NAME);

    port.onMessage.addListener((response: { id: number; ok: boolean; data?: unknown; error?: string }) => {
      const pending = pendingRequests.get(response.id);
      if (!pending) return;
      pendingRequests.delete(response.id);

      if (response.ok) {
        pending.resolve(response.data);
      } else {
        const error = new Error(response.error || 'Unknown error');
        (error as Error & { code?: string }).code = (response as { code?: string }).code;
        pending.reject(error);
      }
    });

    port.onDisconnect.addListener(() => {
      const lastError = chrome.runtime.lastError;
      port = null;

      // Reject all pending requests
      for (const { reject } of pendingRequests.values()) {
        reject(new Error(lastError?.message || 'Native host disconnected'));
      }
      pendingRequests.clear();
    });
  }
  return port;
}

function sendMessage<T>(request: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pendingRequests.set(id, { resolve: resolve as (v: unknown) => void, reject });

    try {
      getPort().postMessage({ id, ...request });
    } catch (error) {
      pendingRequests.delete(id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

// ============================================================================
// URL Normalization
// ============================================================================

const TRACKING_PARAMS = new Set([
  // Google Analytics / Ads / Search
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
  'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
  'srsltid',  // Google Search Results Link Tracking ID
  '_ga', '_gl',

  // Facebook / Instagram
  'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',
  'igsh', 'igshid',  // Instagram share tracking

  // Microsoft / Bing
  'msclkid',

  // Twitter/X
  'twclid',

  // YouTube / Spotify
  'si',  // Share tracking (YouTube, Spotify)
  'feature',  // YouTube share feature param

  // Generic tracking
  'ref', 'source', 'campaign',
  'mc_cid', 'mc_eid',  // Mailchimp
  'oly_enc_id', 'oly_anon_id',  // Omeda
  '_hsenc', '_hsmi', 'hsCtaTracking',  // HubSpot
  'vero_id', 'vero_conv',  // Vero
  'nr_email_referer',  // NewRelic
  'mkt_tok',  // Marketo
  'trk', 'trkInfo',  // LinkedIn
]);

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';

    // Strip tracking parameters
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }

    // Sort remaining params for consistency
    parsed.searchParams.sort();

    // Normalize www
    if (parsed.hostname.startsWith('www.')) {
      parsed.hostname = parsed.hostname.slice(4);
    }

    // Remove trailing slash from pathname (except root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch (error) {
    console.error('Failed to normalize URL', error);
    return url;
  }
}

// ============================================================================
// Configuration
// ============================================================================

export async function isHostInstalled(): Promise<boolean> {
  try {
    await sendMessage<{ status: string }>({ type: 'ping' });
    return true;
  } catch {
    return false;
  }
}

export async function isHostConfigured(): Promise<boolean> {
  try {
    const config = await sendMessage<{ vaultPath: string } | null>({ type: 'getConfig' });
    return config?.vaultPath != null;
  } catch {
    return false;
  }
}

export async function getConfig(): Promise<{ vaultPath: string; commentFolder: string } | null> {
  try {
    return await sendMessage<{ vaultPath: string; commentFolder: string } | null>({ type: 'getConfig' });
  } catch {
    return null;
  }
}

export async function setVaultPath(vaultPath: string, commentFolder = 'Jot'): Promise<void> {
  await sendMessage({ type: 'setConfig', vaultPath, commentFolder });
}

// ============================================================================
// Thread Operations
// ============================================================================

export async function getAllThreads(): Promise<ClipThread[]> {
  try {
    const threads = await sendMessage<ClipThread[]>({ type: 'getAllThreads' });
    return threads || [];
  } catch (error) {
    console.error('Failed to get all threads', error);
    return [];
  }
}

export async function getThreadByUrl(url: string): Promise<ClipThread | undefined> {
  const normalized = normalizeUrl(url);

  try {
    const thread = await sendMessage<ClipThread | null>({ type: 'getThread', url: normalized });

    if (thread) {
      void setCachedThread(normalized, thread);
      return thread;
    } else {
      void clearCachedThread(normalized);
      return undefined;
    }
  } catch (error) {
    console.error('Failed to get thread by URL', error);
    void clearCachedThread(normalized);
    return undefined;
  }
}

export async function hasCommentsForUrl(url: string): Promise<boolean> {
  const normalized = normalizeUrl(url);

  try {
    return await sendMessage<boolean>({ type: 'hasComments', url: normalized });
  } catch {
    return false;
  }
}

export async function appendComment(url: string, body: string, metadata?: ClipMetadata): Promise<ClipThread> {
  const trimmedBody = body.trim();
  if (!trimmedBody) throw new Error('Comment body cannot be empty');

  const normalized = normalizeUrl(url);

  const thread = await sendMessage<ClipThread>({
    type: 'appendComment',
    url: normalized,
    body: trimmedBody,
    metadata: metadata
      ? {
          title: metadata.title?.trim() || undefined,
          faviconUrl: metadata.faviconUrl?.trim() || undefined,
          previewImageUrl: metadata.previewImageUrl?.trim() || undefined,
        }
      : undefined,
  });

  void setCachedThread(normalized, thread);
  return thread;
}

export async function deleteThread(url: string): Promise<void> {
  const normalized = normalizeUrl(url);
  await sendMessage({ type: 'deleteThread', url: normalized });
  void clearCachedThread(normalized);
}

export async function deleteComment(url: string, commentId: string): Promise<ClipThread | undefined> {
  const normalized = normalizeUrl(url);

  try {
    const thread = await sendMessage<ClipThread | null>({
      type: 'deleteComment',
      url: normalized,
      commentId,
    });

    if (thread && thread.comments.length > 0) {
      void setCachedThread(normalized, thread);
      return thread;
    } else {
      // No comments left - thread was deleted
      void clearCachedThread(normalized);
      return undefined;
    }
  } catch (error) {
    // If comment not found, try to delete the whole thread
    const errorWithCode = error as Error & { code?: string };
    if (errorWithCode.code === 'NOT_FOUND') {
      await deleteThread(url);
      return undefined;
    }
    throw error;
  }
}

// ============================================================================
// Subscription (no-op for local files)
// ============================================================================

/**
 * @deprecated No real-time updates for local files.
 * Use manual refresh instead.
 */
export function subscribeToChanges(_callback: (threads: ClipThread[]) => void): () => void {
  // No-op: local files don't support real-time subscriptions
  // The callback is called once initially to load current data
  void getAllThreads().then(_callback).catch(console.error);

  return () => {
    // No cleanup needed
  };
}
