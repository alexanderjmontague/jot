import { useEffect, useRef, useState, type SVGProps } from 'react';
import {
  appendComment,
  deleteComment,
  getThreadByUrl,
  subscribeToChanges,
  type ClipComment,
  type ClipThread,
  type ClipMetadata,
} from '../storage';
import { getCachedThread, setCachedThread, clearCachedThread } from '../threadCache';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../../components/ui/tooltip';
import { formatAbsolute, formatRelativeOrAbsolute } from '../datetime';
import { formatDisplayUrl, stripWwwPrefix } from '../url';

type MinimalClipEditorProps = {
  url: string;
  initialThread?: ClipThread | null;
  showViewCommentsButton?: boolean;
  showSidebarButton?: boolean;
  showPopupButton?: boolean;
  onOpenPopup?: () => void | Promise<void>;
  isPopupPending?: boolean;
  onCommentAdded?: (thread: ClipThread) => void;
  onCommentDeleted?: (thread: ClipThread | undefined) => void;
  defaultFolder?: string;
};

function HistoryIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M12 7v14" />
      <path d="M16 12h2" />
      <path d="M16 8h2" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      <path d="M6 12h2" />
      <path d="M6 8h2" />
    </svg>
  );
}

function PanelRightIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M15 3v18" />
    </svg>
  );
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

function Minimize2Icon(props: SVGProps<SVGSVGElement>) {
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
      <path d="m14 10 7-7" />
      <path d="M20 10h-6V4" />
      <path d="m3 21 7-7" />
      <path d="M4 14h6v6" />
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
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="m8 6 1-3h6l1 3" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function normalizeLoadableFaviconUrl(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // ignore invalid URLs
  }

  return null;
}

async function fetchFaviconFromTab(tabId: number): Promise<string | null> {
  if (!chrome.scripting?.executeScript) {
    return null;
  }

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const selector =
          'link[rel="icon" i], link[rel="shortcut icon" i], link[rel~="icon" i], link[rel="apple-touch-icon" i], link[rel="apple-touch-icon-precomposed" i], link[rel="mask-icon" i]';

        const normalize = (href: string | null | undefined): string | null => {
          if (!href) return null;
          const trimmed = href.trim();
          if (!trimmed) return null;
          if (trimmed.startsWith('data:')) {
            return trimmed;
          }
          try {
            const absolute = new URL(trimmed, document.baseURI);
            if (absolute.protocol === 'http:' || absolute.protocol === 'https:') {
              return absolute.toString();
            }
          } catch {
            // skip invalid entries
          }
          return null;
        };

        type Candidate = { href: string; score: number };
        const candidates: Candidate[] = [];

        const relWeight = (relValue: string): number => {
          const rel = relValue.toLowerCase();
          if (rel.includes('apple-touch-icon')) return 400;
          if (rel.includes('mask-icon')) return 300;
          if (rel.includes('shortcut')) return 200;
          if (rel.includes('icon')) return 100;
          return 0;
        };

        const sizeWeight = (sizesAttr: string | null): number => {
          if (!sizesAttr) return 0;
          const normalized = sizesAttr.trim().toLowerCase();
          if (!normalized) return 0;
          if (normalized === 'any') return 512;

          const tokens = normalized.split(/\s+/);
          let best = 0;
          for (const token of tokens) {
            const parts = token.split('x');
            const dimension = parseInt(parts[0] ?? '', 10);
            if (Number.isFinite(dimension)) {
              best = Math.max(best, dimension);
            }
          }
          return best;
        };

        const links = Array.from(document.querySelectorAll<HTMLLinkElement>(selector));
        for (const link of links) {
          const href = normalize(link.getAttribute('href'));
          if (!href) continue;
          const relScore = relWeight(link.rel || link.getAttribute('rel') || '');
          const sizeScore = sizeWeight(link.getAttribute('sizes'));
          const score = relScore + sizeScore;
          candidates.push({ href, score });
        }

        candidates.sort((a, b) => b.score - a.score);
        return candidates[0]?.href ?? null;
      },
    });

    const result = injection?.result;
    return typeof result === 'string' ? result : null;
  } catch (err) {
    console.error('Failed to inspect favicons in tab', err);
    return null;
  }
}

// Attempts to find a representative preview image via metadata, structured data, and DOM heuristics.
async function fetchPreviewImageFromTab(tabId: number): Promise<string | null> {
  if (!chrome.scripting?.executeScript) {
    return null;
  }

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const normalize = (value: string | null | undefined): string | null => {
          if (!value) return null;
          const trimmed = value.trim();
          if (!trimmed) return null;
          try {
            const absolute = new URL(trimmed, document.baseURI);
            if (absolute.protocol === 'http:' || absolute.protocol === 'https:') {
              return absolute.toString();
            }
          } catch {
            // ignore invalid URLs
          }
          return null;
        };

        const shouldIgnoreCandidate = (url: string): boolean => {
          const lower = url.toLowerCase();
          if (/transparent-pixel|spacer|sprite|\/blank|1x1/.test(lower)) {
            if (/\.(gif|png)$/.test(lower)) {
              return true;
            }
          }
          if (/\/akamai\//.test(lower) && lower.endsWith('_.jpg')) {
            return false;
          }
          return false;
        };

        type Candidate = { url: string; score: number };
        const candidates = new Map<string, Candidate>();

        const boostCandidate = (url: string | null | undefined, delta: number) => {
          const normalized = normalize(url);
          if (!normalized) return;
          if (shouldIgnoreCandidate(normalized)) {
            return;
          }
          const existing = candidates.get(normalized);
          const nextScore = (existing?.score ?? 0) + delta;
          if (existing) {
            existing.score = nextScore;
          } else {
            candidates.set(normalized, { url: normalized, score: nextScore });
          }
        };

        const getBestCandidate = (): string | null => {
          let best: Candidate | null = null;
          for (const candidate of candidates.values()) {
            if (!best || candidate.score > best.score) {
              best = candidate;
            }
          }
          return best?.url ?? null;
        };

        const host = location.hostname.toLowerCase();
        const isLinkedIn = host.endsWith('linkedin.com');
        const isFacebook = host.endsWith('facebook.com') || host.endsWith('.fb.com') || host === 'facebook.com';
        const isAmazon = /\.amazon\./.test(host);

        const canonicalTitle =
          document.querySelector('meta[property="og:title" i]')?.content ||
          document.querySelector('meta[name="twitter:title" i]')?.content ||
          document.title;
        const primaryTitleFragment = canonicalTitle
          .split('|')[0]
          .split('—')[0]
          .split('-')[0]
          .trim();
        const nameTokens = isLinkedIn
          ? primaryTitleFragment
              .toLowerCase()
              .split(/\s+/)
              .filter((token) => token.length >= 3 && /[a-z]/.test(token))
          : [];

        const urlBonusForCdn = (url: string): number => {
          if (isLinkedIn && /licdn\.com/.test(url)) return 320;
          if (isFacebook && /fbcdn\.(net|com)/.test(url)) return 240;
          if (isAmazon && /(images|media)-amazon\.com/.test(url)) return 260;
          return 0;
        };

        const keywordBonus = (value: string | null | undefined): number => {
          if (!value) return 0;
          const normalized = value.toLowerCase();
          let score = 0;
          if (/(profile|avatar|photo|headshot|face|cover|hero)/.test(normalized)) score += 50;
          if (/(product|listing|primary|main|detail)/.test(normalized)) score += 40;
          return score;
        };

        const linkedInPenalty = (value: string | null | undefined): number => {
          if (!isLinkedIn || !value) return 0;
          const normalized = value.toLowerCase();
          let penalty = 0;
          if (/(education|school|university)/.test(normalized)) penalty += 220;
          if (/(experience|company|employer|position)/.test(normalized)) penalty += 180;
          if (/(logo|badge)/.test(normalized)) penalty += 260;
          return penalty;
        };

        const linkedInNameBonus = (value: string | null | undefined): number => {
          if (!isLinkedIn || !value || nameTokens.length === 0) return 0;
          const normalized = value.toLowerCase();
          let matches = 0;
          for (const token of nameTokens) {
            if (normalized.includes(token)) {
              matches += 1;
            }
          }
          return matches > 0 ? 180 + matches * 60 : 0;
        };

        const addMetaTags = () => {
          const selectors = [
            'meta[property="og:image:secure_url" i]',
            'meta[property="og:image:url" i]',
            'meta[property="og:image" i]',
            'meta[name="twitter:image:src" i]',
            'meta[property="twitter:image" i]',
            'meta[name="twitter:image" i]',
            'meta[name="thumbnail" i]',
            'meta[itemprop="image" i]',
          ];

          for (const selector of selectors) {
            const node = document.querySelector<HTMLMetaElement>(selector);
            if (!node) continue;
            boostCandidate(node.content, 1200);
          }
        };

        const addJsonLdImages = () => {
          const scripts = Array.from(
            document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json" i]'),
          ).slice(0, 20);

          const collect = (value: unknown, depth: number) => {
            if (depth > 6 || !value) return;
            if (Array.isArray(value)) {
              for (const entry of value) {
                collect(entry, depth + 1);
              }
              return;
            }

            if (typeof value === 'string') {
              boostCandidate(value, 900);
              return;
            }

            if (typeof value !== 'object') {
              return;
            }

            const maybeImage = (value as Record<string, unknown>).image;
            if (maybeImage !== undefined) {
              collect(maybeImage, depth + 1);
            }

            const maybeThumbnail = (value as Record<string, unknown>).thumbnailUrl;
            if (maybeThumbnail !== undefined) {
              collect(maybeThumbnail, depth + 1);
            }

            const keys = Object.keys(value as Record<string, unknown>);
            for (const key of keys) {
              if (/(image|thumbnail)/i.test(key)) {
                collect((value as Record<string, unknown>)[key], depth + 1);
              }
            }
          };

          for (const script of scripts) {
            const raw = script.textContent?.trim();
            if (!raw) continue;
            try {
              const parsed = JSON.parse(raw);
              collect(parsed, 0);
            } catch {
              // ignore malformed JSON-LD entries
            }
          }
        };

        const parseSrcset = (srcset: string | null | undefined): string | null => {
          if (!srcset) return null;
          let bestUrl: string | null = null;
          let bestWidth = 0;
          const parts = srcset.split(',');
          for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            const tokens = trimmed.split(/\s+/);
            const candidateUrl = normalize(tokens[0]);
            if (!candidateUrl) continue;
            const widthToken = tokens.find((token) => token.endsWith('w'));
            const width = widthToken ? parseInt(widthToken.slice(0, -1), 10) : NaN;
            if (Number.isFinite(width) && width > bestWidth) {
              bestWidth = width;
              bestUrl = candidateUrl;
            } else if (!bestUrl) {
              bestUrl = candidateUrl;
            }
          }
          return bestUrl;
        };

        const scoreForImageDimensions = (img: HTMLImageElement): number => {
          const width = img.naturalWidth || img.width || 0;
          const height = img.naturalHeight || img.height || 0;
          let score = 0;
          if (width >= 400 && height >= 400) score += 140;
          else if (width >= 200 && height >= 200) score += 90;
          else if (width >= 120 && height >= 120) score += 50;
          if (width > 0 && height > 0) {
            if (width <= 80 || height <= 80) {
              score -= 200;
            }
            if (width <= 60 || height <= 60) {
              score -= 120;
            }
          }
          return score;
        };

        // Filter out images that shouldn't be candidates for the clip preview.
        // This prevents picking up tiny icons, hidden dropdown images, etc.
        const isImageCandidate = (img: HTMLImageElement): boolean => {
          // Rule 1: Must be displayed at least 100x100px on the page.
          // Uses rendered size (getBoundingClientRect), not file dimensions (naturalWidth).
          // A large image file displayed tiny (e.g., flag icon in dropdown) gets rejected.
          const rect = img.getBoundingClientRect();
          if (rect.width < 100 || rect.height < 100) return false;

          // Rule 2: Must not be hidden via CSS on the element itself.
          const style = window.getComputedStyle(img);
          if (style.display === 'none') return false;
          if (style.visibility === 'hidden') return false;
          if (style.opacity === '0') return false;

          // Rule 3: Must not be inside a hidden parent (e.g., closed dropdown, hidden modal).
          let parent = img.parentElement;
          while (parent && parent !== document.body) {
            const parentStyle = window.getComputedStyle(parent);
            if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
              return false;
            }
            parent = parent.parentElement;
          }

          return true;
        };

        const addImageElements = () => {
          const seen = new Set<HTMLImageElement>();
          const limit = 160;
          for (const img of Array.from(document.images)) {
            if (seen.size >= limit) break;
            if (seen.has(img)) continue;
            if (!isImageCandidate(img)) continue;
            seen.add(img);

            const sources = new Set<string | null | undefined>();
            sources.add(img.currentSrc);
            sources.add(img.src);
            sources.add(parseSrcset(img.getAttribute('srcset')));
            sources.add(img.getAttribute('data-src'));
            sources.add(img.getAttribute('data-srcset'));
            sources.add(parseSrcset(img.getAttribute('data-srcset')));
            sources.add(img.getAttribute('data-delayed-url'));

            let baseScore = 60;
            baseScore += scoreForImageDimensions(img);
            baseScore += keywordBonus(img.getAttribute('class'));
            baseScore += keywordBonus(img.getAttribute('alt'));
            baseScore += keywordBonus(img.id ? `#${img.id}` : '');
            baseScore += linkedInNameBonus(img.getAttribute('alt'));
            baseScore -= linkedInPenalty(img.getAttribute('class'));
            baseScore -= linkedInPenalty(img.getAttribute('alt'));
            baseScore -= linkedInPenalty(img.id ? `#${img.id}` : '');
            if (isLinkedIn) {
              const isTopCard = Boolean(
                img.closest('.pv-top-card, .pv-top-card__photo, .pv-top-card--photo, .pv-profile-card-section') ||
                  img.closest('[data-view-name="profile-image"]'),
              );
              if (isTopCard) {
                baseScore += 240;
              }

              const inGlobalNav = Boolean(
                img.closest('header.global-nav, .global-nav, .extended-nav') ||
                  img.closest('.global-nav__me, .global-nav__primary-link') ||
                  img.classList.contains('global-nav__me-photo'),
              );
              if (inGlobalNav) {
                baseScore -= 800;
              }
            }

            for (const source of sources) {
              const normalized = normalize(source);
              if (!normalized) continue;
              const totalScore = baseScore + urlBonusForCdn(normalized);
              boostCandidate(normalized, totalScore);
            }
          }
        };

        const extractBackgroundImages = (elements: Iterable<Element>, bonus: number) => {
          const urlPattern = /url\((['"]?)(.*?)\1\)/gi;
          for (const element of elements) {
            const style = window.getComputedStyle(element);
            const backgroundValue = style.backgroundImage;
            if (!backgroundValue || backgroundValue === 'none') continue;
            let match: RegExpExecArray | null;
            urlPattern.lastIndex = 0;
            while ((match = urlPattern.exec(backgroundValue)) !== null) {
              boostCandidate(match[2], 80 + bonus + keywordBonus(element.getAttribute('class')));
            }
          }
        };

        const addHostSpecificHints = () => {
          if (isLinkedIn) {
            const prioritizeSelectors = [
              '[data-view-name="profile-image"] img[src*="profile-displayphoto"]',
              'img.pv-top-card-profile-picture__image',
              'img.profile-photo-edit__preview',
              '[data-test-app-aware-avatar][data-test-app-aware-avatar*="profile"] img',
            ];
            for (const selector of prioritizeSelectors) {
              const node = document.querySelector<HTMLImageElement>(selector);
              if (!node) continue;
              const candidate = normalize(node.currentSrc || node.src);
              if (!candidate) continue;
              const scoreBoost =
                2800 +
                scoreForImageDimensions(node) +
                keywordBonus(node.getAttribute('class')) +
                keywordBonus(node.getAttribute('alt')) +
                linkedInNameBonus(node.getAttribute('alt')) -
                linkedInPenalty(node.getAttribute('class')) -
                linkedInPenalty(node.getAttribute('alt'));
              boostCandidate(candidate, scoreBoost);
            }

            const linkedInSelectors = [
              'img[src*="profile-displayphoto"]',
              '[data-test-app-aware-avatar] img',
              'img[src*="dms/image"]',
            ];
            for (const selector of linkedInSelectors) {
              const nodes = document.querySelectorAll<HTMLImageElement>(selector);
              for (const node of nodes) {
                const normalized = normalize(node.currentSrc || node.src);
                if (!normalized) continue;
                const rect = node.getBoundingClientRect();
                const viewportBonus = Number.isFinite(rect?.top) ? Math.max(0, 240 - Math.max(0, rect.top)) : 0;
                boostCandidate(
                  normalized,
                  340 +
                    keywordBonus(node.getAttribute('class')) +
                    keywordBonus(node.getAttribute('alt')) +
                    linkedInNameBonus(node.getAttribute('alt')) -
                    linkedInPenalty(node.getAttribute('class')) -
                    linkedInPenalty(node.getAttribute('alt')) +
                    scoreForImageDimensions(node) +
                    viewportBonus,
                );
              }
            }

            const delayedNodes = document.querySelectorAll<HTMLElement>('[data-delayed-url]');
            for (const node of delayedNodes) {
              boostCandidate(node.getAttribute('data-delayed-url'), 180 + keywordBonus(node.getAttribute('class')));
            }

            extractBackgroundImages(
              document.querySelectorAll('[style*="background-image"][class*="cover"], [style*="background-image"][class*="profile"]'),
              140,
            );
          }

          if (isFacebook) {
            const fbSelectors = [
              'img[src*="fbcdn"]',
              'img[referrerpolicy][src]'
            ];
            for (const selector of fbSelectors) {
              const nodes = document.querySelectorAll<HTMLImageElement>(selector);
              for (const node of nodes) {
                boostCandidate(node.currentSrc || node.src, 200 + keywordBonus(node.getAttribute('class')));
              }
            }

            extractBackgroundImages(
              document.querySelectorAll('[style*="background-image"][role="img"], [style*="background-image"][aria-label]'),
              160,
            );
          }

          if (isAmazon) {
            const amazonSelectors = [
              '#landingImage',
              'img[data-old-hires]',
              'img[data-a-dynamic-image]'
            ];
            for (const selector of amazonSelectors) {
              const nodes = document.querySelectorAll<HTMLImageElement>(selector);
              for (const node of nodes) {
                const dynamic = node.getAttribute('data-a-dynamic-image');
                if (dynamic) {
                  try {
                    const parsed = JSON.parse(dynamic);
                    let bestDynamic: { url: string; area: number } | null = null;
                    for (const [url, dims] of Object.entries(parsed)) {
                      const normalized = normalize(url);
                      if (!normalized) continue;
                      const size = Array.isArray(dims) ? dims : [];
                      const width = Number(size[0] ?? 0);
                      const height = Number(size[1] ?? 0);
                      const area = Math.max(0, width * height);
                      if (!bestDynamic || area > bestDynamic.area) {
                        bestDynamic = { url: normalized, area };
                      }
                    }
                    if (bestDynamic) {
                      boostCandidate(bestDynamic.url, 1200 + Math.min(800, Math.floor(bestDynamic.area / 4_000)));
                    }
                  } catch {
                    // ignore malformed dynamic image payloads
                  }
                }
                const primarySource = normalize(node.currentSrc || node.src || node.getAttribute('data-old-hires'));
                if (primarySource) {
                  boostCandidate(primarySource, 1200 + scoreForImageDimensions(node) + keywordBonus(node.getAttribute('class')));
                }
              }
            }

            const imageBlock = document.querySelector('#imgTagWrapperId img, #main-image-container img');
            if (imageBlock) {
              const normalized = normalize((imageBlock as HTMLImageElement).currentSrc || imageBlock.getAttribute('src'));
              if (normalized) {
                boostCandidate(normalized, 1500 + scoreForImageDimensions(imageBlock as HTMLImageElement));
              }
            }
          }
        };

        addMetaTags();
        addJsonLdImages();
        addHostSpecificHints();
        addImageElements();
        extractBackgroundImages(
          Array.from(document.querySelectorAll<HTMLElement>('[style*="background-image"]')).slice(0, 100),
          60,
        );

        if (isLinkedIn) {
          const directProfileCandidate = Array.from(candidates.values())
            .filter((candidate) => /profile-displayphoto|profileimage|profilephot/i.test(candidate.url))
            .sort((a, b) => b.score - a.score)[0];
          if (directProfileCandidate) {
            return directProfileCandidate.url;
          }
        }

        return getBestCandidate();
      },
    });

    const result = injection?.result;
    return typeof result === 'string' ? result : null;
  } catch (err) {
    console.error('Failed to extract preview image from tab', err);
    return null;
  }
}

type SaveStatus = 'idle' | 'saving' | 'error';

export function MinimalClipEditor({
  url,
  initialThread = null,
  showViewCommentsButton = false,
  showSidebarButton = false,
  showPopupButton = false,
  onOpenPopup,
  isPopupPending = false,
  onCommentAdded,
  onCommentDeleted,
  defaultFolder = '/',
}: MinimalClipEditorProps) {
  const [thread, setThread] = useState<ClipThread | undefined>(initialThread ?? undefined);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [faviconError, setFaviconError] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!url || isLoading) {
      return;
    }
    textareaRef.current?.focus();
  }, [url, isLoading]);

  useEffect(() => {
    if (!url) {
      setThread(undefined);
      setIsLoading(false);
      return;
    }

    if (initialThread && initialThread.url === url) {
      setThread(initialThread);
      setIsLoading(false);
    } else if (initialThread === null) {
      setThread(undefined);
    }
  }, [initialThread, url]);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      if (!url) {
        setThread(undefined);
        setIsLoading(false);
        return;
      }

      setError(null);

      const cached = await getCachedThread(url);
      if (isCancelled) return;

      if (cached) {
        setThread(cached);
        setIsLoading(false);
      } else {
        setThread(undefined);
        setIsLoading(true);
      }

      try {
        const result = await getThreadByUrl(url);
        if (!isCancelled) {
          setThread(result);
          if (result) {
            void setCachedThread(url, result);
          } else {
            void clearCachedThread(url);
          }
        }
      } catch (err) {
        console.error('Failed to load comments for thread', err);
        if (!isCancelled) {
          setError('Failed to load existing comments.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    const unsubscribe = subscribeToChanges((threads) => {
      if (!url) return;
      const match = threads.find((candidate) => candidate.url === url);
      if (match) {
        setThread(match);
        void setCachedThread(url, match);
      } else if (!threads.some((candidate) => candidate.url === url)) {
        setThread(undefined);
        void clearCachedThread(url);
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [url]);

  useEffect(() => {
    if (!url) {
      setPageTitle('');
      setFaviconUrl(null);
      setFaviconError(false);
      setPreviewImageUrl(null);
      return;
    }

    let isCancelled = false;
    let fallbackImage: HTMLImageElement | null = null;

    const defaultTitle = (() => {
      try {
        const parsed = new URL(url);
        if (parsed.hostname) {
          return stripWwwPrefix(parsed.hostname);
        }
      } catch {
        // ignore and fall back to formatted URL
      }
      return formatDisplayUrl(url);
    })();

    setPageTitle(defaultTitle);
    setFaviconUrl(null);
    setFaviconError(false);
    setPreviewImageUrl(null);

    const resolveMetadata = async () => {
      let activeTab: chrome.tabs.Tab | undefined;

      try {
        [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      } catch (err) {
        console.error('Failed to get active tab metadata', err);
      }

      if (!isCancelled && activeTab?.title) {
        setPageTitle(activeTab.title);
      }

      if (!isCancelled && typeof activeTab?.id === 'number') {
        const previewUrl = await fetchPreviewImageFromTab(activeTab.id);
        if (!isCancelled) {
          setPreviewImageUrl(previewUrl);
        }
      }

      const trySetFavicon = (candidate: string | null | undefined): boolean => {
        if (isCancelled) return false;
        const normalized = normalizeLoadableFaviconUrl(candidate);
        if (!normalized) return false;
        setFaviconUrl(normalized);
        return true;
      };

      if (trySetFavicon(activeTab?.favIconUrl)) {
        return;
      }

      if (typeof activeTab?.id === 'number') {
        const declaredFavicon = await fetchFaviconFromTab(activeTab.id);
        if (trySetFavicon(declaredFavicon)) {
          return;
        }
      }

      const loadDefaultFavicon = async (): Promise<string | null> => {
        try {
          const urlObj = new URL(url);
          const defaultFavicon = `${urlObj.origin}/favicon.ico`;
          const normalized = normalizeLoadableFaviconUrl(defaultFavicon);
          if (!normalized) {
            return null;
          }

          return await new Promise<string | null>((resolve) => {
            const img = new Image();
            fallbackImage = img;
            img.onload = () => {
              fallbackImage = null;
              img.onload = null;
              img.onerror = null;
              resolve(normalized);
            };
            img.onerror = () => {
              fallbackImage = null;
              img.onload = null;
              img.onerror = null;
              resolve(null);
            };
            img.src = normalized;
          });
        } catch {
          return null;
        }
      };

      const defaultFavicon = await loadDefaultFavicon();
      if (isCancelled) {
        return;
      }

      if (defaultFavicon) {
        setFaviconUrl(defaultFavicon);
        return;
      }

      setFaviconError(true);
    };

    void resolveMetadata();

    return () => {
      isCancelled = true;
      if (fallbackImage) {
        fallbackImage.onload = null;
        fallbackImage.onerror = null;
      }
    };
  }, [url]);

  useEffect(() => {
    const container = commentsContainerRef.current;
    if (!container) {
      return;
    }
    const target = container.scrollHeight;
    if (typeof container.scrollTo === 'function') {
      try {
        container.scrollTo({ top: target, behavior: 'smooth' });
        return;
      } catch {
        // fall through to assignment
      }
    }
    container.scrollTop = target;
  }, [thread?.comments.length]);

  const hasComments = (thread?.comments?.length ?? 0) > 0;

  const handleOpenList = () => {
    chrome.tabs
      .create({ url: chrome.runtime.getURL('list.html') })
      .catch((err) => console.error('Failed to open list view', err));
  };

  const handleOpenSidebar = async () => {
    if (!chrome.sidePanel?.open) {
      console.error('Side panel API is unavailable in this browser.');
      return;
    }

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id) {
        console.error('Failed to open sidebar: no active tab.');
        return;
      }

      const tabId = activeTab.id as number;
      const windowId = activeTab.windowId ?? chrome.windows.WINDOW_ID_CURRENT;

      const openPanel = () => {
        chrome.sidePanel.open({ tabId, windowId }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to open sidebar', chrome.runtime.lastError);
            return;
          }

          window.close();
        });
      };

      if (chrome.sidePanel.setOptions) {
        chrome.sidePanel.setOptions({ tabId, enabled: true, path: 'sidebar.html' }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to enable sidebar before opening', chrome.runtime.lastError);
            return;
          }

          openPanel();
        });
        return;
      }

      openPanel();
    } catch (err) {
      console.error('Failed to open sidebar', err);
    }
  };

  const handleSubmit = async () => {
    if (!url || status === 'saving') return;

    const trimmed = draft.trim();
    if (!trimmed) return;

    setStatus('saving');
    setError(null);

    try {
      const metadata: ClipMetadata = {};
      const normalizedTitle = pageTitle.trim();
      if (normalizedTitle) {
        metadata.title = normalizedTitle;
      }
      if (!faviconError && faviconUrl) {
        metadata.faviconUrl = faviconUrl;
      }
      if (previewImageUrl) {
        metadata.previewImageUrl = previewImageUrl;
      }

      const metadataPayload = Object.keys(metadata).length > 0 ? metadata : undefined;
      const nextThread = await appendComment(url, trimmed, metadataPayload, defaultFolder);
      setThread(nextThread);
      void setCachedThread(url, nextThread);
      setDraft('');
      setStatus('idle');
      onCommentAdded?.(nextThread);
      chrome.runtime
        .sendMessage({ type: 'comment-saved', url })
        .catch((err) => console.error('Failed to notify background about thread update', err));
    } catch (err) {
      console.error('Failed to append comment', err);
      setError('Failed to add comment.');
      setStatus('error');
    }
  };

  const handleDeleteComment = async (comment: ClipComment) => {
    if (!url) return;

    try {
      const nextThread = await deleteComment(url, comment.id);
      setThread(nextThread);
      if (nextThread) {
        void setCachedThread(url, nextThread);
      } else {
        void clearCachedThread(url);
      }
      onCommentDeleted?.(nextThread);
      chrome.runtime
        .sendMessage({ type: 'comment-saved', url })
        .catch((err) => console.error('Failed to notify background about thread update', err));
    } catch (err) {
      console.error('Failed to delete comment', err);
      setError('Failed to delete comment.');
    }
  };

  const handleComposerKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      await handleSubmit();
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/60 p-2 shadow-sm">
        {error ? (
          <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-sm text-foreground">
            {error}
          </div>
        ) : null}

        <div className="flex items-stretch gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <div className="flex h-full min-w-0 items-center gap-2 overflow-hidden rounded-t-md border border-b-0 border-border/60 px-1.5 py-1 text-xs text-muted-foreground">
              {faviconUrl && !faviconError ? (
                <img src={faviconUrl} alt="" className="size-4 shrink-0" />
              ) : (
                <LinkIcon className="size-4 shrink-0" />
              )}
              <span className="truncate">{formatDisplayUrl(url) || 'unknown'}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {showViewCommentsButton ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleOpenList}
                    aria-label="View comments"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 text-foreground transition hover:bg-accent hover:text-accent-foreground"
                  >
                    <HistoryIcon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>All comments</p>
                </TooltipContent>
              </Tooltip>
            ) : null}
            {showSidebarButton ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleOpenSidebar}
                    aria-label="Open sidebar"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 text-foreground transition hover:bg-accent hover:text-accent-foreground"
                  >
                    <PanelRightIcon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Open AI sidebar</p>
                </TooltipContent>
              </Tooltip>
            ) : null}
            {showPopupButton ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      if (isPopupPending) return;
                      void onOpenPopup?.();
                    }}
                    disabled={isPopupPending}
                    aria-label="Open popup"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 text-foreground transition disabled:cursor-not-allowed disabled:opacity-60 hover:bg-accent hover:text-accent-foreground"
                  >
                    <Minimize2Icon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Change to popup</p>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {hasComments ? (
            <div ref={commentsContainerRef} className="max-h-48 overflow-y-auto">
              <div className="flex flex-col gap-2">
                {thread?.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="group rounded-md bg-[hsl(var(--comment-surface))] px-2 pt-1 pb-2 text-sm leading-relaxed text-foreground"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate">{formatRelativeOrAbsolute(comment.createdAt)}</span>
                        </TooltipTrigger>
                        <TooltipContent>{formatAbsolute(comment.createdAt)}</TooltipContent>
                      </Tooltip>
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(comment)}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground opacity-0 transition hover:border-destructive/60 hover:text-destructive focus-visible:opacity-100 focus-visible:text-destructive focus-visible:pointer-events-auto group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none"
                        aria-label="Delete comment"
                      >
                        <TrashIcon className="size-3.5" />
                      </button>
                    </div>
                    <div className="whitespace-pre-wrap pt-0 text-sm">{comment.body}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={hasComments ? 'Add another comment…' : 'Write something about this page…'}
            rows={4}
            disabled={!url || isLoading}
            className="min-h-[100px] resize-y rounded-md border border-border/80 bg-background px-2 py-1.5 text-sm leading-relaxed text-foreground shadow-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={status === 'saving' || !url || !draft.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition disabled:cursor-not-allowed disabled:opacity-30 hover:bg-primary/90"
          >
            {status === 'saving' ? 'Adding…' : 'Add comment'}
            {status === 'idle' && <span className="text-xs opacity-70">⌘↵</span>}
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}
