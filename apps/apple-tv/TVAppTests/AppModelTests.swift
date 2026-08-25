import AVFoundation
import XCTest
@testable import LeliBrambasTV
import LeliBrambasCore

@MainActor
final class AppModelTests: XCTestCase {
    func testViewerProfilesMatchTheWebViewerExactly() {
        XCTAssertEqual(ViewerProfile.all.map(\.id), ["bart-astrid", "bram-edvin", "eline-luca"])
        XCTAssertEqual(ViewerProfile.all.map(\.name), ["Bart & Astrid", "Bram & Edvin", "Eline & Luca"])
        XCTAssertEqual(ViewerProfile.all.map(\.initials), ["BA", "BE", "EL"])
        XCTAssertEqual(ViewerProfile.all.map(\.accentHex), ["#70D8FF", "#8275FF", "#E9C778"])
    }

    func testContentSelectionPrefersTheLeliBrambasTrailer() {
        let trailer = MediaItem(
            id: 36,
            title: "Lelibrambas+ Trailer",
            year: 2026,
            description: "A synthetic trailer used to verify deterministic hero selection.",
            category: "EVENTS",
            posterURL: "artwork/generic_cinema_2.png",
            streamURL: "https://media.example.test/trailer.m3u8"
        )

        XCTAssertEqual(LBContentSelection.hero(in: Self.items + [trailer])?.id, trailer.id)
    }

    func testContentSelectionFallsBackToTheCatalogFeaturedItem() {
        XCTAssertEqual(LBContentSelection.hero(in: Self.items)?.id, 10)
    }

    func testMediaCardsUseTheWebLandscapeAspectRatio() {
        XCTAssertEqual(LBLayout.cardAspectRatio, 16.0 / 9.0, accuracy: 0.000_001)
        XCTAssertEqual(LBLayout.mediaCardWidth, 250)
        XCTAssertEqual(LBLayout.gridMediaCardWidth, 300)
        XCTAssertEqual(LBSpacing.shelfGap, 15)
    }

    func testSearchMatchesYearAndLimitsEmptySuggestionsToEight() {
        let searchItems = (0..<10).map { index in
            MediaItem(
                id: 100 + index,
                title: "Synthetic film \(index)",
                year: 2000 + index,
                description: index == 9 ? "A gold archive memory" : "Synthetic description",
                category: index.isMultiple(of: 2) ? "EVENTS" : "OTHERS",
                posterURL: "artwork/generic_cinema_2.png"
            )
        }

        XCTAssertEqual(LBSearchIndex.results(in: searchItems, query: "").map(\.id), Array(100..<108))
        XCTAssertEqual(LBSearchIndex.results(in: searchItems, query: "2007").map(\.id), [107])
        XCTAssertEqual(LBSearchIndex.results(in: searchItems, query: "gold").map(\.id), [109])
        XCTAssertEqual(LBSearchIndex.results(in: searchItems, query: "events").count, 5)
    }

    func testPreviewPolicyWaitsOneSecondAndTargetsTwoMinutes() {
        XCTAssertEqual(LBPreviewPolicy.delayNanoseconds, 1_000_000_000)
        XCTAssertEqual(LBPreviewPolicy.delaySeconds, 1, accuracy: 0.000_001)
        XCTAssertEqual(LBPreviewPolicy.targetStartSeconds, 120, accuracy: 0.000_001)
    }

    func testHomeAmbientPreviewMatchesTheWebDelayAndStartPoint() {
        XCTAssertEqual(LBHeroPreviewPolicy.delayNanoseconds, 2_000_000_000)
        XCTAssertEqual(LBHeroPreviewPolicy.delaySeconds, 2, accuracy: 0.000_001)
        XCTAssertEqual(LBHeroPreviewPolicy.targetStartSeconds, 40, accuracy: 0.000_001)
        XCTAssertEqual(
            LBMediaPreviewTiming.startSeconds(target: 40, durationSeconds: 30),
            29,
            accuracy: 0.000_001
        )
    }

    func testPreviewPolicyClampsShortMediaAndSafelyFallsBackForUnknownDuration() {
        XCTAssertEqual(LBPreviewPolicy.startSeconds(for: nil), 120)
        XCTAssertEqual(LBPreviewPolicy.startSeconds(for: .nan), 120)
        XCTAssertEqual(LBPreviewPolicy.startSeconds(for: 1), 0)
        XCTAssertEqual(LBPreviewPolicy.startSeconds(for: 60), 59, accuracy: 0.000_001)
        XCTAssertEqual(LBPreviewPolicy.startSeconds(for: 120), 119, accuracy: 0.000_001)
        XCTAssertEqual(LBPreviewPolicy.startSeconds(for: 121), 120, accuracy: 0.000_001)
        XCTAssertEqual(LBPreviewPolicy.startSeconds(for: 600), 120, accuracy: 0.000_001)
    }

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
        let firstItem = Self.items.first { $0.id == 10 }!
        let secondItem = Self.items.first { $0.id == 20 }!
        let first = await model.preparePlayback(for: firstItem)
        let second = await model.preparePlayback(for: secondItem)

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

    func testFullPlaybackControllerStartsAtTheBeginning() {
        let item = MediaItem(
            id: 40,
            title: "Synthetic Full Playback",
            year: 2026,
            description: "Synthetic test data.",
            category: "OTHERS",
            posterURL: "artwork/generic_cinema_2.png",
            streamURL: "https://media.example.test/full-playback.m3u8"
        )
        let session = PlaybackSession(
            item: item,
            url: URL(fileURLWithPath: NSTemporaryDirectory())
                .appendingPathComponent("synthetic-full-playback.mp4")
        )
        let controller = PlayerController(session: session)

        XCTAssertEqual(controller.player.currentTime().seconds, 0, accuracy: 0.000_001)
        controller.stop()
    }

    func testMidstreamFailureRetryRebuildsTheSameDirectURLAtZero() async throws {
        let item = MediaItem(
            id: 41,
            title: "Synthetic Retry Playback",
            year: 2026,
            description: "Synthetic test data.",
            category: "OTHERS",
            posterURL: "artwork/generic_cinema_2.png",
            streamURL: "https://media.example.test/retry-playback.m3u8"
        )
        let streamURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("synthetic-retry-playback.mp4")
        let session = PlaybackSession(item: item, url: streamURL)
        let notificationCenter = NotificationCenter()
        let controller = PlayerController(session: session, notificationCenter: notificationCenter)
        let originalItem = try XCTUnwrap(controller.player.currentItem)

        notificationCenter.post(
            name: .AVPlayerItemFailedToPlayToEndTime,
            object: originalItem
        )
        await Task.yield()

        XCTAssertEqual(
            controller.errorMessage,
            "The stream stopped unexpectedly. Check the connection and retry."
        )
        XCTAssertFalse(controller.isReady)

        controller.retry()

        let retriedItem = try XCTUnwrap(controller.player.currentItem)
        let retriedAsset = try XCTUnwrap(retriedItem.asset as? AVURLAsset)
        XCTAssertFalse(originalItem === retriedItem)
        XCTAssertEqual(retriedAsset.url, streamURL)
        XCTAssertEqual(controller.player.currentTime().seconds, 0, accuracy: 0.000_001)
        XCTAssertNil(controller.errorMessage)
        controller.stop()
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
