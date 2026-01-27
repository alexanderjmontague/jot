import Foundation

// MARK: - Configuration

struct Config: Codable {
    var vaultPath: String
    var commentFolder: String

    static let configDir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".jot")
    static let configFile = configDir.appendingPathComponent("config.json")

    static func read() -> Config? {
        guard let data = try? Data(contentsOf: configFile) else { return nil }
        return try? JSONDecoder().decode(Config.self, from: data)
    }

    static func write(_ config: Config) throws {
        try FileManager.default.createDirectory(at: configDir, withIntermediateDirectories: true)
        let data = try JSONEncoder().encode(config)
        try data.write(to: configFile)
    }

    var commentsDir: URL {
        URL(fileURLWithPath: vaultPath).appendingPathComponent(commentFolder)
    }

    var bookmarksFile: URL {
        commentsDir.appendingPathComponent("bookmarks.md")
    }

    var metadataFile: URL {
        commentsDir.appendingPathComponent(".jot-meta.json")
    }

    // Legacy index file for migration
    var legacyIndexFile: URL {
        commentsDir.appendingPathComponent(".jot-index.json")
    }
}

// MARK: - Metadata JSON (for extension UI)

struct EntryMeta: Codable {
    var favicon: String?
    var previewImage: String?
    var createdAt: Int64
}

struct Metadata: Codable {
    var version: Int
    var entries: [String: EntryMeta]  // URL -> metadata

    static func read(from url: URL) -> Metadata {
        guard let data = try? Data(contentsOf: url),
              let meta = try? JSONDecoder().decode(Metadata.self, from: data) else {
            return Metadata(version: 1, entries: [:])
        }
        return meta
    }

    func write(to url: URL) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        let data = try encoder.encode(self)
        try data.write(to: url)
    }
}

// MARK: - Data Models

struct ClipComment: Codable {
    var id: String
    var body: String
    var createdAt: Int64
}

struct ClipThread: Codable {
    var id: String
    var url: String
    var title: String?
    var faviconUrl: String?
    var previewImageUrl: String?
    var createdAt: Int64
    var updatedAt: Int64
    var comments: [ClipComment]
    var folder: String  // e.g., "Uncategorized", "Finance", "Tech"
}

struct ClipMetadata: Codable {
    var title: String?
    var faviconUrl: String?
    var previewImageUrl: String?
}

// MARK: - Parsed Bookmark Data

struct ParsedEntry {
    var url: String
    var title: String
    var date: String
    var comments: [String]
}

struct ParsedFolder {
    var name: String
    var level: Int  // 1, 2, or 3
    var entries: [ParsedEntry]
    var children: [ParsedFolder]

    init(name: String, level: Int = 1, entries: [ParsedEntry] = [], children: [ParsedFolder] = []) {
        self.name = name
        self.level = level
        self.entries = entries
        self.children = children
    }

    // Generate unique ID based on path
    func id(parentPath: String? = nil) -> String {
        let base = name.lowercased().replacingOccurrences(of: " ", with: "-")
        if let parent = parentPath {
            return "\(parent)/\(base)"
        }
        return base
    }

    // Get full path for display
    func path(parentPath: String? = nil) -> String {
        if let parent = parentPath {
            return "\(parent)/\(name)"
        }
        return name
    }
}

struct ParsedDocument {
    var folders: [ParsedFolder]  // Root-level folders (level 1)
}

// MARK: - Message Types

struct ImportBookmark: Codable {
    var url: String
    var title: String?
    var faviconUrl: String?
    var folder: String?
}

struct Request: Codable {
    var id: Int
    var type: String
    var url: String?
    var body: String?
    var metadata: ClipMetadata?
    var commentId: String?
    var vaultPath: String?
    var commentFolder: String?
    var folder: String?       // For appendComment (which folder to save to)
    var path: String?         // For createFolder (folder name)
    var oldPath: String?      // For renameFolder (old name)
    var newPath: String?      // For renameFolder (new name)
    var toFolder: String?     // For moveThread (destination folder name)
    var recursive: Bool?      // For deleteFolder
    var parentId: String?     // For createFolder (parent folder ID for nesting)
    var folderId: String?     // For reorderFolder/nestFolder (folder to move)
    var targetParentId: String?  // For nestFolder (folder to nest into, null for root)
    var beforeId: String?     // For reorderFolder (place before this folder)
    var afterId: String?      // For reorderFolder (place after this folder)
    var bookmarks: [ImportBookmark]?  // For importBookmarks
}

struct Response: Encodable {
    var id: Int
    var ok: Bool
    var data: AnyCodable?
    var error: String?
    var code: String?
}

struct AnyCodable: Encodable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let int64 as Int64:
            try container.encode(int64)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        case let encodable as Encodable:
            try encodable.encode(to: encoder)
        case is NSNull:
            try container.encodeNil()
        default:
            try container.encodeNil()
        }
    }
}

// MARK: - URL Normalization

func normalizeUrl(_ url: String) -> String {
    guard var components = URLComponents(string: url) else { return url }
    components.fragment = nil
    if let queryItems = components.queryItems {
        components.queryItems = queryItems.sorted { $0.name < $1.name }
    }
    return components.string ?? url
}

// MARK: - Date Formatting

func formatDate(_ timestamp: Int64) -> String {
    let date = Date(timeIntervalSince1970: Double(timestamp) / 1000)
    let formatter = DateFormatter()
    formatter.dateFormat = "MMM d, yyyy"
    return formatter.string(from: date)
}

func parseDate(_ dateStr: String) -> Int64? {
    let formatter = DateFormatter()
    formatter.dateFormat = "MMM d, yyyy"
    if let date = formatter.date(from: dateStr) {
        return Int64(date.timeIntervalSince1970 * 1000)
    }
    return nil
}

// MARK: - Markdown Parsing

func parseBookmarksMarkdown(_ content: String) -> ParsedDocument {
    var rootFolders: [ParsedFolder] = []
    var currentL1: ParsedFolder? = nil
    var currentL2: ParsedFolder? = nil
    var currentL3: ParsedFolder? = nil
    var currentEntry: ParsedEntry? = nil

    let lines = content.components(separatedBy: "\n")

    // Helper to save current entry to the deepest active folder
    func saveCurrentEntry() {
        guard let entry = currentEntry else { return }
        if currentL3 != nil {
            currentL3!.entries.append(entry)
        } else if currentL2 != nil {
            currentL2!.entries.append(entry)
        } else if currentL1 != nil {
            currentL1!.entries.append(entry)
        }
        currentEntry = nil
    }

    // Helper to finalize L3 into L2
    func finalizeL3() {
        guard let l3 = currentL3 else { return }
        currentL2?.children.append(l3)
        currentL3 = nil
    }

    // Helper to finalize L2 into L1
    func finalizeL2() {
        finalizeL3()
        guard let l2 = currentL2 else { return }
        currentL1?.children.append(l2)
        currentL2 = nil
    }

    // Helper to finalize L1 into root
    func finalizeL1() {
        finalizeL2()
        guard let l1 = currentL1 else { return }
        rootFolders.append(l1)
        currentL1 = nil
    }

    for line in lines {
        // Check for level 1 header: ## Header (but not ### or ####)
        if line.hasPrefix("## ") && !line.hasPrefix("### ") {
            saveCurrentEntry()
            finalizeL1()

            let folderName = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
            currentL1 = ParsedFolder(name: folderName, level: 1)
            continue
        }

        // Check for level 2 header: ### Header (but not ####)
        if line.hasPrefix("### ") && !line.hasPrefix("#### ") {
            saveCurrentEntry()
            finalizeL2()

            let folderName = String(line.dropFirst(4)).trimmingCharacters(in: .whitespaces)
            currentL2 = ParsedFolder(name: folderName, level: 2)
            continue
        }

        // Check for level 3 header: #### Header
        if line.hasPrefix("#### ") {
            saveCurrentEntry()
            finalizeL3()

            let folderName = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
            currentL3 = ParsedFolder(name: folderName, level: 3)
            continue
        }

        // Check for entry line: - **[Title](url)** — Date
        if line.hasPrefix("- **[") {
            saveCurrentEntry()

            // Parse: - **[Title](url)** — Date
            let pattern = #"^- \*\*\[(.+?)\]\((.+?)\)\*\* — (.+)$"#
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)) {
                let titleRange = Range(match.range(at: 1), in: line)!
                let urlRange = Range(match.range(at: 2), in: line)!
                let dateRange = Range(match.range(at: 3), in: line)!

                currentEntry = ParsedEntry(
                    url: String(line[urlRange]),
                    title: String(line[titleRange]),
                    date: String(line[dateRange]),
                    comments: []
                )
            }
            continue
        }

        // Check for comment line:   > comment text
        if line.hasPrefix("  > ") {
            let comment = String(line.dropFirst(4))
            currentEntry?.comments.append(comment)
            continue
        }
    }

    // Save remaining entries and finalize all folders
    saveCurrentEntry()
    finalizeL1()

    return ParsedDocument(folders: rootFolders)
}

// MARK: - Markdown Serialization

func serializeBookmarksMarkdown(_ doc: ParsedDocument) -> String {
    var lines: [String] = ["# My Web Clips", ""]

    func writeFolder(_ folder: ParsedFolder, level: Int) {
        // Write heading with correct number of #s (level 1 = ##, level 2 = ###, level 3 = ####)
        let prefix = String(repeating: "#", count: level + 1)
        lines.append("\(prefix) \(folder.name)")

        // Write entries
        for entry in folder.entries {
            lines.append("- **[\(entry.title)](\(entry.url))** — \(entry.date)")
            for comment in entry.comments {
                lines.append("  > \(comment)")
            }
        }

        // Write children recursively
        for child in folder.children {
            writeFolder(child, level: level + 1)
        }

        lines.append("")
    }

    for folder in doc.folders {
        writeFolder(folder, level: 1)
    }

    return lines.joined(separator: "\n")
}

// MARK: - Document Operations

func readDocument(config: Config) -> ParsedDocument {
    guard let content = try? String(contentsOf: config.bookmarksFile, encoding: .utf8) else {
        // Return default document with Uncategorized folder
        return ParsedDocument(folders: [ParsedFolder(name: "Uncategorized", entries: [])])
    }

    var doc = parseBookmarksMarkdown(content)

    // Ensure Uncategorized folder exists
    if !doc.folders.contains(where: { $0.name == "Uncategorized" }) {
        doc.folders.insert(ParsedFolder(name: "Uncategorized", entries: []), at: 0)
    }

    return doc
}

func writeDocument(_ doc: ParsedDocument, config: Config) throws {
    let content = serializeBookmarksMarkdown(doc)
    try FileManager.default.createDirectory(at: config.commentsDir, withIntermediateDirectories: true)
    try content.write(to: config.bookmarksFile, atomically: true, encoding: .utf8)
}

func findEntry(in doc: ParsedDocument, url: String) -> (folderIndex: Int, entryIndex: Int)? {
    for (fi, folder) in doc.folders.enumerated() {
        for (ei, entry) in folder.entries.enumerated() {
            if entry.url == url {
                return (fi, ei)
            }
        }
    }
    return nil
}

// MARK: - Thread Conversion

func entryToThread(_ entry: ParsedEntry, folder: String, metadata: Metadata) -> ClipThread {
    let meta = metadata.entries[entry.url]
    let createdAt = parseDate(entry.date) ?? Int64(Date().timeIntervalSince1970 * 1000)

    // Convert comment strings to ClipComment objects
    let comments = entry.comments.enumerated().map { (index, body) in
        ClipComment(
            id: "\(createdAt + Int64(index))",
            body: body,
            createdAt: createdAt + Int64(index * 1000)
        )
    }

    let updatedAt = comments.last?.createdAt ?? createdAt

    return ClipThread(
        id: entry.url,
        url: entry.url,
        title: entry.title,
        faviconUrl: meta?.favicon,
        previewImageUrl: meta?.previewImage,
        createdAt: meta?.createdAt ?? createdAt,
        updatedAt: updatedAt,
        comments: comments,
        folder: folder
    )
}

func threadToDict(_ thread: ClipThread) -> [String: Any] {
    var dict: [String: Any] = [
        "id": thread.id,
        "url": thread.url,
        "createdAt": thread.createdAt,
        "updatedAt": thread.updatedAt,
        "folder": thread.folder,
        "comments": thread.comments.map { comment in
            [
                "id": comment.id,
                "body": comment.body,
                "createdAt": comment.createdAt
            ] as [String: Any]
        }
    ]

    if let title = thread.title { dict["title"] = title }
    if let faviconUrl = thread.faviconUrl { dict["faviconUrl"] = faviconUrl }
    if let previewImageUrl = thread.previewImageUrl { dict["previewImageUrl"] = previewImageUrl }

    return dict
}

// MARK: - Migration from Old Format

func migrateFromLegacyFormat(config: Config) {
    // Check if already migrated
    if FileManager.default.fileExists(atPath: config.bookmarksFile.path) {
        return
    }

    // Check for legacy index
    guard FileManager.default.fileExists(atPath: config.legacyIndexFile.path),
          let indexData = try? Data(contentsOf: config.legacyIndexFile),
          let legacyIndex = try? JSONDecoder().decode(LegacyIndex.self, from: indexData) else {
        return
    }

    var folders: [String: [ParsedEntry]] = ["Uncategorized": []]
    var metadata = Metadata(version: 1, entries: [:])

    for (url, entry) in legacyIndex.entries {
        let folderPath = entry.folder ?? "/"
        let folderName = folderPath == "/" ? "Uncategorized" : String(folderPath.split(separator: "/").last ?? "Uncategorized")

        // Read the old markdown file
        let relativePath = folderPath == "/" ? "" : String(folderPath.dropFirst())
        let filepath = config.commentsDir.appendingPathComponent(relativePath).appendingPathComponent(entry.filename)

        guard let content = try? String(contentsOf: filepath, encoding: .utf8) else { continue }

        let (frontmatter, body) = parseLegacyFrontmatter(content)
        let comments = parseLegacyComments(body)

        let title = frontmatter["title"] ?? "Untitled"
        let createdAtStr = frontmatter["created_at"] ?? ""
        let isoFormatter = ISO8601DateFormatter()
        let createdAt = isoFormatter.date(from: createdAtStr).map { Int64($0.timeIntervalSince1970 * 1000) } ?? Int64(Date().timeIntervalSince1970 * 1000)

        let parsedEntry = ParsedEntry(
            url: url,
            title: title,
            date: formatDate(createdAt),
            comments: comments
        )

        if folders[folderName] == nil {
            folders[folderName] = []
        }
        folders[folderName]!.append(parsedEntry)

        // Store metadata
        metadata.entries[url] = EntryMeta(
            favicon: frontmatter["favicon"],
            previewImage: frontmatter["preview_image"],
            createdAt: createdAt
        )
    }

    // Build document
    var parsedFolders: [ParsedFolder] = []

    // Uncategorized first
    if let entries = folders.removeValue(forKey: "Uncategorized") {
        parsedFolders.append(ParsedFolder(name: "Uncategorized", entries: entries))
    }

    // Then other folders sorted alphabetically
    for name in folders.keys.sorted() {
        parsedFolders.append(ParsedFolder(name: name, entries: folders[name]!))
    }

    let doc = ParsedDocument(folders: parsedFolders)

    // Write new format
    do {
        try writeDocument(doc, config: config)
        try metadata.write(to: config.metadataFile)

        // Archive old files
        let archiveDir = config.commentsDir.appendingPathComponent(".archive")
        try FileManager.default.createDirectory(at: archiveDir, withIntermediateDirectories: true)
        try FileManager.default.moveItem(at: config.legacyIndexFile, to: archiveDir.appendingPathComponent(".jot-index.json"))

        // Move old .md files to archive
        let files = try FileManager.default.contentsOfDirectory(at: config.commentsDir, includingPropertiesForKeys: nil)
        for file in files {
            if file.pathExtension == "md" && file.lastPathComponent != "bookmarks.md" {
                try FileManager.default.moveItem(at: file, to: archiveDir.appendingPathComponent(file.lastPathComponent))
            }
        }
    } catch {
        // Migration failed, will use empty document
    }
}

// Legacy parsing helpers
struct LegacyIndexEntry: Codable {
    var filename: String
    var hasComments: Bool
    var folder: String?
}

struct LegacyIndex: Codable {
    var version: Int?
    var folders: [String: LegacyFolderMeta]?
    var entries: [String: LegacyIndexEntry]
}

struct LegacyFolderMeta: Codable {
    var name: String
    var createdAt: Int64
}

func parseLegacyFrontmatter(_ content: String) -> (frontmatter: [String: String], body: String) {
    let pattern = "^---\\n([\\s\\S]*?)\\n---"
    guard let regex = try? NSRegularExpression(pattern: pattern),
          let match = regex.firstMatch(in: content, range: NSRange(content.startIndex..., in: content)),
          let yamlRange = Range(match.range(at: 1), in: content),
          let fullMatchRange = Range(match.range, in: content) else {
        return ([:], content)
    }

    let yamlString = String(content[yamlRange])
    var frontmatter: [String: String] = [:]

    for line in yamlString.split(separator: "\n") {
        if let colonIndex = line.firstIndex(of: ":") {
            let key = String(line[..<colonIndex]).trimmingCharacters(in: .whitespaces)
            var value = String(line[line.index(after: colonIndex)...]).trimmingCharacters(in: .whitespaces)
            if (value.hasPrefix("\"") && value.hasSuffix("\"")) ||
               (value.hasPrefix("'") && value.hasSuffix("'")) {
                value = String(value.dropFirst().dropLast())
            }
            frontmatter[key] = value
        }
    }

    // Get body content after frontmatter
    let body = String(content[fullMatchRange.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)

    return (frontmatter, body)
}

func parseLegacyComments(_ body: String) -> [String] {
    var comments: [String] = []
    let pattern = "### \\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}\\n([\\s\\S]*?)(?=\\n### |\\n*$)"

    guard let regex = try? NSRegularExpression(pattern: pattern) else { return comments }

    let matches = regex.matches(in: body, range: NSRange(body.startIndex..., in: body))

    for match in matches {
        guard let bodyRange = Range(match.range(at: 1), in: body) else { continue }
        let commentBody = String(body[bodyRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        if !commentBody.isEmpty {
            comments.append(commentBody)
        }
    }

    return comments
}

// MARK: - Message Handlers

func handlePing() -> Response {
    return Response(id: 0, ok: true, data: AnyCodable(["status": "ok", "version": "2.0.0"]), error: nil, code: nil)
}

func handleGetConfig() -> Response {
    if let config = Config.read() {
        return Response(id: 0, ok: true, data: AnyCodable(["vaultPath": config.vaultPath, "commentFolder": config.commentFolder]), error: nil, code: nil)
    }
    return Response(id: 0, ok: true, data: nil, error: nil, code: nil)
}

func handleSetConfig(vaultPath: String?, commentFolder: String?) -> Response {
    guard let vaultPath = vaultPath, !vaultPath.isEmpty else {
        return Response(id: 0, ok: false, data: nil, error: "vaultPath is required", code: "INVALID_INPUT")
    }

    // Expand tilde to home directory
    let expandedPath = (vaultPath as NSString).expandingTildeInPath

    // Security: Reject path traversal attempts
    guard !expandedPath.contains("..") else {
        return Response(id: 0, ok: false, data: nil, error: "Path cannot contain '..'", code: "INVALID_PATH")
    }

    // Security: Resolve symlinks and normalize path
    let resolvedURL = URL(fileURLWithPath: expandedPath).standardized.resolvingSymlinksInPath()
    let resolvedPath = resolvedURL.path

    // Security: Require vault to be within user's home directory
    let home = FileManager.default.homeDirectoryForCurrentUser.path
    guard resolvedPath.hasPrefix(home) else {
        return Response(id: 0, ok: false, data: nil, error: "Vault must be within home directory", code: "INVALID_PATH")
    }

    var isDir: ObjCBool = false
    guard FileManager.default.fileExists(atPath: resolvedPath, isDirectory: &isDir), isDir.boolValue else {
        return Response(id: 0, ok: false, data: nil, error: "Vault path does not exist", code: "PATH_NOT_FOUND")
    }

    // Security: Validate commentFolder to prevent path traversal
    let folder = commentFolder ?? "Jot"
    guard isValidFolderName(folder) else {
        return Response(id: 0, ok: false, data: nil, error: "Invalid folder name (use only letters, numbers, spaces, hyphens, underscores)", code: "INVALID_INPUT")
    }

    let config = Config(vaultPath: vaultPath, commentFolder: folder)

    do {
        try Config.write(config)
        try FileManager.default.createDirectory(at: config.commentsDir, withIntermediateDirectories: true)

        // Run migration if needed
        migrateFromLegacyFormat(config: config)

        // Initialize with self-documenting template if needed
        if !FileManager.default.fileExists(atPath: config.bookmarksFile.path) {
            let initialContent = """
            # My Web Clips

            <!--
            JOT BOOKMARKS FORMAT GUIDE

            FOLDERS use markdown heading levels:
              ## FolderName        = Level 1 (root folder)
              ### SubFolder        = Level 2 (nested inside level 1)
              #### DeepFolder      = Level 3 (max depth, no deeper nesting allowed)

            BOOKMARKS use this format:
              - **[Page Title](https://example.com)** — Jan 24, 2025
                > Optional comment line 1
                > Optional comment line 2

            FORMAT DETAILS:
              - Date format: "MMM d, yyyy" (e.g., "Jan 24, 2025")
              - Comments are indented with "  > " (2 spaces followed by > and space)
              - Bookmarks without comments are valid (just omit the > lines)
              - URLs are normalized (tracking params stripped, www removed)
              - Metadata (favicons, preview images) stored in .jot-meta.json

            FOLDER OPERATIONS (via native messaging API):
              - createFolder(name, parentId?) - creates folder, parentId for nesting
              - renameFolder(oldPath, newPath) - rename a folder
              - deleteFolder(path, recursive?) - delete folder (recursive=true if not empty)
              - nestFolder(folderId, targetParentId) - move folder into another
              - moveThread(url, toFolder) - move bookmark to different folder

            SPECIAL FOLDERS:
              - "Uncategorized" is the default folder, cannot be renamed or deleted
            -->

            ## Uncategorized

            """
            try initialContent.write(to: config.bookmarksFile, atomically: true, encoding: .utf8)
        }

        return Response(id: 0, ok: true, data: AnyCodable(["vaultPath": config.vaultPath, "commentFolder": config.commentFolder]), error: nil, code: nil)
    } catch {
        return Response(id: 0, ok: false, data: nil, error: error.localizedDescription, code: "IO_ERROR")
    }
}

func handleHasComments(url: String?) -> Response {
    guard let url = url, let config = Config.read() else {
        return Response(id: 0, ok: true, data: AnyCodable(false), error: nil, code: nil)
    }

    let normalized = normalizeUrl(url)
    let doc = readDocument(config: config)
    let hasComments = findEntry(in: doc, url: normalized) != nil

    return Response(id: 0, ok: true, data: AnyCodable(hasComments), error: nil, code: nil)
}

func handleGetThread(url: String?) -> Response {
    guard let url = url, let config = Config.read() else {
        return Response(id: 0, ok: true, data: nil, error: nil, code: nil)
    }

    let normalized = normalizeUrl(url)
    let doc = readDocument(config: config)
    let metadata = Metadata.read(from: config.metadataFile)

    guard let (fi, ei) = findEntry(in: doc, url: normalized) else {
        return Response(id: 0, ok: true, data: nil, error: nil, code: nil)
    }

    let entry = doc.folders[fi].entries[ei]
    let thread = entryToThread(entry, folder: doc.folders[fi].name, metadata: metadata)

    return Response(id: 0, ok: true, data: AnyCodable(threadToDict(thread)), error: nil, code: nil)
}

func handleGetAllThreads() -> Response {
    guard let config = Config.read() else {
        return Response(id: 0, ok: true, data: AnyCodable([Any]()), error: nil, code: nil)
    }

    // Run migration if needed
    migrateFromLegacyFormat(config: config)

    let doc = readDocument(config: config)
    let metadata = Metadata.read(from: config.metadataFile)
    var threads: [[String: Any]] = []

    for folder in doc.folders {
        for entry in folder.entries {
            let thread = entryToThread(entry, folder: folder.name, metadata: metadata)
            threads.append(threadToDict(thread))
        }
    }

    // Sort by updatedAt descending
    threads.sort { ($0["updatedAt"] as? Int64 ?? 0) > ($1["updatedAt"] as? Int64 ?? 0) }

    return Response(id: 0, ok: true, data: AnyCodable(threads), error: nil, code: nil)
}

func handleAppendComment(url: String?, body: String?, metadata: ClipMetadata?, folder: String?) -> Response {
    guard let url = url, let body = body, !body.isEmpty, let config = Config.read() else {
        return Response(id: 0, ok: false, data: nil, error: "url and body are required", code: "INVALID_INPUT")
    }

    // Security: Limit comment length to prevent resource exhaustion
    let maxCommentLength = 50_000  // 50KB
    guard body.count <= maxCommentLength else {
        return Response(id: 0, ok: false, data: nil, error: "Comment exceeds maximum length of \(maxCommentLength) characters", code: "BODY_TOO_LONG")
    }

    let normalized = normalizeUrl(url)
    var doc = readDocument(config: config)
    var meta = Metadata.read(from: config.metadataFile)
    let now = Int64(Date().timeIntervalSince1970 * 1000)
    let targetFolder = folder ?? "Uncategorized"

    if let (fi, ei) = findEntry(in: doc, url: normalized) {
        // Existing entry - add comment
        doc.folders[fi].entries[ei].comments.append(body)

        // Update metadata if provided
        if let m = metadata {
            var entryMeta = meta.entries[normalized] ?? EntryMeta(favicon: nil, previewImage: nil, createdAt: now)
            if let favicon = m.faviconUrl { entryMeta.favicon = favicon }
            if let preview = m.previewImageUrl { entryMeta.previewImage = preview }
            meta.entries[normalized] = entryMeta
        }
    } else {
        // New entry
        let title = metadata?.title ?? "Untitled"
        let newEntry = ParsedEntry(
            url: normalized,
            title: title,
            date: formatDate(now),
            comments: [body]
        )

        // Find or create target folder
        if let fi = doc.folders.firstIndex(where: { $0.name == targetFolder }) {
            doc.folders[fi].entries.append(newEntry)
        } else {
            doc.folders.append(ParsedFolder(name: targetFolder, entries: [newEntry]))
        }

        // Store metadata
        meta.entries[normalized] = EntryMeta(
            favicon: metadata?.faviconUrl,
            previewImage: metadata?.previewImageUrl,
            createdAt: now
        )
    }

    do {
        try writeDocument(doc, config: config)
        try meta.write(to: config.metadataFile)

        // Return the thread
        let (fi, ei) = findEntry(in: doc, url: normalized)!
        let entry = doc.folders[fi].entries[ei]
        let thread = entryToThread(entry, folder: doc.folders[fi].name, metadata: meta)

        return Response(id: 0, ok: true, data: AnyCodable(threadToDict(thread)), error: nil, code: nil)
    } catch {
        return Response(id: 0, ok: false, data: nil, error: error.localizedDescription, code: "IO_ERROR")
    }
}

func handleDeleteComment(url: String?, commentId: String?) -> Response {
    guard let url = url, let commentId = commentId, let config = Config.read() else {
        return Response(id: 0, ok: false, data: nil, error: "url and commentId are required", code: "INVALID_INPUT")
    }

    let normalized = normalizeUrl(url)
    var doc = readDocument(config: config)
    let meta = Metadata.read(from: config.metadataFile)

    guard let (fi, ei) = findEntry(in: doc, url: normalized) else {
        return Response(id: 0, ok: false, data: nil, error: "Thread not found", code: "NOT_FOUND")
    }

    // Find comment by index (commentId is based on timestamp, but we use index for simplicity)
    let commentIndex = Int(commentId) ?? -1
    let entry = doc.folders[fi].entries[ei]

    // Try to find by matching the ID pattern (createdAt + index)
    var foundIndex: Int? = nil
    for (i, _) in entry.comments.enumerated() {
        let createdAt = parseDate(entry.date) ?? 0
        let expectedId = "\(createdAt + Int64(i))"
        if expectedId == commentId || "\(createdAt + Int64(i * 1000))" == commentId {
            foundIndex = i
            break
        }
    }

    // Fallback: if commentId looks like a small number, treat as index
    if foundIndex == nil && commentIndex >= 0 && commentIndex < entry.comments.count {
        foundIndex = commentIndex
    }

    guard let idx = foundIndex else {
        return Response(id: 0, ok: false, data: nil, error: "Comment not found", code: "NOT_FOUND")
    }

    doc.folders[fi].entries[ei].comments.remove(at: idx)

    do {
        try writeDocument(doc, config: config)

        let updatedEntry = doc.folders[fi].entries[ei]
        let thread = entryToThread(updatedEntry, folder: doc.folders[fi].name, metadata: meta)

        return Response(id: 0, ok: true, data: AnyCodable(threadToDict(thread)), error: nil, code: nil)
    } catch {
        return Response(id: 0, ok: false, data: nil, error: error.localizedDescription, code: "IO_ERROR")
    }
}

func handleDeleteThread(url: String?) -> Response {
    guard let url = url, let config = Config.read() else {
        return Response(id: 0, ok: true, data: nil, error: nil, code: nil)
    }

    let normalized = normalizeUrl(url)
    var doc = readDocument(config: config)
    var meta = Metadata.read(from: config.metadataFile)

    guard let (fi, ei) = findEntry(in: doc, url: normalized) else {
        return Response(id: 0, ok: true, data: nil, error: nil, code: nil)
    }

    doc.folders[fi].entries.remove(at: ei)
    meta.entries.removeValue(forKey: normalized)

    do {
        try writeDocument(doc, config: config)
        try meta.write(to: config.metadataFile)

        return Response(id: 0, ok: true, data: nil, error: nil, code: nil)
    } catch {
        return Response(id: 0, ok: false, data: nil, error: error.localizedDescription, code: "IO_ERROR")
    }
}

// MARK: - Folder Operations

// Helper to count total entries in a folder (including all descendants)
func countTotalEntries(_ folder: ParsedFolder) -> Int {
    return folder.entries.count + folder.children.reduce(0) { $0 + countTotalEntries($1) }
}

// Helper to convert ParsedFolder to response dictionary
func folderToDict(_ folder: ParsedFolder, parentPath: String? = nil) -> [String: Any] {
    let id = folder.id(parentPath: parentPath)
    let path = folder.path(parentPath: parentPath)

    let children: [[String: Any]] = folder.children.map { child in
        folderToDict(child, parentPath: path)
    }

    return [
        "id": id,
        "name": folder.name,
        "path": path,
        "level": folder.level,
        "parentId": parentPath != nil ? parentPath!.lowercased().replacingOccurrences(of: " ", with: "-") : NSNull(),
        "threadCount": folder.entries.count,
        "children": children
    ]
}

func handleGetFolders() -> Response {
    guard let config = Config.read() else {
        return Response(id: 0, ok: true, data: AnyCodable([Any]()), error: nil, code: nil)
    }

    let doc = readDocument(config: config)

    let folders: [[String: Any]] = doc.folders.map { folder in
        folderToDict(folder, parentPath: nil)
    }

    return Response(id: 0, ok: true, data: AnyCodable(folders), error: nil, code: nil)
}

// Security: Validate folder names to prevent injection/traversal
func isValidFolderName(_ name: String) -> Bool {
    // Length limit
    guard name.count <= 100 else { return false }

    // Allow: alphanumeric, spaces, hyphens, underscores
    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: " -_"))
    guard name.unicodeScalars.allSatisfy({ allowed.contains($0) }) else { return false }

    // Reject path traversal attempts and special names
    guard !name.contains("..") && name != "." else { return false }

    // Reject leading/trailing whitespace
    guard name == name.trimmingCharacters(in: .whitespaces) else { return false }

    return true
}

func handleCreateFolder(path: String?, parentId: String?) -> Response {
    guard let name = path, !name.isEmpty, let config = Config.read() else {
        return Response(id: 0, ok: false, data: nil, error: "Folder name is required", code: "INVALID_INPUT")
    }

    // Security: Validate folder name
    guard isValidFolderName(name) else {
        return Response(id: 0, ok: false, data: nil, error: "Invalid folder name (use only letters, numbers, spaces, hyphens, underscores)", code: "INVALID_INPUT")
    }

    var doc = readDocument(config: config)

    // If creating at root, check for duplicates at root level
    if parentId == nil {
        if doc.folders.contains(where: { $0.name == name }) {
            return Response(id: 0, ok: false, data: nil, error: "Folder already exists", code: "ALREADY_EXISTS")
        }
        doc.folders.append(ParsedFolder(name: name, level: 1, entries: []))
    } else {
        // Creating as child of existing folder
        guard let targetLoc = findFolderById(doc, id: parentId!) else {
            return Response(id: 0, ok: false, data: nil, error: "Parent folder not found", code: "NOT_FOUND")
        }

        // Check max depth
        if targetLoc.folder.level >= 3 {
            return Response(id: 0, ok: false, data: nil, error: "Cannot create folder: would exceed maximum depth of 3 levels", code: "MAX_DEPTH")
        }

        // Check for duplicate name among siblings
        if targetLoc.folder.children.contains(where: { $0.name == name }) {
            return Response(id: 0, ok: false, data: nil, error: "A folder with that name already exists in the parent", code: "ALREADY_EXISTS")
        }

        let newFolder = ParsedFolder(name: name, level: targetLoc.folder.level + 1, entries: [])
        guard addFolderTo(&doc, folder: newFolder, targetId: parentId) else {
            return Response(id: 0, ok: false, data: nil, error: "Failed to create folder", code: "INTERNAL_ERROR")
        }
    }

    do {
        try writeDocument(doc, config: config)

        // Return full folder tree
        let folders: [[String: Any]] = doc.folders.map { folder in
            folderToDict(folder, parentPath: nil)
        }
        return Response(id: 0, ok: true, data: AnyCodable(folders), error: nil, code: nil)
    } catch {
        return Response(id: 0, ok: false, data: nil, error: error.localizedDescription, code: "IO_ERROR")
    }
}

func handleRenameFolder(oldPath: String?, newPath: String?) -> Response {
    guard let oldName = oldPath, let newName = newPath,
          !oldName.isEmpty, !newName.isEmpty,
          oldName != "Uncategorized",
          let config = Config.read() else {
        return Response(id: 0, ok: false, data: nil, error: "Valid folder names are required", code: "INVALID_INPUT")
    }

    // Security: Validate new folder name
    guard isValidFolderName(newName) else {
        return Response(id: 0, ok: false, data: nil, error: "Invalid folder name (use only letters, numbers, spaces, hyphens, underscores)", code: "INVALID_INPUT")
    }

    var doc = readDocument(config: config)

    guard let fi = doc.folders.firstIndex(where: { $0.name == oldName }) else {
        return Response(id: 0, ok: false, data: nil, error: "Folder not found", code: "NOT_FOUND")
    }

    // Check if new name already exists (unless renaming to same name with different case)
    if doc.folders.contains(where: { $0.name == newName && $0.name != oldName }) {
        return Response(id: 0, ok: false, data: nil, error: "A folder with that name already exists", code: "ALREADY_EXISTS")
    }

    doc.folders[fi] = ParsedFolder(name: newName, entries: doc.folders[fi].entries)

    do {
        try writeDocument(doc, config: config)

        let folderData: [String: Any] = [
            "name": newName,
            "path": newName,
            "threadCount": doc.folders[fi].entries.count
        ]

        return Response(id: 0, ok: true, data: AnyCodable(folderData), error: nil, code: nil)
    } catch {
        return Response(id: 0, ok: false, data: nil, error: error.localizedDescription, code: "IO_ERROR")
    }
}

func handleDeleteFolder(path: String?, recursive: Bool?) -> Response {
    guard let name = path, !name.isEmpty,
          name != "Uncategorized",
          let config = Config.read() else {
        return Response(id: 0, ok: false, data: nil, error: "Valid folder name is required (cannot delete Uncategorized)", code: "INVALID_INPUT")
    }

    var doc = readDocument(config: config)

    guard let fi = doc.folders.firstIndex(where: { $0.name == name }) else {
        return Response(id: 0, ok: false, data: nil, error: "Folder not found", code: "NOT_FOUND")
    }

    if !doc.folders[fi].entries.isEmpty && recursive != true {
        return Response(id: 0, ok: false, data: nil, error: "Folder is not empty. Use recursive=true to delete.", code: "NOT_EMPTY")
    }

    // If recursive, also remove metadata for entries in this folder
    if recursive == true {
        var meta = Metadata.read(from: config.metadataFile)
        for entry in doc.folders[fi].entries {
            meta.entries.removeValue(forKey: entry.url)
        }
        try? meta.write(to: config.metadataFile)
    }

    doc.folders.remove(at: fi)

    do {
        try writeDocument(doc, config: config)
        return Response(id: 0, ok: true, data: nil, error: nil, code: nil)
    } catch {
        return Response(id: 0, ok: false, data: nil, error: error.localizedDescription, code: "IO_ERROR")
    }
}

func handleMoveThread(url: String?, toFolder: String?) -> Response {
    guard let url = url, let targetFolder = toFolder, !targetFolder.isEmpty, let config = Config.read() else {
        return Response(id: 0, ok: false, data: nil, error: "url and toFolder are required", code: "INVALID_INPUT")
    }

    let normalized = normalizeUrl(url)
    var doc = readDocument(config: config)
    let meta = Metadata.read(from: config.metadataFile)

    guard let (fi, ei) = findEntry(in: doc, url: normalized) else {
        return Response(id: 0, ok: false, data: nil, error: "Thread not found", code: "NOT_FOUND")
    }

    // Find target folder
    guard let targetFi = doc.folders.firstIndex(where: { $0.name == targetFolder }) else {
        return Response(id: 0, ok: false, data: nil, error: "Target folder does not exist", code: "NOT_FOUND")
    }

    if fi == targetFi {
        // Already in target folder
        let entry = doc.folders[fi].entries[ei]
        let thread = entryToThread(entry, folder: targetFolder, metadata: meta)
        return Response(id: 0, ok: true, data: AnyCodable(threadToDict(thread)), error: nil, code: nil)
    }

    // Move entry
    let entry = doc.folders[fi].entries.remove(at: ei)
    doc.folders[targetFi].entries.append(entry)

    do {
        try writeDocument(doc, config: config)

        let thread = entryToThread(entry, folder: targetFolder, metadata: meta)
        return Response(id: 0, ok: true, data: AnyCodable(threadToDict(thread)), error: nil, code: nil)
    } catch {
        return Response(id: 0, ok: false, data: nil, error: error.localizedDescription, code: "IO_ERROR")
    }
}

// MARK: - Nested Folder Operations

// Helper struct for folder search results
struct FolderLocation {
    var folder: ParsedFolder
    var parentPath: String?
}

// Find a folder by ID in the tree (returns folder and its parent path)
func findFolderById(_ doc: ParsedDocument, id: String) -> FolderLocation? {
    func search(folders: [ParsedFolder], parentPath: String?) -> FolderLocation? {
        for folder in folders {
            let folderId = folder.id(parentPath: parentPath)
            if folderId == id {
                return FolderLocation(folder: folder, parentPath: parentPath)
            }
            let childPath = folder.path(parentPath: parentPath)
            if let found = search(folders: folder.children, parentPath: childPath) {
                return found
            }
        }
        return nil
    }
    return search(folders: doc.folders, parentPath: nil)
}

// Remove a folder from the document tree, returns the removed folder
func removeFolderById(_ doc: inout ParsedDocument, id: String) -> ParsedFolder? {
    func removeFrom(folders: inout [ParsedFolder], parentPath: String?) -> ParsedFolder? {
        for i in folders.indices {
            let folderId = folders[i].id(parentPath: parentPath)
            if folderId == id {
                return folders.remove(at: i)
            }
            let childPath = folders[i].path(parentPath: parentPath)
            if let removed = removeFrom(folders: &folders[i].children, parentPath: childPath) {
                return removed
            }
        }
        return nil
    }
    return removeFrom(folders: &doc.folders, parentPath: nil)
}

// Add a folder as child of another folder by ID (or to root if targetId is nil)
func addFolderTo(_ doc: inout ParsedDocument, folder: ParsedFolder, targetId: String?) -> Bool {
    if targetId == nil {
        // Add to root
        var newFolder = folder
        newFolder.level = 1
        doc.folders.append(newFolder)
        return true
    }

    func addTo(folders: inout [ParsedFolder], parentPath: String?, targetLevel: Int) -> Bool {
        for i in folders.indices {
            let folderId = folders[i].id(parentPath: parentPath)
            if folderId == targetId {
                // Check max depth
                if folders[i].level >= 3 {
                    return false
                }
                var newFolder = folder
                newFolder.level = folders[i].level + 1
                // Recursively update children levels
                updateLevels(&newFolder, baseLevel: newFolder.level)
                folders[i].children.append(newFolder)
                return true
            }
            let childPath = folders[i].path(parentPath: parentPath)
            if addTo(folders: &folders[i].children, parentPath: childPath, targetLevel: targetLevel + 1) {
                return true
            }
        }
        return false
    }
    return addTo(folders: &doc.folders, parentPath: nil, targetLevel: 1)
}

// Update levels recursively after a folder is moved
func updateLevels(_ folder: inout ParsedFolder, baseLevel: Int) {
    folder.level = baseLevel
    for i in folder.children.indices {
        updateLevels(&folder.children[i], baseLevel: baseLevel + 1)
    }
}

// Get max depth of a folder subtree
func getMaxDepth(_ folder: ParsedFolder) -> Int {
    if folder.children.isEmpty {
        return 1
    }
    return 1 + folder.children.map { getMaxDepth($0) }.max()!
}

// Check if folderId is a descendant of ancestorId
func isDescendant(_ doc: ParsedDocument, folderId: String, ancestorId: String) -> Bool {
    guard let ancestorLoc = findFolderById(doc, id: ancestorId) else { return false }

    func checkDescendants(folder: ParsedFolder, parentPath: String?) -> Bool {
        for child in folder.children {
            let childId = child.id(parentPath: folder.path(parentPath: parentPath))
            if childId == folderId {
                return true
            }
            if checkDescendants(folder: child, parentPath: folder.path(parentPath: parentPath)) {
                return true
            }
        }
        return false
    }

    return checkDescendants(folder: ancestorLoc.folder, parentPath: ancestorLoc.parentPath)
}

func handleNestFolder(folderId: String?, targetParentId: String?) -> Response {
    guard let folderId = folderId, !folderId.isEmpty, let config = Config.read() else {
        return Response(id: 0, ok: false, data: nil, error: "folderId is required", code: "INVALID_INPUT")
    }

    // Cannot nest Uncategorized
    if folderId == "uncategorized" {
        return Response(id: 0, ok: false, data: nil, error: "Cannot move Uncategorized folder", code: "INVALID_INPUT")
    }

    var doc = readDocument(config: config)

    // Find the folder to move
    guard let folderLoc = findFolderById(doc, id: folderId) else {
        return Response(id: 0, ok: false, data: nil, error: "Folder not found", code: "NOT_FOUND")
    }

    // Cannot nest into self or descendants
    if let targetId = targetParentId, targetId == folderId {
        return Response(id: 0, ok: false, data: nil, error: "Cannot nest folder into itself", code: "INVALID_INPUT")
    }
    if let targetId = targetParentId, isDescendant(doc, folderId: targetId, ancestorId: folderId) {
        return Response(id: 0, ok: false, data: nil, error: "Cannot nest folder into its own descendant", code: "INVALID_INPUT")
    }

    // Check if target would exceed max depth
    if let targetId = targetParentId, let targetLoc = findFolderById(doc, id: targetId) {
        let targetLevel = targetLoc.folder.level
        let sourceDepth = getMaxDepth(folderLoc.folder)
        if targetLevel + sourceDepth > 3 {
            return Response(id: 0, ok: false, data: nil, error: "Cannot nest: would exceed maximum depth of 3 levels", code: "MAX_DEPTH")
        }
    }

    // Remove folder from current location
    guard let removedFolder = removeFolderById(&doc, id: folderId) else {
        return Response(id: 0, ok: false, data: nil, error: "Failed to remove folder", code: "INTERNAL_ERROR")
    }

    // Add to new location
    guard addFolderTo(&doc, folder: removedFolder, targetId: targetParentId) else {
        // Rollback: put it back at root
        doc.folders.append(removedFolder)
        return Response(id: 0, ok: false, data: nil, error: "Failed to add folder to target", code: "INTERNAL_ERROR")
    }

    do {
        try writeDocument(doc, config: config)

        // Return updated folder list
        let folders: [[String: Any]] = doc.folders.map { folder in
            folderToDict(folder, parentPath: nil)
        }
        return Response(id: 0, ok: true, data: AnyCodable(folders), error: nil, code: nil)
    } catch {
        return Response(id: 0, ok: false, data: nil, error: error.localizedDescription, code: "IO_ERROR")
    }
}

func handleReorderFolder(folderId: String?, beforeId: String?, afterId: String?) -> Response {
    guard let folderId = folderId, !folderId.isEmpty, let config = Config.read() else {
        return Response(id: 0, ok: false, data: nil, error: "folderId is required", code: "INVALID_INPUT")
    }

    // Cannot reorder Uncategorized (it always stays at root)
    if folderId == "uncategorized" {
        return Response(id: 0, ok: false, data: nil, error: "Cannot reorder Uncategorized folder", code: "INVALID_INPUT")
    }

    var doc = readDocument(config: config)

    // Verify the folder exists
    guard findFolderById(doc, id: folderId) != nil else {
        return Response(id: 0, ok: false, data: nil, error: "Folder not found", code: "NOT_FOUND")
    }

    // Determine target position - folder should stay at same level, just change order
    // This is simpler: remove from current position, insert at new position in same parent

    // For now, implement simple reordering at root level only
    // Full nested reordering would require tracking parent IDs in the request

    // Remove folder
    guard let removedFolder = removeFolderById(&doc, id: folderId) else {
        return Response(id: 0, ok: false, data: nil, error: "Failed to remove folder", code: "INTERNAL_ERROR")
    }

    // Find insert position based on beforeId or afterId
    var insertIndex = doc.folders.count  // Default: append at end

    if let beforeId = beforeId, let beforeLoc = findFolderById(doc, id: beforeId) {
        // Insert before this folder (only works for root level for now)
        if let idx = doc.folders.firstIndex(where: { $0.name == beforeLoc.folder.name }) {
            insertIndex = idx
        }
    } else if let afterId = afterId, let afterLoc = findFolderById(doc, id: afterId) {
        // Insert after this folder
        if let idx = doc.folders.firstIndex(where: { $0.name == afterLoc.folder.name }) {
            insertIndex = idx + 1
        }
    }

    // Insert at new position
    var folderToInsert = removedFolder
    folderToInsert.level = 1  // Root level
    doc.folders.insert(folderToInsert, at: min(insertIndex, doc.folders.count))

    do {
        try writeDocument(doc, config: config)

        let folders: [[String: Any]] = doc.folders.map { folder in
            folderToDict(folder, parentPath: nil)
        }
        return Response(id: 0, ok: true, data: AnyCodable(folders), error: nil, code: nil)
    } catch {
        return Response(id: 0, ok: false, data: nil, error: error.localizedDescription, code: "IO_ERROR")
    }
}

// MARK: - Import Bookmarks

func handleImportBookmarks(bookmarks: [ImportBookmark]?) -> Response {
    guard let bookmarks = bookmarks, !bookmarks.isEmpty, let config = Config.read() else {
        return Response(id: 0, ok: false, data: nil, error: "bookmarks array is required", code: "INVALID_INPUT")
    }

    var doc = readDocument(config: config)
    var meta = Metadata.read(from: config.metadataFile)
    let now = Int64(Date().timeIntervalSince1970 * 1000)

    // Collect all existing URLs for duplicate detection
    var existingUrls = Set<String>()
    for folder in doc.folders {
        for entry in folder.entries {
            existingUrls.insert(entry.url)
        }
    }

    var imported = 0
    var skipped = 0

    for bookmark in bookmarks {
        let normalized = normalizeUrl(bookmark.url)

        // Skip duplicates
        if existingUrls.contains(normalized) {
            skipped += 1
            continue
        }

        let title = bookmark.title ?? {
            // Fall back to domain hostname
            if let components = URLComponents(string: bookmark.url) {
                return components.host ?? "Untitled"
            }
            return "Untitled"
        }()

        let folderName = bookmark.folder ?? "Uncategorized"

        let newEntry = ParsedEntry(
            url: normalized,
            title: title,
            date: formatDate(now),
            comments: []
        )

        // Find or create target folder
        if let fi = doc.folders.firstIndex(where: { $0.name == folderName }) {
            doc.folders[fi].entries.append(newEntry)
        } else {
            // Auto-create the folder
            doc.folders.append(ParsedFolder(name: folderName, level: 1, entries: [newEntry]))
        }

        // Store metadata (favicon)
        meta.entries[normalized] = EntryMeta(
            favicon: bookmark.faviconUrl,
            previewImage: nil,
            createdAt: now
        )

        existingUrls.insert(normalized)
        imported += 1
    }

    do {
        try writeDocument(doc, config: config)
        try meta.write(to: config.metadataFile)

        let result: [String: Any] = ["imported": imported, "skipped": skipped]
        return Response(id: 0, ok: true, data: AnyCodable(result), error: nil, code: nil)
    } catch {
        return Response(id: 0, ok: false, data: nil, error: error.localizedDescription, code: "IO_ERROR")
    }
}

// MARK: - Message Router

func handleRequest(_ request: Request) -> Response {
    var response: Response

    switch request.type {
    case "ping":
        response = handlePing()
    case "getConfig":
        response = handleGetConfig()
    case "setConfig":
        response = handleSetConfig(vaultPath: request.vaultPath, commentFolder: request.commentFolder)
    case "hasComments":
        response = handleHasComments(url: request.url)
    case "getThread":
        response = handleGetThread(url: request.url)
    case "getAllThreads":
        response = handleGetAllThreads()
    case "appendComment":
        response = handleAppendComment(url: request.url, body: request.body, metadata: request.metadata, folder: request.folder)
    case "deleteComment":
        response = handleDeleteComment(url: request.url, commentId: request.commentId)
    case "deleteThread":
        response = handleDeleteThread(url: request.url)
    case "getFolders":
        response = handleGetFolders()
    case "createFolder":
        response = handleCreateFolder(path: request.path, parentId: request.parentId)
    case "renameFolder":
        response = handleRenameFolder(oldPath: request.oldPath, newPath: request.newPath)
    case "deleteFolder":
        response = handleDeleteFolder(path: request.path, recursive: request.recursive)
    case "moveThread":
        response = handleMoveThread(url: request.url, toFolder: request.toFolder)
    case "nestFolder":
        response = handleNestFolder(folderId: request.folderId, targetParentId: request.targetParentId)
    case "reorderFolder":
        response = handleReorderFolder(folderId: request.folderId, beforeId: request.beforeId, afterId: request.afterId)
    case "importBookmarks":
        response = handleImportBookmarks(bookmarks: request.bookmarks)
    default:
        response = Response(id: 0, ok: false, data: nil, error: "Unknown message type: \(request.type)", code: "UNKNOWN_TYPE")
    }

    response.id = request.id
    return response
}

// MARK: - Chrome Native Messaging I/O

func readMessage() -> Request? {
    var lengthBytes = [UInt8](repeating: 0, count: 4)
    let bytesRead = fread(&lengthBytes, 1, 4, stdin)
    if bytesRead != 4 {
        return nil
    }

    let length = UInt32(lengthBytes[0]) |
                 (UInt32(lengthBytes[1]) << 8) |
                 (UInt32(lengthBytes[2]) << 16) |
                 (UInt32(lengthBytes[3]) << 24)

    var messageBytes = [UInt8](repeating: 0, count: Int(length))
    let messageBytesRead = fread(&messageBytes, 1, Int(length), stdin)
    if messageBytesRead != Int(length) {
        return nil
    }

    let data = Data(messageBytes)
    return try? JSONDecoder().decode(Request.self, from: data)
}

func writeMessage(_ response: Response) {
    guard let data = try? JSONEncoder().encode(response) else {
        return
    }

    let length = UInt32(data.count)
    var lengthBytes = [UInt8](repeating: 0, count: 4)
    lengthBytes[0] = UInt8(length & 0xFF)
    lengthBytes[1] = UInt8((length >> 8) & 0xFF)
    lengthBytes[2] = UInt8((length >> 16) & 0xFF)
    lengthBytes[3] = UInt8((length >> 24) & 0xFF)

    fwrite(lengthBytes, 1, 4, stdout)
    _ = data.withUnsafeBytes { ptr in
        fwrite(ptr.baseAddress, 1, data.count, stdout)
    }
    fflush(stdout)
}

// MARK: - Main

func main() {
    while true {
        guard let request = readMessage() else {
            break
        }

        let response = handleRequest(request)
        writeMessage(response)
    }
}

main()
