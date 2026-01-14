/**
 * Version checking utilities for update notifications.
 * Uses GitHub Releases API to check for new versions.
 */

const GITHUB_REPO = 'alexanderjmontague/Jot';

export async function getLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.tag_name?.replace(/^v/, '') || null;
  } catch {
    return null;
  }
}

export function getCurrentVersion(): string {
  return chrome.runtime.getManifest().version;
}

export function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = latest.split('.').map(Number);
  const currentParts = current.split('.').map(Number);

  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

export function getReleasesUrl(): string {
  return `https://github.com/${GITHUB_REPO}/releases/latest`;
}
