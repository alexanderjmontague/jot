// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "JotHost",
    platforms: [
        .macOS(.v12)
    ],
    targets: [
        .executableTarget(
            name: "jot-host",
            path: "Sources/JotHost"
        )
    ]
)
