// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "LeliBrambasCore",
    platforms: [.iOS(.v17), .macOS(.v13), .tvOS(.v17)],
    products: [
        .library(name: "LeliBrambasCore", targets: ["LeliBrambasCore"]),
    ],
    targets: [
        .target(name: "LeliBrambasCore"),
        .testTarget(
            name: "LeliBrambasCoreTests",
            dependencies: ["LeliBrambasCore"],
            resources: [.process("Fixtures")]
        ),
    ]
)
