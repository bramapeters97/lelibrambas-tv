import Foundation

public struct MediaItem: Codable, Identifiable, Hashable, Sendable {
    public let id: Int
    public let title: String
    public let year: Int?
    public let description: String
    public let category: String
    public let posterURL: String
    public let backdropURL: String?
    public let streamURL: String?
    public let playbackAssetID: String?
    public let createdAt: String?
    public let sortOrder: Int
    public let featured: Bool
    public let previewStartSeconds: Double

    public init(
        id: Int,
        title: String,
        year: Int?,
        description: String,
        category: String,
        posterURL: String,
        backdropURL: String? = nil,
        streamURL: String? = nil,
        playbackAssetID: String? = nil,
        createdAt: String? = nil,
        sortOrder: Int? = nil,
        featured: Bool = false,
        previewStartSeconds: Double = 0
    ) {
        self.id = id
        self.title = title
        self.year = year
        self.description = description
        self.category = category
        self.posterURL = posterURL
        self.backdropURL = backdropURL
        self.streamURL = streamURL
        self.playbackAssetID = playbackAssetID
        self.createdAt = createdAt
        self.sortOrder = sortOrder ?? id
        self.featured = featured
        self.previewStartSeconds = max(0, previewStartSeconds)
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case title
        case year
        case description
        case category
        case posterURL = "poster_url"
        case backdropURL = "backdrop_url"
        case streamURL = "stream_video_id"
        case playbackAssetID = "playback_asset_id"
        case createdAt = "created_at"
        case sortOrder = "sort_order"
        case featured
        case previewStartSeconds = "preview_start_seconds"
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        if let integerID = try? values.decode(Int.self, forKey: .id) {
            id = integerID
        } else if let stringID = try? values.decode(String.self, forKey: .id),
                  let integerID = Int(stringID) {
            id = integerID
        } else {
            throw DecodingError.dataCorruptedError(
                forKey: .id,
                in: values,
                debugDescription: "Media id must be an integer or an integer string."
            )
        }
        title = try values.decode(String.self, forKey: .title)
        year = try values.decodeIfPresent(Int.self, forKey: .year)
        description = try values.decodeIfPresent(String.self, forKey: .description) ?? ""
        category = try values.decode(String.self, forKey: .category)
        posterURL = try values.decodeIfPresent(String.self, forKey: .posterURL) ?? ""
        backdropURL = try values.decodeIfPresent(String.self, forKey: .backdropURL)
        streamURL = try values.decodeIfPresent(String.self, forKey: .streamURL)
        playbackAssetID = try values.decodeIfPresent(String.self, forKey: .playbackAssetID)
        createdAt = try values.decodeIfPresent(String.self, forKey: .createdAt)
        sortOrder = try values.decodeIfPresent(Int.self, forKey: .sortOrder) ?? id
        featured = try values.decodeIfPresent(Bool.self, forKey: .featured) ?? false
        previewStartSeconds = max(
            0,
            try values.decodeIfPresent(Double.self, forKey: .previewStartSeconds) ?? 0
        )
    }
}

public struct CatalogSection: Identifiable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let items: [MediaItem]

    public init(id: String, title: String, items: [MediaItem]) {
        self.id = id
        self.title = title
        self.items = items
    }
}

public enum CatalogOrganizer {
    private static let preferredOrder = ["JEUGDFILMS", "VAKANTIEFILMS", "EVENTS", "OTHERS"]

    public static func sorted(_ items: [MediaItem]) -> [MediaItem] {
        items.sorted {
            if $0.sortOrder == $1.sortOrder { return $0.id < $1.id }
            return $0.sortOrder < $1.sortOrder
        }
    }

    public static func featuredItem(in items: [MediaItem]) -> MediaItem? {
        sorted(items).first(where: \.featured) ?? sorted(items).first
    }

    public static func sections(from items: [MediaItem]) -> [CatalogSection] {
        let grouped = Dictionary(grouping: sorted(items), by: \.category)
        return sections(from: grouped)
    }

    public static func sectionsPreservingItemOrder(from items: [MediaItem]) -> [CatalogSection] {
        let grouped = Dictionary(grouping: items, by: \.category)
        return sections(from: grouped)
    }

    private static func sections(from grouped: [String: [MediaItem]]) -> [CatalogSection] {
        let known = preferredOrder.filter { grouped[$0] != nil }
        let additional = grouped.keys.filter { !preferredOrder.contains($0) }.sorted()
        return (known + additional).compactMap { category in
            guard let categoryItems = grouped[category], !categoryItems.isEmpty else { return nil }
            return CatalogSection(
                id: slug(category),
                title: category,
                items: categoryItems
            )
        }
    }

    private static func slug(_ value: String) -> String {
        value.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }
}
