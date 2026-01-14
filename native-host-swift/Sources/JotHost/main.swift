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
    var entries: [ParsedEntry]
}

struct ParsedDocument {
    var folders: [ParsedFolder]
}

// MARK: - Message Types

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
    var folders: [ParsedFolder] = []
    var currentFolder: ParsedFolder? = nil
    var currentEntry: ParsedEntry? = nil

    let lines = content.components(separatedBy: "\n")

    for line in lines {
        // Check for folder header (## Header)
        if line.hasPrefix("## ") {
            // Save current entry to current folder
            if var entry = currentEntry, var folder = currentFolder {
                folder.entries.append(entry)
                currentFolder = folder
            }
            currentEntry = nil

            // Save current folder
            if let folder = currentFolder {
                folders.append(folder)
            }

            let folderName = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
            currentFolder = ParsedFolder(name: folderName, entries: [])
            continue
        }

        // Check for entry line: - **[Title](url)** — Date
        if line.hasPrefix("- **[") {
            // Save previous entry
            if var entry = currentEntry, var folder = currentFolder {
                folder.entries.append(entry)
                currentFolder = folder
            }

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

    // Save final entry and folder
    if var entry = currentEntry, var folder = currentFolder {
        folder.entries.append(entry)
        currentFolder = folder
    }
    if let folder = currentFolder {
        folders.append(folder)
    }

    return ParsedDocument(folders: folders)
}

// MARK: - Markdown Serialization

func serializeBookmarksMarkdown(_ doc: ParsedDocument) -> String {
    var lines: [String] = ["# My Web Clips", ""]

    for folder in doc.folders {
        lines.append("## \(folder.name)")

        for entry in folder.entries {
            lines.append("- **[\(entry.title)](\(entry.url))** — \(entry.date)")
            for comment in entry.comments {
                lines.append("  > \(comment)")
            }
        }

        lines.append("")
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

    var isDir: ObjCBool = false
    guard FileManager.default.fileExists(atPath: vaultPath, isDirectory: &isDir), isDir.boolValue else {
        return Response(id: 0, ok: false, data: nil, error: "Vault path does not exist", code: "PATH_NOT_FOUND")
    }

    let config = Config(vaultPath: vaultPath, commentFolder: commentFolder ?? "Jot")

    do {
        try Config.write(config)
        try FileManager.default.createDirectory(at: config.commentsDir, withIntermediateDirectories: true)

        // Run migration if needed
        migrateFromLegacyFormat(config: config)

        // Initialize empty document if needed
        if !FileManager.default.fileExists(atPath: config.bookmarksFile.path) {
            let doc = ParsedDocument(folders: [ParsedFolder(name: "Uncategorized", entries: [])])
            try writeDocument(doc, config: config)
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

func handleGetFolders() -> Response {
    guard let config = Config.read() else {
        return Response(id: 0, ok: true, data: AnyCodable([Any]()), error: nil, code: nil)
    }

    let doc = readDocument(config: config)

    let folders: [[String: Any]] = doc.folders.map { folder in
        [
            "name": folder.name,
            "path": folder.name,  // For compatibility
            "threadCount": folder.entries.count
        ]
    }

    return Response(id: 0, ok: true, data: AnyCodable(folders), error: nil, code: nil)
}

func handleCreateFolder(path: String?) -> Response {
    guard let name = path, !name.isEmpty, let config = Config.read() else {
        return Response(id: 0, ok: false, data: nil, error: "Folder name is required", code: "INVALID_INPUT")
    }

    var doc = readDocument(config: config)

    // Check if folder already exists
    if doc.folders.contains(where: { $0.name == name }) {
        return Response(id: 0, ok: false, data: nil, error: "Folder already exists", code: "ALREADY_EXISTS")
    }

    doc.folders.append(ParsedFolder(name: name, entries: []))

    do {
        try writeDocument(doc, config: config)

        let folderData: [String: Any] = [
            "name": name,
            "path": name,
            "threadCount": 0
        ]

        return Response(id: 0, ok: true, data: AnyCodable(folderData), error: nil, code: nil)
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

    var doc = readDocument(config: config)

    guard let fi = doc.folders.firstIndex(where: { $0.name == oldName }) else {
        return Response(id: 0, ok: false, data: nil, error: "Folder not found", code: "NOT_FOUND")
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
        response = handleCreateFolder(path: request.path)
    case "renameFolder":
        response = handleRenameFolder(oldPath: request.oldPath, newPath: request.newPath)
    case "deleteFolder":
        response = handleDeleteFolder(path: request.path, recursive: request.recursive)
    case "moveThread":
        response = handleMoveThread(url: request.url, toFolder: request.toFolder)
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
