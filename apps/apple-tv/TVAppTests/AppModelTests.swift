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
            posterURL: "https://assets.example.test/synthetic-trailer.png",
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

    func testFocusedCardsUseAVisibleNonLayoutOverlay() {
        XCTAssertEqual(LBFocusAppearance.cardBorderWidth, 5)
        XCTAssertEqual(LBFocusAppearance.cardGlowOpacity, 0.38, accuracy: 0.000_001)
        XCTAssertEqual(LBFocusAppearance.cardGlowRadius, 7)
        XCTAssertEqual(LBFocusAppearance.accessibilityFocused, "Focused")
        XCTAssertEqual(LBFocusAppearance.accessibilityNotFocused, "Not focused")
    }

    func testNavigationShellFillsTheLeftViewportEdges() {
        XCTAssertEqual(LBLayout.navigationWidth, 78)
        XCTAssertEqual(
            LBLayout.navigationIconSize / LBLayout.navigationWidth,
            54.0 / 78.0,
            accuracy: 0.000_001
        )
        XCTAssertEqual(LBLayout.navigationIconInset, 12)
        XCTAssertTrue(LBLayout.navigationShellSafeAreaEdges.contains(.leading))
        XCTAssertTrue(LBLayout.navigationShellSafeAreaEdges.contains(.top))
        XCTAssertTrue(LBLayout.navigationShellSafeAreaEdges.contains(.bottom))
        XCTAssertFalse(LBLayout.navigationShellSafeAreaEdges.contains(.trailing))
        XCTAssertTrue(LBLayout.navigationDividerSafeAreaEdges.contains(.top))
        XCTAssertTrue(LBLayout.navigationDividerSafeAreaEdges.contains(.bottom))
    }

    func testIntroPresentationMatchesTheWebIdent() {
        XCTAssertEqual(IntroPresentation.title, "LELIBRAMBAS+")
        XCTAssertEqual(IntroPresentation.subtitle, "A private family archive")
        XCTAssertEqual(IntroPresentation.jingleVolume, 0.68, accuracy: 0.000_001)
        XCTAssertEqual(IntroPresentation.lights.count, 18)
        XCTAssertEqual(IntroPresentation.backgroundOnlyDelayNanoseconds, 1_000_000_000)
        XCTAssertEqual(IntroPresentation.markDelayNanoseconds, 1_150_000_000)
        XCTAssertEqual(IntroPresentation.copyDelayNanoseconds, 1_750_000_000)
        XCTAssertEqual(IntroPresentation.animationCompletionDelayNanoseconds, 2_950_000_000)
        XCTAssertEqual(IntroPresentation.finalHoldDelayNanoseconds, 3_000_000_000)
        XCTAssertEqual(IntroPresentation.completionDelayNanoseconds, 6_950_000_000)
        XCTAssertEqual(IntroPresentation.reducedCompletionDelayNanoseconds, 4_420_000_000)
    }

    func testIntroSequenceAdvancesOnceAndPlaysTheJingleOnce() async {
        let audio = IntroAudioPlayerSpy(playResult: true)
        let sleeps = IntroSleepRecorder()
        let model = IntroSequenceModel(
            audioPlayer: audio,
            sleeper: { delay in sleeps.delays.append(delay) }
        )
        var completionCount = 0

        await model.run(reduceMotion: false) { completionCount += 1 }
        await model.run(reduceMotion: false) { completionCount += 1 }

        XCTAssertEqual(
            model.phaseHistory,
            [.idle, .lights, .mark, .copy, .hold, .completed]
        )
        XCTAssertEqual(model.runCount, 1)
        XCTAssertEqual(completionCount, 1)
        XCTAssertEqual(audio.playCount, 1)
        XCTAssertEqual(audio.stopCount, 1)
        XCTAssertEqual(audio.requestedVolumes, [IntroPresentation.jingleVolume])
        XCTAssertEqual(sleeps.delays, IntroPresentation.intervals(reduceMotion: false))
    }

    func testIntroLifecycleRestartsExactlyOnceAfterBackground() {
        var lifecycle = IntroLifecycleState()
        let initialCycleID = lifecycle.cycleID

        XCTAssertFalse(lifecycle.handle(.active))
        XCTAssertFalse(lifecycle.handle(.inactive))
        XCTAssertFalse(lifecycle.requiresFreshIntro)
        XCTAssertEqual(lifecycle.cycleID, initialCycleID)

        XCTAssertFalse(lifecycle.handle(.background))
        XCTAssertTrue(lifecycle.requiresFreshIntro)
        XCTAssertEqual(lifecycle.cycleID, initialCycleID)

        XCTAssertTrue(lifecycle.handle(.active))
        XCTAssertFalse(lifecycle.requiresFreshIntro)
        XCTAssertNotEqual(lifecycle.cycleID, initialCycleID)

        let restartedCycleID = lifecycle.cycleID
        XCTAssertFalse(lifecycle.handle(.active))
        XCTAssertEqual(lifecycle.cycleID, restartedCycleID)
    }

    func testBackgroundCancellationStopsIntroWithoutCompleting() async {
        let audio = IntroAudioPlayerSpy(playResult: true)
        let sleepGate = IntroSleepGate()
        let model = IntroSequenceModel(
            audioPlayer: audio,
            sleeper: { delay in try await sleepGate.sleep(delay: delay) }
        )
        var completionCount = 0

        let run = Task {
            await model.run(reduceMotion: false) { completionCount += 1 }
        }
        await sleepGate.waitUntilRequested()
        model.cancel()
        await sleepGate.resume()
        await run.value

        XCTAssertEqual(model.phaseHistory, [.idle])
        XCTAssertEqual(completionCount, 0)
        XCTAssertEqual(audio.playCount, 0)
        XCTAssertEqual(audio.stopCount, 0)
    }

    func testFreshIntroCyclesEachPlayTheJingleOnce() async {
        let audio = IntroAudioPlayerSpy(playResult: true)
        let firstCycle = IntroSequenceModel(
            audioPlayer: audio,
            sleeper: { _ in }
        )
        let secondCycle = IntroSequenceModel(
            audioPlayer: audio,
            sleeper: { _ in }
        )

        await firstCycle.run(reduceMotion: false) {}
        await secondCycle.run(reduceMotion: false) {}

        XCTAssertEqual(firstCycle.runCount, 1)
        XCTAssertEqual(secondCycle.runCount, 1)
        XCTAssertEqual(audio.playCount, 2)
        XCTAssertEqual(audio.stopCount, 2)
    }

    func testIntroAudioFailureStillCompletesAndReducedMotionUsesWebDuration() async {
        let audio = IntroAudioPlayerSpy(playResult: false)
        let sleeps = IntroSleepRecorder()
        let model = IntroSequenceModel(
            audioPlayer: audio,
            sleeper: { delay in sleeps.delays.append(delay) }
        )
        var didComplete = false

        await model.run(reduceMotion: true) { didComplete = true }

        XCTAssertTrue(didComplete)
        XCTAssertEqual(model.phase, .completed)
        XCTAssertEqual(audio.playCount, 1)
        XCTAssertEqual(audio.stopCount, 1)
        XCTAssertEqual(sleeps.delays.reduce(0, +), 4_420_000_000)
        XCTAssertEqual(sleeps.delays, IntroPresentation.intervals(reduceMotion: true))
    }

    func testAllMoviesUsesStableCatalogueOrderAndIncludesEachMovieOnce() {
        let duplicatedInput = [Self.items[0], Self.items[1], Self.items[0]]
        let section = LBHomeContent.allMovies(from: duplicatedInput)

        XCTAssertEqual(section?.id, "all-movies")
        XCTAssertEqual(section?.title, "All movies")
        XCTAssertEqual(section?.items.map(\.id), [20, 10])
    }

    func testPlaybackProgressRulesAndTimestampFormattingMatchWebBehavior() {
        XCTAssertFalse(LBPlaybackProgressPolicy.canResume(seconds: 4.99, durationSeconds: 100))
        XCTAssertTrue(LBPlaybackProgressPolicy.canResume(seconds: 5, durationSeconds: 100))
        XCTAssertFalse(LBPlaybackProgressPolicy.canResume(seconds: 94, durationSeconds: 100))
        XCTAssertTrue(LBPlaybackProgressPolicy.isComplete(seconds: 94, durationSeconds: 100))
        XCTAssertEqual(LBPlaybackProgressPolicy.timestamp(55 * 60 + 12), "55:12")
        XCTAssertEqual(LBPlaybackProgressPolicy.timestamp(3_725), "1:02:05")
    }

    func testPlaybackProgressIsProfileSpecificAndRestartClearsOnlyThatMovie() throws {
        let suiteName = "LeliBrambasTVTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = PlaybackProgressStore(defaults: defaults)

        store.save(profileID: "profile-a", movieID: 10, seconds: 55, durationSeconds: 100)
        store.save(profileID: "profile-b", movieID: 10, seconds: 25, durationSeconds: 100)

        XCTAssertEqual(store.resumableProgress(profileID: "profile-a", movieID: 10)?.seconds, 55)
        XCTAssertEqual(store.resumableProgress(profileID: "profile-b", movieID: 10)?.seconds, 25)

        store.clear(profileID: "profile-a", movieID: 10)

        XCTAssertNil(store.progress(profileID: "profile-a", movieID: 10))
        XCTAssertEqual(store.resumableProgress(profileID: "profile-b", movieID: 10)?.seconds, 25)
    }

    func testNearEndAndCompletedProgressNeverOffersResume() throws {
        let suiteName = "LeliBrambasTVTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = PlaybackProgressStore(defaults: defaults)

        store.save(profileID: "profile", movieID: 10, seconds: 94, durationSeconds: 100)

        XCTAssertTrue(try XCTUnwrap(store.progress(profileID: "profile", movieID: 10)).completed)
        XCTAssertNil(store.resumableProgress(profileID: "profile", movieID: 10))
    }

    func testHostedAppBundleContainsTheExactIntroJingleDataAsset() throws {
        let resourceData = try XCTUnwrap(BundledIntroAudioPlayer.resourceData())

        XCTAssertEqual(resourceData.count, 116_511)
    }

    func testSearchMatchesYearAndLimitsEmptySuggestionsToEight() {
        let searchItems = (0..<10).map { index in
            MediaItem(
                id: 100 + index,
                title: "Synthetic film \(index)",
                year: 2000 + index,
                description: index == 9 ? "A gold archive memory" : "Synthetic description",
                category: index.isMultiple(of: 2) ? "EVENTS" : "OTHERS",
                posterURL: "https://assets.example.test/synthetic-\(index).png"
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

    func testStartLoadsAndOrganizesItemsWithoutAuthentication() async {
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

    func testFailedCatalogLoadCanBeRetried() async {
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

    func testPlaybackPreparationCarriesTheRequestedProfileResumePosition() async {
        let model = AppModel(catalogLoader: StubCatalogLoader(items: Self.items))
        let item = Self.items[0]

        let playback = await model.preparePlayback(
            for: item,
            startSeconds: 55 * 60 + 12,
            profileID: "profile-a"
        )

        XCTAssertEqual(playback?.startSeconds, 55 * 60 + 12)
        XCTAssertEqual(playback?.profileID, "profile-a")
    }

    func testCloudflareWatchSourceResolvesDirectlyForAVPlayer() async {
        let item = MediaItem(
            id: 30,
            title: "Synthetic Cloud Film",
            year: 2026,
            description: "Synthetic test data.",
            category: "OTHERS",
            posterURL: "https://assets.example.test/synthetic-cloud.png",
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
            posterURL: "https://assets.example.test/synthetic-full-playback.png",
            streamURL: "https://media.example.test/full-playback.m3u8"
        )
        let session = PlaybackSession(
            item: item,
            url: URL(fileURLWithPath: NSTemporaryDirectory())
                .appendingPathComponent("synthetic-full-playback.mp4")
        )
        let controller = PlayerController(session: session)

        XCTAssertEqual(session.startSeconds, 0, accuracy: 0.000_001)
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
            posterURL: "https://assets.example.test/synthetic-retry-playback.png",
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

    func testArtworkAcceptsOnlyAbsoluteHTTPSURLs() throws {
        let source = "https://assets.example.test/synthetic-poster.png"
        let remote = try XCTUnwrap(RemoteArtworkResolver.remoteURL(for: source))

        XCTAssertEqual(remote.absoluteString, source)
        XCTAssertNil(RemoteArtworkResolver.remoteURL(for: "relative/synthetic.png"))
        XCTAssertNil(RemoteArtworkResolver.remoteURL(for: "http://assets.example.test/insecure.png"))
    }

    private static let items = [
        MediaItem(
            id: 20,
            title: "Synthetic Event",
            year: 2010,
            description: "A fictional event.",
            category: "EVENTS",
            posterURL: "https://assets.example.test/synthetic-event.png",
            streamURL: "https://media.example.test/second.mp4",
            sortOrder: 20
        ),
        MediaItem(
            id: 10,
            title: "Synthetic Childhood",
            year: 2001,
            description: "A fictional childhood film.",
            category: "JEUGDFILMS",
            posterURL: "https://assets.example.test/synthetic-childhood.png",
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
        if attempts == 1 { throw MoviesAPIError.invalidResponse }
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

private final class IntroAudioPlayerSpy: IntroAudioPlaying {
    let playResult: Bool
    private(set) var playCount = 0
    private(set) var stopCount = 0
    private(set) var requestedVolumes: [Float] = []

    init(playResult: Bool) {
        self.playResult = playResult
    }

    func play(volume: Float) -> Bool {
        playCount += 1
        requestedVolumes.append(volume)
        return playResult
    }

    func stop() {
        stopCount += 1
    }
}

private final class IntroSleepRecorder {
    var delays: [UInt64] = []
}

private actor IntroSleepGate {
    private var continuation: CheckedContinuation<Void, Never>?
    private var requested = false
    private var requestWaiters: [CheckedContinuation<Void, Never>] = []

    func sleep(delay _: UInt64) async throws {
        requested = true
        requestWaiters.forEach { $0.resume() }
        requestWaiters.removeAll()
        await withCheckedContinuation { continuation in
            self.continuation = continuation
        }
    }

    func waitUntilRequested() async {
        if requested { return }
        await withCheckedContinuation { continuation in
            requestWaiters.append(continuation)
        }
    }

    func resume() {
        continuation?.resume()
        continuation = nil
    }
}
