import Foundation
import LeliBrambasCore

enum BundledCatalogError: Error, Equatable {
    case resourceMissing
    case malformed
}

protocol CatalogLoading {
    func loadCatalog() async throws -> [MediaItem]
}

struct BundledCatalogLoader: CatalogLoading {
    private let bundle: Bundle

    init(bundle: Bundle = .main) {
        self.bundle = bundle
    }

    func loadCatalog() async throws -> [MediaItem] {
        guard let url = bundle.url(forResource: "media_catalog", withExtension: "json") else {
            throw BundledCatalogError.resourceMissing
        }

        do {
            let data = try Data(contentsOf: url, options: [.mappedIfSafe])
            let items = try JSONDecoder().decode([MediaItem].self, from: data)
            return CatalogOrganizer.sorted(items)
        } catch {
            throw BundledCatalogError.malformed
        }
    }
}
