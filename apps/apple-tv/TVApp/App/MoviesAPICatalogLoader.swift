import Foundation
import LeliBrambasCore

protocol CatalogLoading {
    func loadCatalog() async throws -> [MediaItem]
}

enum MoviesAPIConfiguration {
    static let defaultURL = URL(
        string: "https://lelibrambas-api.bramapeters.workers.dev/api/movies"
    )!
    static let requestTimeout: TimeInterval = 15

    static var endpoint: URL {
#if DEBUG
        if let override = ProcessInfo.processInfo.environment["LELIBRAMBAS_MOVIES_API_URL"],
           let url = URL(string: override),
           url.scheme?.lowercased() == "https" {
            return url
        }
#endif
        return defaultURL
    }
}

enum MoviesAPIError: Error, Equatable {
    case invalidResponse
    case unsuccessfulStatus(Int)
    case emptyCatalogue
    case duplicateID(Int)
}

protocol MoviesAPITransport {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

struct URLSessionMoviesAPITransport: MoviesAPITransport {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await session.data(for: request)
    }
}

struct MoviesAPICatalogLoader: CatalogLoading {
    private let endpoint: URL
    private let transport: any MoviesAPITransport
    private let includesEditorialMetadata: Bool

    init(
        endpoint: URL = MoviesAPIConfiguration.endpoint,
        transport: any MoviesAPITransport = URLSessionMoviesAPITransport(),
        includesEditorialMetadata: Bool = false
    ) {
        self.endpoint = endpoint
        self.transport = transport
        self.includesEditorialMetadata = includesEditorialMetadata
    }

    func loadCatalog() async throws -> [MediaItem] {
        var request = URLRequest(
            url: endpoint,
            cachePolicy: .reloadIgnoringLocalCacheData,
            timeoutInterval: MoviesAPIConfiguration.requestTimeout
        )
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await transport.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw MoviesAPIError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw MoviesAPIError.unsuccessfulStatus(httpResponse.statusCode)
        }

        let records = try JSONDecoder().decode([MoviesAPIRecord].self, from: data)
        guard !records.isEmpty else {
            throw MoviesAPIError.emptyCatalogue
        }

        var seenIDs = Set<Int>()
        return try records.map { record in
            guard seenIDs.insert(record.id).inserted else {
                throw MoviesAPIError.duplicateID(record.id)
            }
            return record.mediaItem(includingEditorialMetadata: includesEditorialMetadata)
        }
    }
}

private struct MoviesAPIRecord: Decodable {
    let id: Int
    let title: String
    let year: Int?
    let description: String
    let category: String
    let posterURL: String
    let streamURL: String
    let createdAt: String
    let featured: Bool
    let available: Bool
    let priority: Int
    let backdropURL: String?
    let durationSeconds: Double?
    let previewStartSeconds: Double

    fileprivate enum CodingKeys: String, CodingKey {
        case id
        case title
        case year
        case description
        case category
        case posterURL = "poster_url"
        case streamURL = "stream_video_id"
        case createdAt = "created_at"
        case featured, available, priority
        case backdropURL = "backdrop_url"
        case durationSeconds = "duration_seconds"
        case previewStartSeconds = "preview_start_seconds"
    }

    init(from decoder: Decoder) throws {
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
                debugDescription: "Movie id must be an integer or a numeric string."
            )
        }

        title = try values.decodeRequiredNonemptyString(forKey: .title)
        guard values.contains(.year) else {
            throw DecodingError.keyNotFound(
                CodingKeys.year,
                .init(codingPath: values.codingPath, debugDescription: "Required field year is missing.")
            )
        }
        year = try values.decodeIfPresent(Int.self, forKey: .year)
        description = try values.decode(String.self, forKey: .description)
        category = try values.decodeRequiredNonemptyString(forKey: .category)
        posterURL = try values.decodeRequiredNonemptyString(forKey: .posterURL)
        guard let posterAddress = URL(string: posterURL),
              posterAddress.scheme?.lowercased() == "https",
              posterAddress.host?.isEmpty == false else {
            throw DecodingError.dataCorruptedError(
                forKey: .posterURL,
                in: values,
                debugDescription: "Movie poster_url must be an absolute HTTPS URL."
            )
        }
        streamURL = try values.decodeRequiredNonemptyString(forKey: .streamURL)
        createdAt = try values.decode(String.self, forKey: .createdAt)
        // Optional editorial fields are opt-in at mapping time, preserving the TV client.
        featured = values.binaryFlag(forKey: .featured, fallback: false)
        available = values.binaryFlag(forKey: .available, fallback: true)
        priority = (try? values.decode(Int.self, forKey: .priority)) ?? 0
        backdropURL = try? values.decode(String.self, forKey: .backdropURL)
        durationSeconds = try? values.decode(Double.self, forKey: .durationSeconds)
        previewStartSeconds = (try? values.decode(Double.self, forKey: .previewStartSeconds)) ?? 0
    }

    func mediaItem(includingEditorialMetadata: Bool) -> MediaItem {
        MediaItem(
            id: id,
            title: title,
            year: year,
            description: description,
            category: category,
            posterURL: posterURL,
            backdropURL: includingEditorialMetadata ? backdropURL : nil,
            streamURL: streamURL,
            createdAt: createdAt,
            featured: includingEditorialMetadata && featured,
            previewStartSeconds: includingEditorialMetadata ? previewStartSeconds : 0,
            durationSeconds: includingEditorialMetadata ? durationSeconds : nil,
            available: !includingEditorialMetadata || available,
            priority: includingEditorialMetadata ? priority : 0
        )
    }
}

fileprivate extension KeyedDecodingContainer where Key == MoviesAPIRecord.CodingKeys {
    func binaryFlag(forKey key: Key, fallback: Bool) -> Bool {
        if let value = try? decode(Bool.self, forKey: key) { return value }
        if let value = try? decode(Int.self, forKey: key), value == 0 || value == 1 {
            return value == 1
        }
        return fallback
    }

    func decodeRequiredNonemptyString(forKey key: Key) throws -> String {
        let value = try decode(String.self, forKey: key)
        guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw DecodingError.dataCorruptedError(
                forKey: key,
                in: self,
                debugDescription: "Required string field must not be empty."
            )
        }
        return value
    }
}
