import Combine
import Foundation
import LeliBrambasCore
import OSLog

@MainActor
final class AppModel: ObservableObject {
    @Published private(set) var authenticationState: AuthenticationState = .signedOut
    @Published private(set) var items: [MediaItem] = []
    @Published private(set) var sections: [CatalogSection] = []
    @Published private(set) var isWorking = false
    @Published private(set) var isLoadingCatalog = false
    @Published private(set) var presentedError: AppError?
    @Published var showPlaybackError = false
    @Published private(set) var playbackError: AppError?

    private let authenticationService: DeviceAuthorizing?
    private let catalogService: CatalogServing?
    private let playbackService: PlaybackServing?
    private let sessionService: SessionServing?
    private let sessionStore: SessionStoring
    private let bootstrapError: AppError?
    private let automaticallyAuthenticateFixture: Bool
    private var stateMachine = AuthenticationStateMachine()
    private var pollingTask: Task<Void, Never>?
    private let logger = Logger(subsystem: "com.lelibrambas.plus", category: "app-lifecycle")

    init(
        authenticationService: DeviceAuthorizing?,
        catalogService: CatalogServing?,
        playbackService: PlaybackServing?,
        sessionService: SessionServing? = nil,
        sessionStore: SessionStoring,
        bootstrapError: AppError? = nil,
        automaticallyAuthenticateFixture: Bool = false
    ) {
        self.authenticationService = authenticationService
        self.catalogService = catalogService
        self.playbackService = playbackService
        self.sessionService = sessionService
        self.sessionStore = sessionStore
        self.bootstrapError = bootstrapError
        self.automaticallyAuthenticateFixture = automaticallyAuthenticateFixture
    }

    static func bootstrap() -> AppModel {
#if DEBUG
        if DebugLaunchOptions.fixtureMode {
            return AppModel(
                authenticationService: FixtureDeviceAuthService(),
                catalogService: FixtureCatalogService(),
                playbackService: FixturePlaybackService(),
                sessionStore: MemorySessionStore(),
                automaticallyAuthenticateFixture: DebugLaunchOptions.automaticFixtureSignIn
            )
        }
#endif
        do {
            let configuration = try AppConfiguration.resolve(from: Bundle.main.infoDictionary ?? [:])
            let client = APIClient(
                baseURL: configuration.apiBaseURL,
                timeout: configuration.requestTimeout
            )
            return AppModel(
                authenticationService: GatewayDeviceAuthService(
                    client: client,
                    activationBaseURL: configuration.activationBaseURL
                ),
                catalogService: GatewayCatalogService(client: client),
                playbackService: GatewayPlaybackService(client: client),
                sessionService: GatewaySessionService(client: client),
                sessionStore: KeychainSessionStore()
            )
        } catch {
            return AppModel(
                authenticationService: nil,
                catalogService: nil,
                playbackService: nil,
                sessionStore: KeychainSessionStore(),
                bootstrapError: .configuration
            )
        }
    }

    func start() async {
        guard authenticationState == .signedOut else { return }
        if let bootstrapError {
            presentedError = bootstrapError
            return
        }
#if DEBUG
        if automaticallyAuthenticateFixture {
            let fixtureSession = SessionRecord(
                token: "debug-fixture-token",
                email: "reviewer@example.test",
                expiresAt: Date().addingTimeInterval(3_600)
            )
            transition(.restore(fixtureSession))
            await loadCatalog(using: fixtureSession)
            return
        }
#endif
        do {
            var restored = try sessionStore.load()
            if let current = restored,
               current.expiresAt.timeIntervalSinceNow < 7 * 24 * 60 * 60,
               let sessionService {
                do {
                    let refreshed = try await sessionService.refresh(sessionToken: current.token)
                    restored = refreshed
                    do { try sessionStore.save(refreshed) }
                    catch { presentedError = .sessionStorage }
                } catch let error as APIError where error == .unauthorized {
                    try? sessionStore.clear()
                    restored = nil
                } catch {
                    logger.notice("Session rotation was deferred; the current unexpired session remains in use")
                }
            }
            transition(.restore(restored))
            if case let .authorized(session) = authenticationState {
                await loadCatalog(using: session)
            } else if restored != nil {
                try? sessionStore.clear()
            }
        } catch {
            logger.error("Secure session restoration failed")
            presentedError = .sessionStorage
        }
    }

    func beginActivation() async {
        pollingTask?.cancel()
        presentedError = nil
        guard let authenticationService else {
            presentedError = .configuration
            return
        }
        isWorking = true
        transition(.begin)
        do {
            let challenge = try await authenticationService.begin(deviceName: "Apple TV")
            transition(.challenge(challenge))
            isWorking = false
            poll(challenge, using: authenticationService)
        } catch is CancellationError {
            isWorking = false
            transition(.logout)
        } catch {
            isWorking = false
            let failure = mapAuthenticationFailure(error)
            transition(.fail(failure))
        }
    }

    func cancelActivation() {
        pollingTask?.cancel()
        pollingTask = nil
        isWorking = false
        presentedError = nil
        transition(.logout)
    }

    func reloadCatalog() async {
        guard case let .authorized(session) = authenticationState else { return }
        await loadCatalog(using: session)
    }

    func logout() {
        let token: String?
        if case let .authorized(session) = authenticationState {
            token = session.token
        } else {
            token = nil
        }
        pollingTask?.cancel()
        try? sessionStore.clear()
        items = []
        sections = []
        presentedError = nil
        transition(.logout)
        if let token, let sessionService {
            Task {
                do { try await sessionService.revoke(sessionToken: token) }
                catch { logger.notice("Remote session revocation could not be confirmed") }
            }
        }
    }

    func preparePlayback(for item: MediaItem) async -> PlaybackSession? {
        guard case let .authorized(session) = authenticationState,
              let playbackService else {
            displayPlaybackError(.sessionExpired)
            return nil
        }
        do {
            let url = try await playbackService.playbackURL(for: item, sessionToken: session.token)
            return PlaybackSession(item: item, url: url)
        } catch let error as APIError where error == .unauthorized {
            expireSession()
            displayPlaybackError(.sessionExpired)
            return nil
        } catch let error as PlaybackResolutionError where error == .insecureTransport {
            displayPlaybackError(.insecureMedia)
            return nil
        } catch {
            displayPlaybackError(.videoUnavailable)
            return nil
        }
    }

    func preparePreview(for item: MediaItem) async -> URL? {
        guard case let .authorized(session) = authenticationState,
              let playbackService else {
            return nil
        }
        do {
            return try await playbackService.playbackURL(for: item, sessionToken: session.token)
        } catch let error as APIError where error == .unauthorized {
            expireSession()
            return nil
        } catch {
            logger.notice("A detail preview was unavailable")
            return nil
        }
    }

    private func poll(_ challenge: ActivationChallenge, using service: DeviceAuthorizing) {
        pollingTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                let delay = UInt64(max(2, challenge.intervalSeconds)) * 1_000_000_000
                try? await Task.sleep(nanoseconds: delay)
                if Task.isCancelled { return }
                if challenge.expiresAt <= Date() {
                    self.transition(.fail(.expiredCode))
                    return
                }
                do {
                    let result = try await service.poll(deviceCode: challenge.deviceCode)
                    self.transition(.poll(result))
                    switch result.status {
                    case .pending:
                        continue
                    case .approved:
                        guard case let .authorized(session) = self.authenticationState else { return }
                        do { try self.sessionStore.save(session) }
                        catch { self.presentedError = .sessionStorage }
                        await self.loadCatalog(using: session)
                        return
                    case .denied, .expired:
                        return
                    }
                } catch let error as APIError {
                    if case let .rateLimited(retryAfter) = error {
                        let extra = UInt64(max(1, retryAfter ?? challenge.intervalSeconds)) * 1_000_000_000
                        try? await Task.sleep(nanoseconds: extra)
                        continue
                    }
                    self.transition(.fail(self.mapAuthenticationFailure(error)))
                    return
                } catch {
                    self.transition(.fail(.network))
                    return
                }
            }
        }
    }

    private func loadCatalog(using session: SessionRecord) async {
        guard let catalogService else {
            presentedError = .configuration
            return
        }
        isLoadingCatalog = true
        presentedError = nil
        do {
            let loadedItems = try await catalogService.loadCatalog(sessionToken: session.token)
            items = loadedItems
            sections = CatalogOrganizer.sections(from: loadedItems)
        } catch let error as APIError where error == .unauthorized {
            expireSession()
            presentedError = .sessionExpired
        } catch let error as APIError where error == .serverUnavailable {
            presentedError = .maintenance
        } catch let error as APIError where error == .malformedResponse {
            presentedError = .malformedData
        } catch {
            presentedError = .catalogUnavailable
        }
        isLoadingCatalog = false
    }

    private func transition(_ event: AuthenticationEvent) {
        stateMachine.send(event)
        authenticationState = stateMachine.state
    }

    private func expireSession() {
        try? sessionStore.clear()
        items = []
        sections = []
        transition(.logout)
    }

    private func mapAuthenticationFailure(_ error: Error) -> AuthenticationFailure {
        guard let apiError = error as? APIError else { return .network }
        switch apiError {
        case .forbidden: return .unauthorizedEmail
        case .notFound: return .invalidCode
        case .serverUnavailable, .server: return .server
        case .malformedResponse: return .malformedResponse
        default: return .network
        }
    }

    private func displayPlaybackError(_ error: AppError) {
        playbackError = error
        showPlaybackError = true
    }
}

struct PlaybackSession: Identifiable, Hashable {
    let item: MediaItem
    let url: URL
    var id: String { "\(item.id)-\(url.absoluteString)" }
}

enum AppError: Error, Equatable, Identifiable {
    case configuration
    case sessionStorage
    case sessionExpired
    case authentication(AuthenticationFailure)
    case catalogUnavailable
    case malformedData
    case maintenance
    case videoUnavailable
    case insecureMedia

    var id: String { title + message }

    var title: String {
        switch self {
        case .configuration: return "Setup required"
        case .sessionStorage: return "Session could not be saved"
        case .sessionExpired: return "Please sign in again"
        case .authentication: return "Activation was not completed"
        case .catalogUnavailable: return "The archive could not be loaded"
        case .malformedData: return "The archive needs attention"
        case .maintenance: return "The archive is resting"
        case .videoUnavailable, .insecureMedia: return "This film is unavailable"
        }
    }

    var message: String {
        switch self {
        case .configuration:
            return "Add the secure gateway and activation URLs before using this build."
        case .sessionStorage:
            return "LeliBrambas+ could not securely retain this session. Please try again."
        case .sessionExpired:
            return "Your private session expired. Activate this Apple TV again."
        case let .authentication(failure):
            switch failure {
            case .invalidCode: return "The activation code was not recognized. Request a new code."
            case .expiredCode: return "That activation code expired. Request a new one."
            case .unauthorizedEmail: return "This email is not permitted to open the family archive."
            case .denied: return "Activation was declined."
            case .network: return "Check the internet connection and try again."
            case .server: return "The activation service is temporarily unavailable."
            case .malformedResponse: return "The activation service returned an unexpected response."
            }
        case .catalogUnavailable:
            return "Check the internet connection, then try loading the archive again."
        case .malformedData:
            return "The catalogue response could not be read safely."
        case .maintenance:
            return "The service is temporarily unavailable. Please try again shortly."
        case .videoUnavailable:
            return "The viewing copy could not be prepared. Please try again."
        case .insecureMedia:
            return "This film uses an insecure address and cannot be played on Apple TV."
        }
    }
}
