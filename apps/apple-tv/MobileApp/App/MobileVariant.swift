import SwiftUI
import LeliBrambasCore

enum MobileVariant: String, CaseIterable {
    case classic, cinema, compact

    static var current: MobileVariant {
        let value = Bundle.main.object(forInfoDictionaryKey: "LBMobileVariant") as? String
        return MobileVariant(rawValue: value ?? "") ?? .classic
    }

    var title: String { rawValue.capitalized }
    var gridMinimum: CGFloat {
        switch self {
        case .classic: return 146
        case .cinema: return 260
        case .compact: return 98
        }
    }
    var sectionSpacing: CGFloat { self == .compact ? 24 : 36 }
}

private struct MobileVariantKey: EnvironmentKey {
    static let defaultValue = MobileVariant.current
}

extension EnvironmentValues {
    var mobileVariant: MobileVariant {
        get { self[MobileVariantKey.self] }
        set { self[MobileVariantKey.self] = newValue }
    }
}

enum MobileCatalogue {
    static func ordered(_ items: [MediaItem]) -> [MediaItem] {
        items.enumerated().sorted {
            if $0.element.priority == $1.element.priority { return $0.offset < $1.offset }
            return $0.element.priority > $1.element.priority
        }.map(\.element)
    }

    static func canPlay(_ item: MediaItem) -> Bool {
        item.available && item.priority != -1
            && (try? PlaybackURLResolver.resolve(item.streamURL)) != nil
    }

    static func availability(_ item: MediaItem) -> String? {
        if item.priority == -1 { return "Coming soon" }
        if !canPlay(item) { return "Currently unavailable" }
        return nil
    }

    static func related(to item: MediaItem, in items: [MediaItem], seed: UUID) -> [MediaItem] {
        Array(items.filter { $0.id != item.id && $0.category == item.category }
            .sorted { rank($0.id, seed: seed) < rank($1.id, seed: seed) }.prefix(4))
    }

    private static func rank(_ id: Int, seed: UUID) -> Int {
        var hasher = Hasher()
        hasher.combine(seed)
        hasher.combine(id)
        return hasher.finalize()
    }
}

enum MobileRoute: Hashable {
    case movie(Int)
    case collection(String)
    case library
}

enum MobileTab: Hashable {
    case home, search, collections, profile
}
