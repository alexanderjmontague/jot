const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const DEFAULT_PORT_BY_PROTOCOL: Record<string, string> = {
  'http:': '80',
  'https:': '443',
};
const PROTOCOL_PREFIX = /^[a-zA-Z]+:\/\//;
const WWW_PREFIX = /^www\d*\./i;

export function isValidWebUrl(url: string | undefined | null): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return HTTP_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function stripWwwPrefix(value: string): string {
  return value.replace(WWW_PREFIX, '');
}

export type BaseDomainInfo = {
  key: string;
  label: string;
};

export function getBaseDomainInfo(rawUrl: string | undefined | null): BaseDomainInfo | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname) {
      return null;
    }

    const defaultPort = DEFAULT_PORT_BY_PROTOCOL[parsed.protocol];
    const hasCustomPort = parsed.port.length > 0 && parsed.port !== defaultPort;
    const key = hasCustomPort ? `${hostname}:${parsed.port}` : hostname;
    const labelHostname = stripWwwPrefix(hostname);
    const label = hasCustomPort ? `${labelHostname}:${parsed.port}` : labelHostname;

    return {
      key,
      label,
    };
  } catch {
    return null;
  }
}

export function formatDisplayUrl(rawUrl: string | undefined | null): string {
  if (!rawUrl) {
    return '';
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
      return trimmed;
    }

    const hostname = stripWwwPrefix(parsed.hostname);
    const defaultPort = DEFAULT_PORT_BY_PROTOCOL[parsed.protocol];
    const port = parsed.port && parsed.port !== defaultPort ? `:${parsed.port}` : '';
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname;
    const search = parsed.search;
    const hash = parsed.hash;
    const formatted = `${hostname}${port}${pathname}${search}${hash}`;

    if (formatted) {
      return formatted;
    }
  } catch {
    // fall through to regex cleanup below
  }

  return stripWwwPrefix(trimmed.replace(PROTOCOL_PREFIX, ''));
}
