import Combine
import Foundation
import LeliBrambasCore
import OSLog

@MainActor
final class AppModel: ObservableObject {
    @Published private(set) var items: [MediaItem] = []
    @Published private(set) var sections: [CatalogSection] = []
    @Published private(set) var isLoadingCatalog = true
    @Published private(set) var presentedError: AppError?
    @Published var showPlaybackError = false
    @Published private(set) var playbackError: AppError?

    private let catalogLoader: CatalogLoading
    private var hasStarted = false
    private let logger = Logger(subsystem: "com.lelibrambas.plus", category: "app-lifecycle")

    init(catalogLoader: CatalogLoading) {
        self.catalogLoader = catalogLoader
    }

    static func bootstrap() -> AppModel {
#if DEBUG
        if DebugLaunchOptions.fixtureMode {
            return AppModel(catalogLoader: FixtureCatalogLoader())
        }
#endif
        return AppModel(catalogLoader: BundledCatalogLoader())
    }

    func start() async {
        guard !hasStarted else { return }
        hasStarted = true
        await loadCatalog()
    }

    func reloadCatalog() async {
        await loadCatalog()
    }

    func preparePlayback(
        for item: MediaItem,
        startSeconds: Double = 0,
        profileID: String? = nil
    ) async -> PlaybackSession? {
        do {
            let url = try PlaybackURLResolver.resolve(item.streamURL)
            return PlaybackSession(
                item: item,
                url: url,
                startSeconds: max(0, startSeconds),
                profileID: profileID
            )
        } catch let error as PlaybackResolutionError where error == .insecureTransport {
            displayPlaybackError(.insecureMedia)
            return nil
        } catch {
            displayPlaybackError(.videoUnavailable)
            return nil
        }
    }

    func preparePreview(for item: MediaItem) async -> URL? {
        do {
            return try PlaybackURLResolver.resolve(item.streamURL)
        } catch {
            logger.notice("A detail preview was unavailable")
            return nil
        }
    }

    private func loadCatalog() async {
        isLoadingCatalog = true
        presentedError = nil
        do {
            let loadedItems = try await catalogLoader.loadCatalog()
            items = loadedItems
            sections = CatalogOrganizer.sections(from: loadedItems)
        } catch BundledCatalogError.malformed {
            presentedError = .malformedData
        } catch {
            presentedError = .catalogUnavailable
        }
        isLoadingCatalog = false
    }

    private func displayPlaybackError(_ error: AppError) {
        playbackError = error
        showPlaybackError = true
    }
}

struct PlaybackSession: Identifiable, Hashable {
    let item: MediaItem
    let url: URL
    let startSeconds: Double
    let profileID: String?

    init(
        item: MediaItem,
        url: URL,
        startSeconds: Double = 0,
        profileID: String? = nil
    ) {
        self.item = item
        self.url = url
        self.startSeconds = max(0, startSeconds)
        self.profileID = profileID
    }

    var id: String {
        "\(item.id)-\(url.absoluteString)-\(profileID ?? "anonymous")-\(startSeconds)"
    }
}

struct PlaybackProgress: Codable, Equatable {
    let profileID: String
    let movieID: Int
    let seconds: Double
    let durationSeconds: Double
    let updatedAt: Date
    let completed: Bool
}

enum LBPlaybackProgressPolicy {
    static let minimumResumeSeconds: Double = 5
    static let completionFraction: Double = 0.94

    static func canResume(seconds: Double, durationSeconds: Double) -> Bool {
        guard seconds.isFinite,
              durationSeconds.isFinite,
              durationSeconds > 0,
              seconds >= minimumResumeSeconds else {
            return false
        }
        return seconds / durationSeconds < completionFraction
    }

    static func isComplete(seconds: Double, durationSeconds: Double) -> Bool {
        guard seconds.isFinite, durationSeconds.isFinite, durationSeconds > 0 else {
            return false
        }
        return seconds / durationSeconds >= completionFraction
    }

    static func normalizedSeconds(_ seconds: Double, durationSeconds: Double) -> Double {
        guard seconds.isFinite else { return 0 }
        guard durationSeconds.isFinite, durationSeconds > 0 else { return max(0, seconds) }
        return min(max(0, seconds), durationSeconds)
    }

    static func timestamp(_ seconds: Double) -> String {
        let total = Int(max(0, seconds.isFinite ? seconds : 0).rounded(.down))
        let hours = total / 3_600
        let minutes = (total % 3_600) / 60
        let remainingSeconds = total % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, remainingSeconds)
        }
        return String(format: "%d:%02d", minutes, remainingSeconds)
    }
}

@MainActor
final class PlaybackProgressStore: ObservableObject {
    @Published private(set) var revision = 0

    private static let keyPrefix = "lelibrambas-plus:playback-progress"
    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func progress(profileID: String, movieID: Int) -> PlaybackProgress? {
        guard let data = defaults.data(forKey: key(profileID: profileID, movieID: movieID)),
              let progress = try? decoder.decode(PlaybackProgress.self, from: data),
              progress.profileID == profileID,
              progress.movieID == movieID else {
            return nil
        }
        return progress
    }

    func resumableProgress(profileID: String, movieID: Int) -> PlaybackProgress? {
        guard let progress = progress(profileID: profileID, movieID: movieID),
              !progress.completed,
              LBPlaybackProgressPolicy.canResume(
                  seconds: progress.seconds,
                  durationSeconds: progress.durationSeconds
              ) else {
            return nil
        }
        return progress
    }

    func save(
        profileID: String,
        movieID: Int,
        seconds: Double,
        durationSeconds: Double,
        completed: Bool? = nil,
        updatedAt: Date = Date()
    ) {
        guard durationSeconds.isFinite, durationSeconds > 0 else { return }
        let normalizedSeconds = LBPlaybackProgressPolicy.normalizedSeconds(
            seconds,
            durationSeconds: durationSeconds
        )
        let progress = PlaybackProgress(
            profileID: profileID,
            movieID: movieID,
            seconds: normalizedSeconds,
            durationSeconds: durationSeconds,
            updatedAt: updatedAt,
            completed: completed ?? LBPlaybackProgressPolicy.isComplete(
                seconds: normalizedSeconds,
                durationSeconds: durationSeconds
            )
        )
        guard let data = try? encoder.encode(progress) else { return }
        defaults.set(data, forKey: key(profileID: profileID, movieID: movieID))
        revision += 1
    }

    func clear(profileID: String, movieID: Int) {
        defaults.removeObject(forKey: key(profileID: profileID, movieID: movieID))
        revision += 1
    }

    private func key(profileID: String, movieID: Int) -> String {
        "\(Self.keyPrefix):\(profileID):\(movieID)"
    }
}

enum AppError: Error, Equatable, Identifiable {
    case catalogUnavailable
    case malformedData
    case videoUnavailable
    case insecureMedia

    var id: String { title + message }

    var title: String {
        switch self {
        case .catalogUnavailable: return "The archive could not be loaded"
        case .malformedData: return "The archive needs attention"
        case .videoUnavailable, .insecureMedia: return "This film is unavailable"
        }
    }

    var message: String {
        switch self {
        case .catalogUnavailable:
            return "The bundled catalogue is missing. Reinstall the app and try again."
        case .malformedData:
            return "The bundled catalogue could not be read safely."
        case .videoUnavailable:
            return "The video address in this catalogue item could not be played."
        case .insecureMedia:
            return "This film uses an insecure address and cannot be played on Apple TV."
        }
    }
}
