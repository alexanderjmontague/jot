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

    var indexFile: URL {
        commentsDir.appendingPathComponent(".jot-index.json")
    }
}

// MARK: - Index

struct IndexEntry: Codable {
    var filename: String
    var hasComments: Bool
}

struct Index: Codable {
    var entries: [String: IndexEntry]

    static func read(from url: URL) -> Index {
        guard let data = try? Data(contentsOf: url),
              let index = try? JSONDecoder().decode(Index.self, from: data) else {
            return Index(entries: [:])
        }
        return index
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
}

struct ClipMetadata: Codable {
    var title: String?
    var faviconUrl: String?
    var previewImageUrl: String?
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
}

struct Response: Encodable {
    var id: Int
    var ok: Bool
    var data: AnyCodable?
    var error: String?
    var code: String?
}

// AnyCodable wrapper for dynamic JSON values
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
    // Sort query parameters
    if let queryItems = components.queryItems {
        components.queryItems = queryItems.sorted { $0.name < $1.name }
    }
    return components.string ?? url
}

// MARK: - Filename Generation

func slugify(_ text: String, maxLength: Int = 50) -> String {
    let slug = text.lowercased()
        .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
        .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    return String(slug.prefix(maxLength))
}

func generateFilename(url: String, title: String?, config: Config) -> String {
    guard let urlComponents = URLComponents(string: url) else {
        return "comment-\(Int(Date().timeIntervalSince1970 * 1000)).md"
    }

    let domain = urlComponents.host?.replacingOccurrences(of: "^www\\.", with: "", options: .regularExpression) ?? "unknown"

    let slug: String
    if let title = title, !title.isEmpty {
        slug = slugify(title)
    } else {
        slug = slugify(urlComponents.path.isEmpty ? "page" : urlComponents.path)
    }

    let base = "\(domain)-\(slug)"
    var filename = "\(base).md"

    let filepath = config.commentsDir.appendingPathComponent(filename)
    if FileManager.default.fileExists(atPath: filepath.path) {
        // Check if it's the same URL
        if let existing = readThread(from: filepath), existing.url != url {
            // Collision - append hash
            let hash = String(url.data(using: .utf8)!.base64EncodedString().prefix(6))
                .replacingOccurrences(of: "[+/=]", with: "x", options: .regularExpression)
            filename = "\(base)-\(hash).md"
        }
    }

    return filename
}

// MARK: - Markdown Parsing

func parseYamlFrontmatter(_ content: String) -> (frontmatter: [String: String], body: String) {
    let pattern = "^---\\n([\\s\\S]*?)\\n---\\n([\\s\\S]*)$"
    guard let regex = try? NSRegularExpression(pattern: pattern),
          let match = regex.firstMatch(in: content, range: NSRange(content.startIndex..., in: content)) else {
        return ([:], content)
    }

    let yamlRange = Range(match.range(at: 1), in: content)!
    let bodyRange = Range(match.range(at: 2), in: content)!

    let yamlString = String(content[yamlRange])
    let body = String(content[bodyRange])

    var frontmatter: [String: String] = [:]
    for line in yamlString.split(separator: "\n") {
        if let colonIndex = line.firstIndex(of: ":") {
            let key = String(line[..<colonIndex]).trimmingCharacters(in: .whitespaces)
            var value = String(line[line.index(after: colonIndex)...]).trimmingCharacters(in: .whitespaces)
            // Remove quotes
            if (value.hasPrefix("\"") && value.hasSuffix("\"")) ||
               (value.hasPrefix("'") && value.hasSuffix("'")) {
                value = String(value.dropFirst().dropLast())
            }
            frontmatter[key] = value
        }
    }

    return (frontmatter, body)
}

func serializeYamlFrontmatter(_ frontmatter: [String: String?]) -> String {
    var lines = ["---"]
    for (key, value) in frontmatter {
        if let value = value {
            let needsQuotes = value.contains(":") || value.contains("\"") || value.contains("'")
            let formatted = needsQuotes ? "\"\(value.replacingOccurrences(of: "\"", with: "\\\""))\"" : value
            lines.append("\(key): \(formatted)")
        }
    }
    lines.append("---")
    return lines.joined(separator: "\n")
}

func parseComments(_ body: String) -> [ClipComment] {
    var comments: [ClipComment] = []
    let pattern = "### (\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2})\\n([\\s\\S]*?)(?=\\n### |\\n*$)"

    guard let regex = try? NSRegularExpression(pattern: pattern) else { return comments }

    let matches = regex.matches(in: body, range: NSRange(body.startIndex..., in: body))

    for match in matches {
        guard let dateRange = Range(match.range(at: 1), in: body),
              let bodyRange = Range(match.range(at: 2), in: body) else { continue }

        let dateStr = String(body[dateRange])
        let commentBody = String(body[bodyRange]).trimmingCharacters(in: .whitespacesAndNewlines)

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        formatter.timeZone = TimeZone(identifier: "UTC")

        if let date = formatter.date(from: dateStr) {
            let createdAt = Int64(date.timeIntervalSince1970 * 1000)
            comments.append(ClipComment(id: "\(createdAt)", body: commentBody, createdAt: createdAt))
        }
    }

    return comments
}

func serializeComments(_ comments: [ClipComment]) -> String {
    if comments.isEmpty { return "" }

    var lines = ["## Notes", ""]

    for comment in comments {
        let date = Date(timeIntervalSince1970: Double(comment.createdAt) / 1000)
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        formatter.timeZone = TimeZone(identifier: "UTC")

        lines.append("### \(formatter.string(from: date))")
        lines.append(comment.body)
        lines.append("")
    }

    return lines.joined(separator: "\n")
}

// MARK: - Thread Operations

func readThread(from filepath: URL) -> ClipThread? {
    guard let content = try? String(contentsOf: filepath, encoding: .utf8) else { return nil }

    let (frontmatter, body) = parseYamlFrontmatter(content)
    let comments = parseComments(body)

    let url = frontmatter["url"] ?? ""
    let createdAtStr = frontmatter["created_at"] ?? ""
    let updatedAtStr = frontmatter["updated_at"] ?? ""

    let isoFormatter = ISO8601DateFormatter()
    let createdAt = isoFormatter.date(from: createdAtStr).map { Int64($0.timeIntervalSince1970 * 1000) } ?? Int64(Date().timeIntervalSince1970 * 1000)
    let updatedAt = isoFormatter.date(from: updatedAtStr).map { Int64($0.timeIntervalSince1970 * 1000) } ?? createdAt

    return ClipThread(
        id: url,
        url: url,
        title: frontmatter["title"],
        faviconUrl: frontmatter["favicon"],
        previewImageUrl: frontmatter["preview_image"],
        createdAt: createdAt,
        updatedAt: updatedAt,
        comments: comments
    )
}

func writeThread(_ thread: ClipThread, to filepath: URL) throws {
    let isoFormatter = ISO8601DateFormatter()

    let frontmatter: [String: String?] = [
        "url": thread.url,
        "title": thread.title,
        "favicon": thread.faviconUrl,
        "preview_image": thread.previewImageUrl,
        "created_at": isoFormatter.string(from: Date(timeIntervalSince1970: Double(thread.createdAt) / 1000)),
        "updated_at": isoFormatter.string(from: Date(timeIntervalSince1970: Double(thread.updatedAt) / 1000))
    ]

    let yaml = serializeYamlFrontmatter(frontmatter)
    let body = serializeComments(thread.comments)
    let content = yaml + "\n" + body

    try content.write(to: filepath, atomically: true, encoding: .utf8)
}

// MARK: - Message Handlers

func handlePing() -> Response {
    return Response(id: 0, ok: true, data: AnyCodable(["status": "ok", "version": "1.0.0"]), error: nil, code: nil)
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

    // Validate path exists
    var isDir: ObjCBool = false
    guard FileManager.default.fileExists(atPath: vaultPath, isDirectory: &isDir), isDir.boolValue else {
        return Response(id: 0, ok: false, data: nil, error: "Vault path does not exist", code: "PATH_NOT_FOUND")
    }

    let config = Config(vaultPath: vaultPath, commentFolder: commentFolder ?? "Jot")

    do {
        try Config.write(config)
        try FileManager.default.createDirectory(at: config.commentsDir, withIntermediateDirectories: true)

        // Initialize index if needed
        if !FileManager.default.fileExists(atPath: config.indexFile.path) {
            try Index(entries: [:]).write(to: config.indexFile)
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
    let index = Index.read(from: config.indexFile)
    let hasComments = index.entries[normalized]?.hasComments ?? false

    return Response(id: 0, ok: true, data: AnyCodable(hasComments), error: nil, code: nil)
}

func handleGetThread(url: String?) -> Response {
    guard let url = url, let config = Config.read() else {
        return Response(id: 0, ok: true, data: nil, error: nil, code: nil)
    }

    let normalized = normalizeUrl(url)
    let index = Index.read(from: config.indexFile)

    guard let entry = index.entries[normalized] else {
        return Response(id: 0, ok: true, data: nil, error: nil, code: nil)
    }

    let filepath = config.commentsDir.appendingPathComponent(entry.filename)

    if let thread = readThread(from: filepath) {
        return Response(id: 0, ok: true, data: AnyCodable(threadToDict(thread)), error: nil, code: nil)
    }

    return Response(id: 0, ok: true, data: nil, error: nil, code: nil)
}

func handleGetAllThreads() -> Response {
    guard let config = Config.read() else {
        return Response(id: 0, ok: true, data: AnyCodable([Any]()), error: nil, code: nil)
    }

    let index = Index.read(from: config.indexFile)
    var threads: [[String: Any]] = []

    for (_, entry) in index.entries {
        let filepath = config.commentsDir.appendingPathComponent(entry.filename)
        if let thread = readThread(from: filepath) {
            threads.append(threadToDict(thread))
        }
    }

    // Sort by updatedAt descending
    threads.sort { ($0["updatedAt"] as? Int64 ?? 0) > ($1["updatedAt"] as? Int64 ?? 0) }

    return Response(id: 0, ok: true, data: AnyCodable(threads), error: nil, code: nil)
}

func handleAppendComment(url: String?, body: String?, metadata: ClipMetadata?) -> Response {
    guard let url = url, let body = body, !body.isEmpty, let config = Config.read() else {
        return Response(id: 0, ok: false, data: nil, error: "url and body are required", code: "INVALID_INPUT")
    }

    let normalized = normalizeUrl(url)
    var index = Index.read(from: config.indexFile)
    var thread: ClipThread
    var filename: String

    if let entry = index.entries[normalized] {
        filename = entry.filename
        let filepath = config.commentsDir.appendingPathComponent(filename)
        if let existing = readThread(from: filepath) {
            thread = existing
        } else {
            thread = ClipThread(id: normalized, url: normalized, title: metadata?.title, faviconUrl: metadata?.faviconUrl, previewImageUrl: metadata?.previewImageUrl, createdAt: Int64(Date().timeIntervalSince1970 * 1000), updatedAt: Int64(Date().timeIntervalSince1970 * 1000), comments: [])
        }
    } else {
        filename = generateFilename(url: url, title: metadata?.title, config: config)
        thread = ClipThread(id: normalized, url: normalized, title: metadata?.title, faviconUrl: metadata?.faviconUrl, previewImageUrl: metadata?.previewImageUrl, createdAt: Int64(Date().timeIntervalSince1970 * 1000), updatedAt: Int64(Date().timeIntervalSince1970 * 1000), comments: [])
    }

    // Update metadata if provided
    if let metadata = metadata {
        if let title = metadata.title { thread.title = title }
        if let faviconUrl = metadata.faviconUrl { thread.faviconUrl = faviconUrl }
        if let previewImageUrl = metadata.previewImageUrl { thread.previewImageUrl = previewImageUrl }
    }

    // Add comment
    let now = Int64(Date().timeIntervalSince1970 * 1000)
    let comment = ClipComment(id: "\(now)", body: body, createdAt: now)
    thread.comments.append(comment)
    thread.updatedAt = now

    do {
        let filepath = config.commentsDir.appendingPathComponent(filename)
        try writeThread(thread, to: filepath)

        index.entries[normalized] = IndexEntry(filename: filename, hasComments: !thread.comments.isEmpty)
        try index.write(to: config.indexFile)

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
    var index = Index.read(from: config.indexFile)

    guard let entry = index.entries[normalized] else {
        return Response(id: 0, ok: false, data: nil, error: "Thread not found", code: "NOT_FOUND")
    }

    let filepath = config.commentsDir.appendingPathComponent(entry.filename)
    guard var thread = readThread(from: filepath) else {
        return Response(id: 0, ok: false, data: nil, error: "Thread not found", code: "NOT_FOUND")
    }

    let initialCount = thread.comments.count
    thread.comments.removeAll { $0.id == commentId }

    if thread.comments.count == initialCount {
        return Response(id: 0, ok: false, data: nil, error: "Comment not found", code: "NOT_FOUND")
    }

    thread.updatedAt = Int64(Date().timeIntervalSince1970 * 1000)

    do {
        try writeThread(thread, to: filepath)
        index.entries[normalized] = IndexEntry(filename: entry.filename, hasComments: !thread.comments.isEmpty)
        try index.write(to: config.indexFile)

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
    var index = Index.read(from: config.indexFile)

    guard let entry = index.entries[normalized] else {
        return Response(id: 0, ok: true, data: nil, error: nil, code: nil)
    }

    let filepath = config.commentsDir.appendingPathComponent(entry.filename)

    do {
        try FileManager.default.removeItem(at: filepath)
        index.entries.removeValue(forKey: normalized)
        try index.write(to: config.indexFile)

        return Response(id: 0, ok: true, data: nil, error: nil, code: nil)
    } catch {
        return Response(id: 0, ok: false, data: nil, error: error.localizedDescription, code: "IO_ERROR")
    }
}

// Helper to convert thread to dictionary for JSON encoding
func threadToDict(_ thread: ClipThread) -> [String: Any] {
    var dict: [String: Any] = [
        "id": thread.id,
        "url": thread.url,
        "createdAt": thread.createdAt,
        "updatedAt": thread.updatedAt,
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
        response = handleAppendComment(url: request.url, body: request.body, metadata: request.metadata)
    case "deleteComment":
        response = handleDeleteComment(url: request.url, commentId: request.commentId)
    case "deleteThread":
        response = handleDeleteThread(url: request.url)
    default:
        response = Response(id: 0, ok: false, data: nil, error: "Unknown message type: \(request.type)", code: "UNKNOWN_TYPE")
    }

    response.id = request.id
    return response
}

// MARK: - Chrome Native Messaging I/O

func readMessage() -> Request? {

    // Read 4-byte length prefix (little-endian)
    var lengthBytes = [UInt8](repeating: 0, count: 4)
    let bytesRead = fread(&lengthBytes, 1, 4, stdin)
    if bytesRead != 4 {
        return nil
    }

    let length = UInt32(lengthBytes[0]) |
                 (UInt32(lengthBytes[1]) << 8) |
                 (UInt32(lengthBytes[2]) << 16) |
                 (UInt32(lengthBytes[3]) << 24)
    // Read message body
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

