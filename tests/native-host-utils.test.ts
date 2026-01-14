import { describe, it, expect } from 'vitest';

// Import CommonJS module
const {
  normalizeUrl,
  normalizeFieldValue,
  slugify,
  parseYamlFrontmatter,
  serializeYamlFrontmatter,
} = require('../native-host/utils.cjs');

describe('normalizeUrl', () => {
  it('removes hash fragments', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe(
      'https://example.com/page'
    );
  });

  it('sorts query parameters alphabetically', () => {
    expect(normalizeUrl('https://example.com?z=1&a=2&m=3')).toBe(
      'https://example.com/?a=2&m=3&z=1'
    );
  });

  it('handles URLs without query params', () => {
    expect(normalizeUrl('https://example.com/path')).toBe(
      'https://example.com/path'
    );
  });

  it('returns original string for invalid URLs', () => {
    expect(normalizeUrl('not a url')).toBe('not a url');
  });
});

describe('normalizeFieldValue', () => {
  it('returns null for null/undefined', () => {
    expect(normalizeFieldValue(null)).toBe(null);
    expect(normalizeFieldValue(undefined)).toBe(null);
  });

  it('returns null for empty strings', () => {
    expect(normalizeFieldValue('')).toBe(null);
    expect(normalizeFieldValue('   ')).toBe(null);
  });

  it('returns null for placeholder values', () => {
    expect(normalizeFieldValue('n/a')).toBe(null);
    expect(normalizeFieldValue('N/A')).toBe(null);
    expect(normalizeFieldValue('none')).toBe(null);
    expect(normalizeFieldValue('null')).toBe(null);
    expect(normalizeFieldValue('undefined')).toBe(null);
    expect(normalizeFieldValue('---')).toBe(null);
    expect(normalizeFieldValue('TBD')).toBe(null);
  });

  it('trims and returns valid values', () => {
    expect(normalizeFieldValue('  hello  ')).toBe('hello');
    expect(normalizeFieldValue('valid value')).toBe('valid value');
  });

  it('passes through non-string values', () => {
    expect(normalizeFieldValue(123)).toBe(123);
    expect(normalizeFieldValue(true)).toBe(true);
  });
});

describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces non-alphanumeric with hyphens', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('test@example#com')).toBe('test-example-com');
  });

  it('removes leading/trailing hyphens', () => {
    expect(slugify('---hello---')).toBe('hello');
    expect(slugify('!@#test!@#')).toBe('test');
  });

  it('truncates to maxLength', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long, 10)).toBe('a'.repeat(10));
    expect(slugify(long)).toHaveLength(50); // default maxLength
  });

  it('handles empty strings', () => {
    expect(slugify('')).toBe('');
  });
});

describe('parseYamlFrontmatter', () => {
  it('parses standard frontmatter', () => {
    const content = `---
title: Hello World
url: https://example.com
---

Body content here.`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter).toEqual({
      title: 'Hello World',
      url: 'https://example.com',
    });
    expect(result.body.trim()).toBe('Body content here.');
  });

  it('handles quoted values', () => {
    const content = `---
title: "Hello: World"
desc: 'Single quoted'
---

Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.title).toBe('Hello: World');
    expect(result.frontmatter.desc).toBe('Single quoted');
  });

  it('returns empty frontmatter for content without frontmatter', () => {
    const content = 'Just some body content.';
    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe(content);
  });

  it('handles Windows line endings', () => {
    const content = '---\r\ntitle: Test\r\n---\r\nBody';
    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.title).toBe('Test');
  });
});

describe('serializeYamlFrontmatter', () => {
  it('serializes simple key-value pairs', () => {
    const frontmatter = { title: 'Hello', count: 5 };
    const result = serializeYamlFrontmatter(frontmatter);
    expect(result).toBe('---\ntitle: Hello\ncount: 5\n---');
  });

  it('quotes values with special characters', () => {
    const frontmatter = { url: 'https://example.com:8080' };
    const result = serializeYamlFrontmatter(frontmatter);
    expect(result).toContain('"https://example.com:8080"');
  });

  it('escapes quotes in values', () => {
    const frontmatter = { title: 'Hello "World"' };
    const result = serializeYamlFrontmatter(frontmatter);
    expect(result).toContain('Hello \\"World\\"');
  });

  it('skips null/undefined values', () => {
    const frontmatter = { title: 'Hello', empty: null, missing: undefined };
    const result = serializeYamlFrontmatter(frontmatter);
    expect(result).not.toContain('empty');
    expect(result).not.toContain('missing');
  });
});
