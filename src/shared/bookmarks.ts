import type { ImportBookmark } from './storage';

export type ChromeBookmarkNode = {
  id: string;
  title: string;
  url?: string;
  children?: ChromeBookmarkNode[];
};

/**
 * Enterprise SaaS platforms often use org-specific subdomains that Google's
 * favicon service doesn't recognize. This maps hostname patterns to their
 * brand domains for better favicon results.
 */
const BRAND_DOMAIN_PATTERNS: Array<{ pattern: RegExp; brand: string }> = [
  // Salesforce: *.lightning.force.com, *.salesforce.com, *.force.com
  { pattern: /\.lightning\.force\.com$/i, brand: 'salesforce.com' },
  { pattern: /\.salesforce\.com$/i, brand: 'salesforce.com' },
  { pattern: /\.force\.com$/i, brand: 'salesforce.com' },
  // SAP: *.s4hana.cloud.sap, *.sap.com
  { pattern: /\.s4hana\.cloud\.sap$/i, brand: 'sap.com' },
  { pattern: /\.cloud\.sap$/i, brand: 'sap.com' },
  { pattern: /\.sap\.com$/i, brand: 'sap.com' },
  // Microsoft Dynamics: *.dynamics.com
  { pattern: /\.dynamics\.com$/i, brand: 'dynamics.com' },
  // ServiceNow: *.service-now.com
  { pattern: /\.service-now\.com$/i, brand: 'servicenow.com' },
  // Workday: *.workday.com
  { pattern: /\.workday\.com$/i, brand: 'workday.com' },
  // HubSpot: *.hubspot.com
  { pattern: /\.hubspot\.com$/i, brand: 'hubspot.com' },
  // Zendesk: *.zendesk.com
  { pattern: /\.zendesk\.com$/i, brand: 'zendesk.com' },
  // Atlassian: *.atlassian.net
  { pattern: /\.atlassian\.net$/i, brand: 'atlassian.com' },
  // Notion: *.notion.site
  { pattern: /\.notion\.site$/i, brand: 'notion.so' },
  // Airtable: *.airtable.com
  { pattern: /\.airtable\.com$/i, brand: 'airtable.com' },
  // Monday.com: *.monday.com
  { pattern: /\.monday\.com$/i, brand: 'monday.com' },
  // Figma: *.figma.com
  { pattern: /\.figma\.com$/i, brand: 'figma.com' },
  // Linear: *.linear.app
  { pattern: /\.linear\.app$/i, brand: 'linear.app' },
  // Vercel: *.vercel.app
  { pattern: /\.vercel\.app$/i, brand: 'vercel.com' },
  // Netlify: *.netlify.app
  { pattern: /\.netlify\.app$/i, brand: 'netlify.com' },
  // Heroku: *.herokuapp.com
  { pattern: /\.herokuapp\.com$/i, brand: 'heroku.com' },
  // AWS: *.amazonaws.com, *.aws.amazon.com
  { pattern: /\.amazonaws\.com$/i, brand: 'aws.amazon.com' },
  { pattern: /\.aws\.amazon\.com$/i, brand: 'aws.amazon.com' },
  // Azure: *.azure.com, *.azurewebsites.net
  { pattern: /\.azure\.com$/i, brand: 'azure.com' },
  { pattern: /\.azurewebsites\.net$/i, brand: 'azure.com' },
  // Google Cloud: console.cloud.google.com
  { pattern: /\.cloud\.google\.com$/i, brand: 'cloud.google.com' },
  { pattern: /^console\.cloud\.google\.com$/i, brand: 'cloud.google.com' },
];

/**
 * Extract a "brand domain" from a hostname for better favicon lookup.
 * For known enterprise SaaS patterns, returns the brand domain.
 * For other complex subdomains, tries to return a recognizable domain.
 */
function getBrandDomain(hostname: string): string {
  const lower = hostname.toLowerCase();

  // Check known patterns first
  for (const { pattern, brand } of BRAND_DOMAIN_PATTERNS) {
    if (pattern.test(lower)) {
      return brand;
    }
  }

  // For other domains, check if there's a very long/complex subdomain
  // that suggests an org-specific URL (e.g., "abc123-dev-ed.example.com")
  const parts = lower.split('.');
  if (parts.length >= 3) {
    const firstPart = parts[0];
    // Heuristic: if the first subdomain looks like an org ID (contains numbers/hyphens
    // and is longer than typical subdomains), try using fewer subdomains
    const looksLikeOrgId = firstPart.length > 12 || /[0-9].*-|-.* [0-9]/.test(firstPart);
    if (looksLikeOrgId && parts.length >= 4) {
      // Use last 3 parts (e.g., "develop.lightning.force.com" → "lightning.force.com")
      // But only if it doesn't look like a TLD (e.g., "co.uk")
      const shortened = parts.slice(-3).join('.');
      if (shortened.length > 10) {
        return shortened;
      }
    }
  }

  // Default: use the hostname as-is
  return hostname;
}

export function flattenChromeBookmarks(nodes: ChromeBookmarkNode[]): ImportBookmark[] {
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
          const hostname = new URL(node.url).hostname;
          const brandDomain = getBrandDomain(hostname);
          faviconUrl = `https://www.google.com/s2/favicons?domain=${brandDomain}&sz=64`;
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

/**
 * Parse Netscape HTML bookmark format (exported from Chrome, Firefox, Safari, etc.)
 * Returns ImportBookmark[] in the same format as flattenChromeBookmarks.
 */
export function parseHtmlBookmarks(html: string): ImportBookmark[] {
  const results: ImportBookmark[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Chrome/Firefox export bookmarks in a <DL> structure
  // Each <DT> contains either an <A> (bookmark) or <H3> (folder) followed by nested <DL>
  const topLevelContainers = new Set([
    'Bookmarks Bar',
    'Bookmarks bar',
    'Other Bookmarks',
    'Other bookmarks',
    'Mobile Bookmarks',
    'Mobile bookmarks',
    'Bookmarks Menu',
    'Toolbar',
  ]);

  function traverse(dl: Element, folderPath: string[]) {
    const children = dl.children;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];

      if (child.tagName === 'DT') {
        const anchor = child.querySelector(':scope > A');
        const folder = child.querySelector(':scope > H3');

        if (anchor) {
          // It's a bookmark
          const url = anchor.getAttribute('HREF');
          if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
            continue;
          }

          const title = anchor.textContent?.trim() || undefined;
          let folderName = 'Uncategorized';
          if (folderPath.length > 0) {
            // Max 3 levels of folder path
            folderName = folderPath.slice(0, 3).join('/');
          }

          let faviconUrl: string | undefined;
          try {
            const hostname = new URL(url).hostname;
            const brandDomain = getBrandDomain(hostname);
            faviconUrl = `https://www.google.com/s2/favicons?domain=${brandDomain}&sz=64`;
          } catch {
            // skip favicon
          }

          results.push({
            url,
            title,
            faviconUrl,
            folder: folderName,
          });
        } else if (folder) {
          // It's a folder - look for the nested <DL> in this <DT>
          const nestedDl = child.querySelector(':scope > DL');
          if (nestedDl) {
            const folderTitle = folder.textContent?.trim() || '';

            // Skip top-level containers as folder names
            if (folderPath.length === 0 && topLevelContainers.has(folderTitle)) {
              traverse(nestedDl, folderPath);
            } else {
              // Add folder to path, max 3 levels
              const newPath =
                folderPath.length < 3 ? [...folderPath, folderTitle] : folderPath;
              traverse(nestedDl, newPath);
            }
          }
        }
      } else if (child.tagName === 'DL') {
        // Sometimes there's a direct DL without DT wrapper
        traverse(child, folderPath);
      }
    }
  }

  // Start from all top-level DL elements
  const rootDls = doc.querySelectorAll('body > DL, BODY > DL');
  if (rootDls.length > 0) {
    rootDls.forEach((dl) => traverse(dl, []));
  } else {
    // Fallback: find any DL
    const anyDl = doc.querySelector('DL');
    if (anyDl) {
      traverse(anyDl, []);
    }
  }

  return results;
}
