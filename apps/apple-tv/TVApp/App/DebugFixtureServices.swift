#if DEBUG
import Foundation
import LeliBrambasCore

enum DebugLaunchOptions {
    private static let arguments = ProcessInfo.processInfo.arguments

    static let fixtureMode = arguments.contains("-LBFixtureMode")
        || arguments.contains("--ui-testing")
        || arguments.contains("--screenshot-mode")

    static let screenshotScreen: String? = {
        if let environmentValue = ProcessInfo.processInfo.environment["LB_SCREENSHOT_SCREEN"] {
            return environmentValue
        }
        guard let flag = arguments.firstIndex(of: "--screenshot-screen"),
              arguments.indices.contains(flag + 1) else {
            return nil
        }
        return arguments[flag + 1]
    }()

}

struct FixtureCatalogLoader: CatalogLoading {
    func loadCatalog() async throws -> [MediaItem] {
        FixtureCatalog.items
    }
}

enum FixtureCatalog {
    static let items: [MediaItem] = [
        MediaItem(
            id: 1,
            title: "The Lantern Archive",
            year: 1998,
            description: "A box of old reels becomes a glowing map through a completely fictional family history.",
            category: "JEUGDFILMS",
            posterURL: "fixture://lantern",
            backdropURL: "fixture://lantern-wide",
            streamURL: "https://example.test/fixture/lantern.m3u8",
            featured: true
        ),
        MediaItem(
            id: 2,
            title: "North Sea Summer",
            year: 2004,
            description: "Wind, dunes and an impossible number of sandwiches in a synthetic seaside memory.",
            category: "VAKANTIEFILMS",
            posterURL: "fixture://north-sea",
            streamURL: "https://example.test/fixture/north-sea.m3u8"
        ),
        MediaItem(
            id: 3,
            title: "Midnight Carousel",
            year: 2012,
            description: "A fictional celebration fills the town square with gold lights after dark.",
            category: "EVENTS",
            posterURL: "fixture://carousel",
            streamURL: "https://example.test/fixture/carousel.m3u8"
        ),
        MediaItem(
            id: 4,
            title: "Projector No. 7",
            year: 1987,
            description: "The archive projector seems determined to choose tonight's feature by itself.",
            category: "OTHERS",
            posterURL: "fixture://projector",
            streamURL: "https://example.test/fixture/projector.m3u8"
        ),
        MediaItem(
            id: 5,
            title: "Alpine Postcards",
            year: 2008,
            description: "A fictional winter trip preserved as a stack of bright moving postcards.",
            category: "VAKANTIEFILMS",
            posterURL: "fixture://alpine",
            streamURL: "https://example.test/fixture/alpine.m3u8"
        ),
        MediaItem(
            id: 6,
            title: "First Day of Spring",
            year: 2018,
            description: "A gentle synthetic record of a garden waking up after winter.",
            category: "JEUGDFILMS",
            posterURL: "fixture://spring",
            streamURL: "https://example.test/fixture/spring.m3u8"
        ),
    ]
}
#endif
