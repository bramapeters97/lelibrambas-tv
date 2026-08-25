import XCTest
@testable import LeliBrambasTV
import LeliBrambasCore

@MainActor
final class AppModelTests: XCTestCase {
    func testStartLoadsAndOrganizesBundledItemsWithoutAuthentication() async {
        let model = AppModel(catalogLoader: StubCatalogLoader(items: Self.items))

        await model.start()

        XCTAssertEqual(model.items.map(\.id), [10, 20])
        XCTAssertEqual(model.sections.map(\.title), ["JEUGDFILMS", "EVENTS"])
        XCTAssertNil(model.presentedError)
        XCTAssertFalse(model.isLoadingCatalog)
    }

    func testCatalogLoadingStateRemainsVisibleUntilLoadCompletes() async {
        let loader = BlockingCatalogLoader()
        let model = AppModel(catalogLoader: loader)

        let startTask = Task { await model.start() }
        await loader.waitUntilRequested()
        XCTAssertTrue(model.isLoadingCatalog)

        await loader.finish(with: Self.items)
        await startTask.value
        XCTAssertFalse(model.isLoadingCatalog)
        XCTAssertEqual(model.items.map(\.id), [10, 20])
    }

    func testFailedBundledCatalogLoadCanBeRetried() async {
        let loader = RetryCatalogLoader(items: Self.items)
        let model = AppModel(catalogLoader: loader)

        await model.start()
        XCTAssertEqual(model.presentedError, .catalogUnavailable)
        XCTAssertTrue(model.items.isEmpty)

        await model.reloadCatalog()
        XCTAssertNil(model.presentedError)
        XCTAssertEqual(model.items.map(\.id), [10, 20])
    }

    func testPlaybackUsesSelectedItemsOwnStreamVideoID() async {
        let model = AppModel(catalogLoader: StubCatalogLoader(items: Self.items))
        let first = await model.preparePlayback(for: Self.items[0])
        let second = await model.preparePlayback(for: Self.items[1])

        XCTAssertEqual(first?.url.absoluteString, "https://media.example.test/first.m3u8")
        XCTAssertEqual(second?.url.absoluteString, "https://media.example.test/second.mp4")
        XCTAssertNotEqual(first?.url, second?.url)
    }

    func testCloudflareWatchSourceResolvesDirectlyForAVPlayer() async {
        let item = MediaItem(
            id: 30,
            title: "Synthetic Cloud Film",
            year: 2026,
            description: "Synthetic test data.",
            category: "OTHERS",
            posterURL: "artwork/generic_cinema_2.png",
            streamURL: "https://customer-example.cloudflarestream.com/synthetic-id/watch"
        )
        let model = AppModel(catalogLoader: StubCatalogLoader(items: []))

        let playback = await model.preparePlayback(for: item)

        XCTAssertEqual(
            playback?.url.absoluteString,
            "https://customer-example.cloudflarestream.com/synthetic-id/manifest/video.m3u8"
        )
    }

    func testReleaseBundleContainsProductionCatalogAndDistinctStreams() async throws {
        let items = try await BundledCatalogLoader().loadCatalog()

        XCTAssertFalse(items.isEmpty)
        XCTAssertGreaterThan(Set(items.compactMap(\.streamURL)).count, 1)
        XCTAssertTrue(items.allSatisfy { $0.posterURL.hasPrefix("artwork/") })
    }

    func testBundledArtworkResolvesAndMissingPosterUsesGenericFallback() throws {
        let production = try XCTUnwrap(BundledArtworkResolver.url(for: "artwork/generic_cinema_2.png"))
        let fallback = try XCTUnwrap(BundledArtworkResolver.url(for: "artwork/does-not-exist.png"))

        XCTAssertTrue(FileManager.default.fileExists(atPath: production.path))
        XCTAssertEqual(fallback.lastPathComponent, "generic_cinema_2.png")
        XCTAssertTrue(FileManager.default.fileExists(atPath: fallback.path))
    }

    private static let items = [
        MediaItem(
            id: 20,
            title: "Synthetic Event",
            year: 2010,
            description: "A fictional event.",
            category: "EVENTS",
            posterURL: "artwork/generic_cinema_2.png",
            streamURL: "https://media.example.test/second.mp4",
            sortOrder: 20
        ),
        MediaItem(
            id: 10,
            title: "Synthetic Childhood",
            year: 2001,
            description: "A fictional childhood film.",
            category: "JEUGDFILMS",
            posterURL: "artwork/generic_cinema_2.png",
            streamURL: "https://media.example.test/first.m3u8",
            sortOrder: 10,
            featured: true
        ),
    ]
}

private struct StubCatalogLoader: CatalogLoading {
    let items: [MediaItem]
    func loadCatalog() async throws -> [MediaItem] { CatalogOrganizer.sorted(items) }
}

private actor RetryCatalogLoader: CatalogLoading {
    private let items: [MediaItem]
    private var attempts = 0

    init(items: [MediaItem]) { self.items = items }

    func loadCatalog() async throws -> [MediaItem] {
        attempts += 1
        if attempts == 1 { throw BundledCatalogError.resourceMissing }
        return CatalogOrganizer.sorted(items)
    }
}

private actor BlockingCatalogLoader: CatalogLoading {
    private var continuation: CheckedContinuation<[MediaItem], Never>?
    private var requestWaiters: [CheckedContinuation<Void, Never>] = []
    private var requested = false

    func loadCatalog() async throws -> [MediaItem] {
        requested = true
        requestWaiters.forEach { $0.resume() }
        requestWaiters.removeAll()
        return await withCheckedContinuation { continuation in
            self.continuation = continuation
        }
    }

    func waitUntilRequested() async {
        if requested { return }
        await withCheckedContinuation { continuation in
            requestWaiters.append(continuation)
        }
    }

    func finish(with items: [MediaItem]) {
        continuation?.resume(returning: CatalogOrganizer.sorted(items))
        continuation = nil
    }
}
