#!/usr/bin/env node

/**
 * Jot Native Messaging Host
 *
 * Bridges the Chrome extension to the local filesystem.
 * Reads/writes markdown files to an Obsidian vault.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG_DIR = path.join(os.homedir(), '.jot');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readConfig() {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getCommentsDir() {
  const config = readConfig();
  if (!config?.vaultPath) return null;
  const commentFolder = config.commentFolder || 'Jot';
  return path.join(config.vaultPath, commentFolder);
}

function ensureCommentsDir() {
  const commentsDir = getCommentsDir();
  if (commentsDir && !fs.existsSync(commentsDir)) {
    fs.mkdirSync(commentsDir, { recursive: true });
  }
  return commentsDir;
}

// ============================================================================
// Index Management (for O(1) URL lookups)
// ============================================================================

function getIndexPath() {
  const commentsDir = getCommentsDir();
  return commentsDir ? path.join(commentsDir, '.jot-index.json') : null;
}

function readIndex() {
  const indexPath = getIndexPath();
  if (!indexPath || !fs.existsSync(indexPath)) {
    return { entries: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch {
    return { entries: {} };
  }
}

function writeIndex(index) {
  const indexPath = getIndexPath();
  if (indexPath) {
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  }
}

function updateIndexEntry(url, filename, hasComments) {
  const index = readIndex();
  index.entries[url] = { filename, hasComments };
  writeIndex(index);
}

function removeIndexEntry(url) {
  const index = readIndex();
  delete index.entries[url];
  writeIndex(index);
}

// ============================================================================
// URL & Filename Utilities
// ============================================================================

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    const params = Array.from(parsed.searchParams.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    parsed.search = '';
    params.forEach(([k, v]) => parsed.searchParams.set(k, v));
    return parsed.toString();
  } catch {
    return url;
  }
}

// Treat common placeholder values as empty/null
function normalizeFieldValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Common placeholder patterns Claude or humans might use
  const placeholders = [
    'n/a', 'na', 'n.a.', 'n.a',
    'none', '(none)', '[none]',
    'null', '(null)', '[null]',
    'undefined', '(undefined)',
    'empty', '(empty)', '[empty]', '-empty-',
    'missing', '(missing)', '[missing]',
    'unknown', '(unknown)', '[unknown]',
    '-', '--', '---',
    '?', '???',
    'tbd', 'todo', 'fixme',
  ];

  if (placeholders.includes(trimmed.toLowerCase())) {
    return null;
  }

  return trimmed;
}

function slugify(text, maxLength = 50) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);
}

function generateFilename(url, title) {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');

    let slug;
    if (title) {
      slug = slugify(title);
    } else {
      // Use path as fallback
      slug = slugify(parsed.pathname) || 'page';
    }

    const base = `${domain}-${slug}`;
    const commentsDir = getCommentsDir();

    // Check for collision, append hash if needed
    let filename = `${base}.md`;
    if (commentsDir && fs.existsSync(path.join(commentsDir, filename))) {
      // Read existing file to check if it's the same URL
      const existing = readMarkdownFile(path.join(commentsDir, filename));
      if (existing?.frontmatter?.url !== url) {
        // Collision - append short hash
        const hash = Buffer.from(url).toString('base64').slice(0, 6).replace(/[+/=]/g, 'x');
        filename = `${base}-${hash}.md`;
      }
    }

    return filename;
  } catch {
    return `comment-${Date.now()}.md`;
  }
}

// ============================================================================
// Markdown File Operations
// ============================================================================

function parseYamlFrontmatter(content) {
  // Try multiple patterns for frontmatter (handles various line endings and edge cases)
  const patterns = [
    /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/,  // Standard with optional \r
    /^---\r?\n([\s\S]*?)\r?\n---\s*$([\s\S]*)/m,   // No trailing newline after ---
    /^---\r?\n([\s\S]*?)\r?\n---(.*)$/s,           // Minimal match
  ];

  let match = null;
  for (const pattern of patterns) {
    match = content.match(pattern);
    if (match) break;
  }

  if (!match) {
    // No frontmatter found - treat entire content as body
    return { frontmatter: {}, body: content };
  }

  const frontmatter = {};
  const frontmatterLines = match[1].split(/\r?\n/);

  for (const line of frontmatterLines) {
    try {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();
        // Remove quotes (handle escaped quotes too)
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
        }
        if (key) {
          frontmatter[key] = value;
        }
      }
    } catch {
      // Skip malformed lines, continue with others
    }
  }

  return { frontmatter, body: match[2] || '' };
}

function serializeYamlFrontmatter(frontmatter) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== undefined && value !== null) {
      // Quote strings that might have special chars
      const needsQuotes = typeof value === 'string' &&
        (value.includes(':') || value.includes('"') || value.includes("'"));
      const formatted = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;
      lines.push(`${key}: ${formatted}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

function readMarkdownFile(filepath) {
  try {
    if (!fs.existsSync(filepath)) return null;
    const content = fs.readFileSync(filepath, 'utf8');
    const stats = fs.statSync(filepath);
    const parsed = parseYamlFrontmatter(content);
    return { ...parsed, mtime: stats.mtimeMs };
  } catch (err) {
    // File might be locked, corrupted encoding, etc.
    return null;
  }
}

function writeMarkdownFile(filepath, frontmatter, body) {
  const content = serializeYamlFrontmatter(frontmatter) + '\n' + body;
  fs.writeFileSync(filepath, content);
}

// ============================================================================
// Comment Parsing
// ============================================================================

function tryParseDate(dateStr) {
  if (!dateStr) return null;

  // Try various date formats
  const formats = [
    // ISO-like: 2024-01-15 10:30
    () => {
      const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
      if (match) return new Date(match[1], match[2] - 1, match[3], match[4], match[5]).getTime();
      return null;
    },
    // ISO: 2024-01-15T10:30
    () => {
      const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (match) return new Date(match[1], match[2] - 1, match[3], match[4], match[5]).getTime();
      return null;
    },
    // Date only: 2024-01-15
    () => {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) return new Date(match[1], match[2] - 1, match[3]).getTime();
      return null;
    },
    // US format: 01/15/2024 or 1/15/2024
    () => {
      const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) return new Date(match[3], match[1] - 1, match[2]).getTime();
      return null;
    },
    // Natural: Jan 15, 2024 or January 15, 2024
    () => {
      const parsed = Date.parse(dateStr);
      if (!isNaN(parsed)) return parsed;
      return null;
    },
  ];

  for (const tryFormat of formats) {
    try {
      const result = tryFormat();
      if (result && !isNaN(result)) return result;
    } catch {
      // Continue to next format
    }
  }

  return null;
}

function parseComments(body, fileMtime = null) {
  const comments = [];

  // Match any ### heading and capture until the next ### or end
  // This is lenient - captures any h3 heading, not just dated ones
  const regex = /###\s+([^\n]*)\r?\n([\s\S]*?)(?=\r?\n###\s|\s*$)/g;
  let match;
  let fallbackIndex = 0;

  while ((match = regex.exec(body)) !== null) {
    const headingText = match[1].trim();
    const commentBody = match[2].trim();

    // Skip empty comments
    if (!commentBody) continue;

    // Try to parse date from heading, fall back to file mtime or index-based timestamp
    let createdAt = tryParseDate(headingText);

    if (!createdAt) {
      // Use file modification time if available, otherwise use a generated timestamp
      // Add index to ensure unique IDs even for undated entries
      createdAt = (fileMtime || Date.now()) - (fallbackIndex * 1000);
      fallbackIndex++;
    }

    comments.push({
      id: `${createdAt}`,
      body: commentBody,
      createdAt
    });
  }

  return comments;
}

function serializeComments(comments) {
  if (!comments || comments.length === 0) return '';

  const lines = ['## Notes', ''];

  for (const comment of comments) {
    const date = new Date(comment.createdAt);
    const dateStr = date.toISOString().slice(0, 16).replace('T', ' ');
    lines.push(`### ${dateStr}`);
    lines.push(comment.body);
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// Thread Operations
// ============================================================================

function threadFromFile(url, filepath) {
  try {
    const data = readMarkdownFile(filepath);
    if (!data) return null;

    const { frontmatter, body, mtime } = data;
    const comments = parseComments(body, mtime);

    // Try to parse dates, falling back to file mtime or now
    let createdAt = Date.now();
    let updatedAt = mtime || Date.now();

    if (frontmatter.created_at) {
      const parsed = Date.parse(frontmatter.created_at);
      if (!isNaN(parsed)) createdAt = parsed;
    }

    if (frontmatter.updated_at) {
      const parsed = Date.parse(frontmatter.updated_at);
      if (!isNaN(parsed)) updatedAt = parsed;
    } else if (mtime) {
      updatedAt = mtime;
    }

    return {
      id: url,
      url: frontmatter.url || url,
      title: normalizeFieldValue(frontmatter.title),
      faviconUrl: normalizeFieldValue(frontmatter.favicon),
      previewImageUrl: normalizeFieldValue(frontmatter.preview_image),
      createdAt,
      updatedAt,
      comments
    };
  } catch (err) {
    // If anything goes wrong parsing this file, return null so we skip it
    return null;
  }
}

function fileFromThread(thread) {
  const frontmatter = {
    url: thread.url,
    title: thread.title,
    favicon: thread.faviconUrl,
    preview_image: thread.previewImageUrl,
    created_at: new Date(thread.createdAt).toISOString(),
    updated_at: new Date(thread.updatedAt).toISOString()
  };

  const body = serializeComments(thread.comments);
  return { frontmatter, body };
}

// ============================================================================
// Message Handlers
// ============================================================================

async function handlePing() {
  return { ok: true, data: { status: 'ok', version: '1.0.0' } };
}

async function handleGetConfig() {
  const config = readConfig();
  return { ok: true, data: config };
}

async function handleSetConfig({ vaultPath, commentFolder }) {
  if (!vaultPath) {
    return { ok: false, error: 'vaultPath is required', code: 'INVALID_INPUT' };
  }

  // Validate path exists
  if (!fs.existsSync(vaultPath)) {
    return { ok: false, error: 'Vault path does not exist', code: 'PATH_NOT_FOUND' };
  }

  const config = { vaultPath, commentFolder: commentFolder || 'Jot' };
  writeConfig(config);
  ensureCommentsDir();

  // Initialize empty index if needed
  const indexPath = getIndexPath();
  if (indexPath && !fs.existsSync(indexPath)) {
    writeIndex({ entries: {} });
  }

  return { ok: true, data: config };
}

async function handleHasComments({ url }) {
  const normalized = normalizeUrl(url);
  const index = readIndex();
  const entry = index.entries[normalized];
  return { ok: true, data: entry?.hasComments || false };
}

async function handleGetThread({ url }) {
  const normalized = normalizeUrl(url);
  const index = readIndex();
  const entry = index.entries[normalized];

  if (!entry) {
    return { ok: true, data: null };
  }

  const commentsDir = getCommentsDir();
  const filepath = path.join(commentsDir, entry.filename);
  const thread = threadFromFile(normalized, filepath);

  return { ok: true, data: thread };
}

async function handleGetAllThreads() {
  const commentsDir = getCommentsDir();
  if (!commentsDir || !fs.existsSync(commentsDir)) {
    return { ok: true, data: [] };
  }

  const index = readIndex();
  const threads = [];
  const indexedFilenames = new Set();
  let indexNeedsUpdate = false;

  // First, process all indexed entries
  for (const [url, entry] of Object.entries(index.entries)) {
    try {
      indexedFilenames.add(entry.filename);
      const filepath = path.join(commentsDir, entry.filename);

      if (!fs.existsSync(filepath)) {
        // File was deleted externally - remove from index
        delete index.entries[url];
        indexNeedsUpdate = true;
        continue;
      }

      const thread = threadFromFile(url, filepath);
      if (thread) threads.push(thread);
    } catch (err) {
      // Skip this entry if anything goes wrong, don't fail the whole list
    }
  }

  // Second, scan for orphaned .md files not in the index
  try {
    const files = fs.readdirSync(commentsDir);
    for (const filename of files) {
      try {
        // Skip non-markdown files and the index file
        if (!filename.endsWith('.md') || filename.startsWith('.')) continue;
        if (indexedFilenames.has(filename)) continue;

        const filepath = path.join(commentsDir, filename);
        const stats = fs.statSync(filepath);
        if (!stats.isFile()) continue;

        // Try to read and parse the orphaned file
        const data = readMarkdownFile(filepath);
        if (!data) continue;

        const { frontmatter, body, mtime } = data;

        // Need a URL to index this - try frontmatter, then generate from filename
        let url = frontmatter.url;
        if (!url) {
          // Generate a pseudo-URL from filename so we can track it
          url = `file://${filename}`;
        }

        const normalized = normalizeUrl(url);
        const comments = parseComments(body, mtime);

        // Build thread from what we can parse
        const thread = {
          id: normalized,
          url: frontmatter.url || url,
          title: normalizeFieldValue(frontmatter.title) || filename.replace('.md', ''),
          faviconUrl: normalizeFieldValue(frontmatter.favicon),
          previewImageUrl: normalizeFieldValue(frontmatter.preview_image),
          createdAt: frontmatter.created_at ? Date.parse(frontmatter.created_at) || mtime : mtime,
          updatedAt: mtime || Date.now(),
          comments
        };

        threads.push(thread);

        // Auto-heal: add to index
        index.entries[normalized] = { filename, hasComments: comments.length > 0 };
        indexNeedsUpdate = true;
      } catch (err) {
        // Skip this file if anything goes wrong
      }
    }
  } catch (err) {
    // If we can't read the directory, just return what we have from the index
  }

  // Save updated index if we made changes
  if (indexNeedsUpdate) {
    try {
      writeIndex(index);
    } catch (err) {
      // Index write failed, but we can still return the threads
    }
  }

  // Sort by updatedAt descending
  threads.sort((a, b) => b.updatedAt - a.updatedAt);

  return { ok: true, data: threads };
}

async function handleAppendComment({ url, body, metadata }) {
  const normalized = normalizeUrl(url);
  const commentsDir = ensureCommentsDir();
  if (!commentsDir) {
    return { ok: false, error: 'Not configured', code: 'NOT_CONFIGURED' };
  }

  const index = readIndex();
  let entry = index.entries[normalized];
  let thread;

  if (entry) {
    // Existing thread - load and append
    const filepath = path.join(commentsDir, entry.filename);
    thread = threadFromFile(normalized, filepath);
  } else {
    // New thread
    const filename = generateFilename(url, metadata?.title);
    entry = { filename, hasComments: false };
    thread = {
      id: normalized,
      url: normalized,
      title: metadata?.title || null,
      faviconUrl: metadata?.faviconUrl || null,
      previewImageUrl: metadata?.previewImageUrl || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      comments: []
    };
  }

  // Update metadata if provided
  if (metadata) {
    if (metadata.title) thread.title = metadata.title;
    if (metadata.faviconUrl) thread.faviconUrl = metadata.faviconUrl;
    if (metadata.previewImageUrl) thread.previewImageUrl = metadata.previewImageUrl;
  }

  // Add new comment
  const newComment = {
    id: `${Date.now()}`,
    body,
    createdAt: Date.now()
  };
  thread.comments.push(newComment);
  thread.updatedAt = Date.now();

  // Write file
  const { frontmatter, body: fileBody } = fileFromThread(thread);
  const filepath = path.join(commentsDir, entry.filename);
  writeMarkdownFile(filepath, frontmatter, fileBody);

  // Update index
  updateIndexEntry(normalized, entry.filename, thread.comments.length > 0);

  return { ok: true, data: thread };
}

async function handleDeleteComment({ url, commentId }) {
  const normalized = normalizeUrl(url);
  const commentsDir = getCommentsDir();
  if (!commentsDir) {
    return { ok: false, error: 'Not configured', code: 'NOT_CONFIGURED' };
  }

  const index = readIndex();
  const entry = index.entries[normalized];
  if (!entry) {
    return { ok: false, error: 'Thread not found', code: 'NOT_FOUND' };
  }

  const filepath = path.join(commentsDir, entry.filename);
  const thread = threadFromFile(normalized, filepath);
  if (!thread) {
    return { ok: false, error: 'Thread not found', code: 'NOT_FOUND' };
  }

  // Remove comment
  const initialCount = thread.comments.length;
  thread.comments = thread.comments.filter(c => c.id !== commentId);

  if (thread.comments.length === initialCount) {
    return { ok: false, error: 'Comment not found', code: 'NOT_FOUND' };
  }

  thread.updatedAt = Date.now();

  // Write updated file
  const { frontmatter, body } = fileFromThread(thread);
  writeMarkdownFile(filepath, frontmatter, body);

  // Update index
  updateIndexEntry(normalized, entry.filename, thread.comments.length > 0);

  return { ok: true, data: thread };
}

async function handleDeleteThread({ url }) {
  const normalized = normalizeUrl(url);
  const commentsDir = getCommentsDir();
  if (!commentsDir) {
    return { ok: false, error: 'Not configured', code: 'NOT_CONFIGURED' };
  }

  const index = readIndex();
  const entry = index.entries[normalized];
  if (!entry) {
    return { ok: true, data: null }; // Already deleted
  }

  // Delete file
  const filepath = path.join(commentsDir, entry.filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }

  // Remove from index
  removeIndexEntry(normalized);

  return { ok: true, data: null };
}

// ============================================================================
// Message Router
// ============================================================================

async function handleRequest(request) {
  const { type, ...params } = request;

  try {
    switch (type) {
      case 'ping': return await handlePing();
      case 'getConfig': return await handleGetConfig();
      case 'setConfig': return await handleSetConfig(params);
      case 'hasComments': return await handleHasComments(params);
      case 'getThread': return await handleGetThread(params);
      case 'getAllThreads': return await handleGetAllThreads();
      case 'appendComment': return await handleAppendComment(params);
      case 'deleteComment': return await handleDeleteComment(params);
      case 'deleteThread': return await handleDeleteThread(params);
      default:
        return { ok: false, error: `Unknown message type: ${type}`, code: 'UNKNOWN_TYPE' };
    }
  } catch (error) {
    return { ok: false, error: error.message, code: 'INTERNAL_ERROR' };
  }
}

// ============================================================================
// Chrome Native Messaging I/O
// ============================================================================

function sendMessage(msg) {
  const json = JSON.stringify(msg);
  const buffer = Buffer.alloc(4 + json.length);
  buffer.writeUInt32LE(json.length, 0);
  buffer.write(json, 4);
  process.stdout.write(buffer);
}

async function readMessage() {
  return new Promise((resolve, reject) => {
    let lengthBuffer = Buffer.alloc(0);
    let messageBuffer = Buffer.alloc(0);
    let expectedLength = null;

    const processData = () => {
      // Read length prefix (4 bytes)
      if (expectedLength === null && lengthBuffer.length >= 4) {
        expectedLength = lengthBuffer.readUInt32LE(0);
        messageBuffer = lengthBuffer.slice(4);
        lengthBuffer = Buffer.alloc(0);
      }

      // Read message body
      if (expectedLength !== null && messageBuffer.length >= expectedLength) {
        const json = messageBuffer.slice(0, expectedLength).toString('utf8');
        try {
          resolve(JSON.parse(json));
        } catch (e) {
          reject(new Error('Invalid JSON: ' + e.message));
        }
      }
    };

    process.stdin.on('data', (chunk) => {
      if (expectedLength === null) {
        lengthBuffer = Buffer.concat([lengthBuffer, chunk]);
      } else {
        messageBuffer = Buffer.concat([messageBuffer, chunk]);
      }
      processData();
    });

    process.stdin.on('end', () => {
      reject(new Error('stdin closed'));
    });

    process.stdin.on('error', reject);
  });
}

async function main() {
  // Process messages one at a time
  while (true) {
    try {
      const request = await readMessage();
      const response = await handleRequest(request);
      sendMessage({ id: request.id, ...response });
    } catch (error) {
      // stdin closed or other fatal error - exit cleanly
      process.exit(0);
    }
  }
}

main();
