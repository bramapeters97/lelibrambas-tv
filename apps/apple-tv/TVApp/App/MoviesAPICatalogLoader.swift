import Foundation
import LeliBrambasCore

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

    init(
        endpoint: URL = MoviesAPIConfiguration.endpoint,
        transport: any MoviesAPITransport = URLSessionMoviesAPITransport()
    ) {
        self.endpoint = endpoint
        self.transport = transport
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
            return record.mediaItem
        }
    }
}

struct FallbackCatalogLoader: CatalogLoading {
    private let primary: any CatalogLoading
    private let fallback: any CatalogLoading

    init(primary: any CatalogLoading, fallback: any CatalogLoading) {
        self.primary = primary
        self.fallback = fallback
    }

    func loadCatalog() async throws -> [MediaItem] {
        do {
            return try await primary.loadCatalog()
        } catch {
            return try await fallback.loadCatalog()
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

    fileprivate enum CodingKeys: String, CodingKey {
        case id
        case title
        case year
        case description
        case category
        case posterURL = "poster_url"
        case streamURL = "stream_video_id"
        case createdAt = "created_at"
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
        streamURL = try values.decodeRequiredNonemptyString(forKey: .streamURL)
        createdAt = try values.decode(String.self, forKey: .createdAt)
    }

    var mediaItem: MediaItem {
        MediaItem(
            id: id,
            title: title,
            year: year,
            description: description,
            category: category,
            posterURL: posterURL,
            streamURL: streamURL,
            createdAt: createdAt
        )
    }
}

fileprivate extension KeyedDecodingContainer where Key == MoviesAPIRecord.CodingKeys {
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
