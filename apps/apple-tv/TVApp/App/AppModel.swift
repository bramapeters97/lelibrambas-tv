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

    func preparePlayback(for item: MediaItem) async -> PlaybackSession? {
        do {
            let url = try PlaybackURLResolver.resolve(item.streamURL)
            return PlaybackSession(item: item, url: url)
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
    var id: String { "\(item.id)-\(url.absoluteString)" }
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
