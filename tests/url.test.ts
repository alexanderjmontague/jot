import { describe, it, expect } from 'vitest';
import {
  isValidWebUrl,
  stripWwwPrefix,
  getBaseDomainInfo,
  formatDisplayUrl,
} from '../src/shared/url';

describe('isValidWebUrl', () => {
  it('returns true for valid http URLs', () => {
    expect(isValidWebUrl('http://example.com')).toBe(true);
    expect(isValidWebUrl('http://example.com/path')).toBe(true);
  });

  it('returns true for valid https URLs', () => {
    expect(isValidWebUrl('https://example.com')).toBe(true);
    expect(isValidWebUrl('https://example.com/path?query=1')).toBe(true);
  });

  it('returns false for non-http protocols', () => {
    expect(isValidWebUrl('ftp://example.com')).toBe(false);
    expect(isValidWebUrl('file:///path/to/file')).toBe(false);
    expect(isValidWebUrl('chrome://extensions')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isValidWebUrl('not a url')).toBe(false);
    expect(isValidWebUrl('')).toBe(false);
    expect(isValidWebUrl(null)).toBe(false);
    expect(isValidWebUrl(undefined)).toBe(false);
  });
});

describe('stripWwwPrefix', () => {
  it('removes www. prefix', () => {
    expect(stripWwwPrefix('www.example.com')).toBe('example.com');
  });

  it('removes www with numbers', () => {
    expect(stripWwwPrefix('www2.example.com')).toBe('example.com');
    expect(stripWwwPrefix('www123.example.com')).toBe('example.com');
  });

  it('is case insensitive', () => {
    expect(stripWwwPrefix('WWW.example.com')).toBe('example.com');
    expect(stripWwwPrefix('Www.example.com')).toBe('example.com');
  });

  it('leaves non-www domains unchanged', () => {
    expect(stripWwwPrefix('example.com')).toBe('example.com');
    expect(stripWwwPrefix('subdomain.example.com')).toBe('subdomain.example.com');
  });
});

describe('getBaseDomainInfo', () => {
  it('extracts domain info from valid URLs', () => {
    const result = getBaseDomainInfo('https://www.example.com/path');
    expect(result).toEqual({
      key: 'www.example.com',
      label: 'example.com',
    });
  });

  it('includes custom ports in key and label', () => {
    const result = getBaseDomainInfo('https://example.com:8080/path');
    expect(result).toEqual({
      key: 'example.com:8080',
      label: 'example.com:8080',
    });
  });

  it('excludes default ports', () => {
    const http = getBaseDomainInfo('http://example.com:80/path');
    expect(http?.key).toBe('example.com');

    const https = getBaseDomainInfo('https://example.com:443/path');
    expect(https?.key).toBe('example.com');
  });

  it('returns null for invalid URLs', () => {
    expect(getBaseDomainInfo('not a url')).toBe(null);
    expect(getBaseDomainInfo('')).toBe(null);
    expect(getBaseDomainInfo(null)).toBe(null);
    expect(getBaseDomainInfo(undefined)).toBe(null);
  });
});

describe('formatDisplayUrl', () => {
  it('removes protocol and www prefix', () => {
    expect(formatDisplayUrl('https://www.example.com')).toBe('example.com');
    expect(formatDisplayUrl('http://www.example.com')).toBe('example.com');
  });

  it('preserves path, query, and hash', () => {
    expect(formatDisplayUrl('https://example.com/path')).toBe('example.com/path');
    expect(formatDisplayUrl('https://example.com/path?q=1')).toBe('example.com/path?q=1');
    expect(formatDisplayUrl('https://example.com/path#section')).toBe('example.com/path#section');
  });

  it('removes trailing slash on root paths', () => {
    expect(formatDisplayUrl('https://example.com/')).toBe('example.com');
  });

  it('shows custom ports', () => {
    expect(formatDisplayUrl('https://example.com:8080/path')).toBe('example.com:8080/path');
  });

  it('handles empty and null values', () => {
    expect(formatDisplayUrl('')).toBe('');
    expect(formatDisplayUrl(null)).toBe('');
    expect(formatDisplayUrl(undefined)).toBe('');
  });
});
