// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CircleCheck",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "CircleCheck",
            path: "Sources/CircleCheck",
            resources: []
        ),
        .testTarget(
            name: "CircleCheckTests",
            dependencies: ["CircleCheck"],
            path: "Tests/CircleCheckTests"
        ),
    ]
)
