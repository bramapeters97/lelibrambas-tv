import XCTest
@testable import LeliBrambasTV
import LeliBrambasCore

@MainActor
final class AppModelTests: XCTestCase {
    func testRestoredSessionLoadsAndOrganizesCatalog() async throws {
        let session = SessionRecord(
            token: "synthetic-session",
            email: "viewer@example.test",
            expiresAt: Date().addingTimeInterval(600)
        )
        let store = MemorySessionStore(value: session)
        let model = AppModel(
            authenticationService: StubDeviceAuthorizer(),
            catalogService: StubCatalogService(items: Self.items),
            playbackService: StubPlaybackService(),
            sessionStore: store
        )

        await model.start()

        XCTAssertEqual(model.items.map(\.id), [10, 20])
        XCTAssertEqual(model.sections.map(\.title), ["JEUGDFILMS", "EVENTS"])
        XCTAssertEqual(model.authenticationState, .authorized(session))
    }

    func testExpiredStoredSessionReturnsToSignedOutAndClearsStore() async throws {
        let store = MemorySessionStore(value: SessionRecord(
            token: "expired-synthetic-session",
            email: nil,
            expiresAt: Date().addingTimeInterval(-1)
        ))
        let model = AppModel(
            authenticationService: StubDeviceAuthorizer(),
            catalogService: StubCatalogService(items: Self.items),
            playbackService: StubPlaybackService(),
            sessionStore: store
        )

        await model.start()

        XCTAssertEqual(model.authenticationState, .signedOut)
        XCTAssertNil(try store.load())
    }

    func testPlaybackPreparationUsesAuthorizedSession() async throws {
        let session = SessionRecord(
            token: "synthetic-session",
            email: nil,
            expiresAt: Date().addingTimeInterval(600)
        )
        let model = AppModel(
            authenticationService: StubDeviceAuthorizer(),
            catalogService: StubCatalogService(items: Self.items),
            playbackService: StubPlaybackService(),
            sessionStore: MemorySessionStore(value: session)
        )
        await model.start()

        let playback = await model.preparePlayback(for: Self.items[0])

        XCTAssertEqual(playback?.url.absoluteString, "https://media.example.test/synthetic.m3u8")
    }

    func testLogoutRemovesSessionAndCatalog() async throws {
        let session = SessionRecord(
            token: "synthetic-session",
            email: nil,
            expiresAt: Date().addingTimeInterval(600)
        )
        let store = MemorySessionStore(value: session)
        let model = AppModel(
            authenticationService: StubDeviceAuthorizer(),
            catalogService: StubCatalogService(items: Self.items),
            playbackService: StubPlaybackService(),
            sessionStore: store
        )
        await model.start()

        model.logout()

        XCTAssertEqual(model.authenticationState, .signedOut)
        XCTAssertTrue(model.items.isEmpty)
        XCTAssertNil(try store.load())
    }

    func testNearExpirySessionRotatesBeforeCatalogLoad() async throws {
        let current = SessionRecord(
            token: "near-expiry-synthetic-session",
            email: "viewer@example.test",
            expiresAt: Date().addingTimeInterval(60)
        )
        let rotated = SessionRecord(
            token: "rotated-synthetic-session",
            email: "viewer@example.test",
            expiresAt: Date().addingTimeInterval(30 * 24 * 60 * 60)
        )
        let store = MemorySessionStore(value: current)
        let model = AppModel(
            authenticationService: StubDeviceAuthorizer(),
            catalogService: StubCatalogService(items: Self.items),
            playbackService: StubPlaybackService(),
            sessionService: StubSessionService(refreshed: rotated),
            sessionStore: store
        )

        await model.start()

        XCTAssertEqual(model.authenticationState, .authorized(rotated))
        XCTAssertEqual(try store.load(), rotated)
    }

    func testCatalogLoadingStateRemainsVisibleUntilTheRequestCompletes() async throws {
        let session = SessionRecord(
            token: "synthetic-session",
            email: nil,
            expiresAt: Date().addingTimeInterval(600)
        )
        let catalog = BlockingCatalogService()
        let model = AppModel(
            authenticationService: StubDeviceAuthorizer(),
            catalogService: catalog,
            playbackService: StubPlaybackService(),
            sessionStore: MemorySessionStore(value: session)
        )

        let startTask = Task { await model.start() }
        await catalog.waitUntilRequested()
        XCTAssertTrue(model.isLoadingCatalog)

        await catalog.finish(with: Self.items)
        await startTask.value
        XCTAssertFalse(model.isLoadingCatalog)
        XCTAssertEqual(model.items.map(\.id), [10, 20])
    }

    func testEmptyCatalogKeepsTheAuthorizedSessionWithoutAnError() async throws {
        let session = SessionRecord(
            token: "synthetic-session",
            email: nil,
            expiresAt: Date().addingTimeInterval(600)
        )
        let model = AppModel(
            authenticationService: StubDeviceAuthorizer(),
            catalogService: StubCatalogService(items: []),
            playbackService: StubPlaybackService(),
            sessionStore: MemorySessionStore(value: session)
        )

        await model.start()

        XCTAssertEqual(model.authenticationState, .authorized(session))
        XCTAssertTrue(model.items.isEmpty)
        XCTAssertTrue(model.sections.isEmpty)
        XCTAssertNil(model.presentedError)
    }

    func testFailedCatalogLoadCanBeRetried() async throws {
        let session = SessionRecord(
            token: "synthetic-session",
            email: nil,
            expiresAt: Date().addingTimeInterval(600)
        )
        let catalog = RetryCatalogService(items: Self.items)
        let model = AppModel(
            authenticationService: StubDeviceAuthorizer(),
            catalogService: catalog,
            playbackService: StubPlaybackService(),
            sessionStore: MemorySessionStore(value: session)
        )

        await model.start()
        XCTAssertEqual(model.presentedError, .catalogUnavailable)
        XCTAssertTrue(model.items.isEmpty)

        await model.reloadCatalog()
        XCTAssertNil(model.presentedError)
        XCTAssertEqual(model.items.map(\.id), [10, 20])
    }

    func testUnauthorizedCatalogResponseExpiresAndClearsTheSession() async throws {
        let session = SessionRecord(
            token: "synthetic-session",
            email: nil,
            expiresAt: Date().addingTimeInterval(600)
        )
        let store = MemorySessionStore(value: session)
        let model = AppModel(
            authenticationService: StubDeviceAuthorizer(),
            catalogService: UnauthorizedCatalogService(),
            playbackService: StubPlaybackService(),
            sessionStore: store
        )

        await model.start()

        XCTAssertEqual(model.authenticationState, .signedOut)
        XCTAssertEqual(model.presentedError, .sessionExpired)
        XCTAssertNil(try store.load())
    }

    private static let items = [
        MediaItem(
            id: 20,
            title: "Synthetic Event",
            year: 2010,
            description: "A fictional event.",
            category: "EVENTS",
            posterURL: "https://images.example.test/event.jpg",
            sortOrder: 20
        ),
        MediaItem(
            id: 10,
            title: "Synthetic Childhood",
            year: 2001,
            description: "A fictional childhood film.",
            category: "JEUGDFILMS",
            posterURL: "https://images.example.test/childhood.jpg",
            sortOrder: 10,
            featured: true
        ),
    ]
}

private struct StubDeviceAuthorizer: DeviceAuthorizing {
    func begin(deviceName: String) async throws -> ActivationChallenge {
        ActivationChallenge(
            deviceCode: "synthetic-device-code",
            userCode: "ABC123",
            verificationURL: URL(string: "https://activate.example.test")!,
            verificationURLComplete: nil,
            expiresAt: Date().addingTimeInterval(600),
            intervalSeconds: 2
        )
    }

    func poll(deviceCode: String) async throws -> ActivationPollResponse {
        ActivationPollResponse(status: .pending)
    }
}

private struct StubCatalogService: CatalogServing {
    let items: [MediaItem]
    func loadCatalog(sessionToken: String) async throws -> [MediaItem] { CatalogOrganizer.sorted(items) }
}

private actor RetryCatalogService: CatalogServing {
    private let items: [MediaItem]
    private var attempts = 0

    init(items: [MediaItem]) { self.items = items }

    func loadCatalog(sessionToken: String) async throws -> [MediaItem] {
        attempts += 1
        if attempts == 1 { throw APIError.transport }
        return CatalogOrganizer.sorted(items)
    }
}

private struct UnauthorizedCatalogService: CatalogServing {
    func loadCatalog(sessionToken: String) async throws -> [MediaItem] {
        throw APIError.unauthorized
    }
}

private actor BlockingCatalogService: CatalogServing {
    private var continuation: CheckedContinuation<[MediaItem], Never>?
    private var requestWaiters: [CheckedContinuation<Void, Never>] = []
    private var requested = false

    func loadCatalog(sessionToken: String) async throws -> [MediaItem] {
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

private struct StubPlaybackService: PlaybackServing {
    func playbackURL(for item: MediaItem, sessionToken: String) async throws -> URL {
        URL(string: "https://media.example.test/synthetic.m3u8")!
    }
}

private struct StubSessionService: SessionServing {
    let refreshed: SessionRecord

    func refresh(sessionToken: String) async throws -> SessionRecord { refreshed }
    func revoke(sessionToken: String) async throws {}
}
