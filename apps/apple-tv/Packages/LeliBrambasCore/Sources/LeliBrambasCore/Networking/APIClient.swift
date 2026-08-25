import Foundation
import OSLog

public enum HTTPMethod: String, Sendable {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case delete = "DELETE"
}

public struct EmptyBody: Encodable, Sendable {
    public init() {}
}

public struct APIEnvelope<Value: Decodable & Sendable>: Decodable, Sendable {
    public let data: Value
}

public enum APIError: Error, Equatable, Sendable {
    case invalidRequest
    case transport
    case unauthorized
    case forbidden
    case notFound
    case rateLimited(retryAfter: Int?)
    case serverUnavailable
    case server(status: Int)
    case malformedResponse
}

public enum APIErrorMapper {
    public static func map(status: Int, retryAfter: String? = nil) -> APIError? {
        switch status {
        case 200 ..< 300:
            return nil
        case 401:
            return .unauthorized
        case 403:
            return .forbidden
        case 404:
            return .notFound
        case 429:
            return .rateLimited(retryAfter: retryAfter.flatMap(Int.init))
        case 502, 503, 504:
            return .serverUnavailable
        default:
            return .server(status: status)
        }
    }
}

public final class APIClient: @unchecked Sendable {
    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private let logger = Logger(subsystem: "com.lelibrambas.plus", category: "networking")

    public init(baseURL: URL, session: URLSession = .shared, timeout: TimeInterval = 20) {
        self.baseURL = baseURL
        if session === URLSession.shared {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.timeoutIntervalForRequest = timeout
            configuration.timeoutIntervalForResource = max(30, timeout * 2)
            configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
            configuration.httpCookieStorage = nil
            self.session = URLSession(configuration: configuration)
        } else {
            self.session = session
        }
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
    }

    public func send<Response: Decodable & Sendable, Body: Encodable & Sendable>(
        path: String,
        method: HTTPMethod,
        body: Body? = nil,
        bearerToken: String? = nil,
        as responseType: Response.Type = Response.self
    ) async throws -> Response {
        let request = try makeRequest(path: path, method: method, body: body, bearerToken: bearerToken)
        let data = try await responseData(for: request)
        do {
            return try decoder.decode(responseType, from: data)
        } catch {
            logger.error("Response decoding failed for a redacted path")
            throw APIError.malformedResponse
        }
    }

    public func sendWithoutResponse<Body: Encodable & Sendable>(
        path: String,
        method: HTTPMethod,
        body: Body? = nil,
        bearerToken: String? = nil
    ) async throws {
        let request = try makeRequest(path: path, method: method, body: body, bearerToken: bearerToken)
        _ = try await responseData(for: request)
    }

    private func makeRequest<Body: Encodable & Sendable>(
        path: String,
        method: HTTPMethod,
        body: Body?,
        bearerToken: String?
    ) throws -> URLRequest {
        guard !path.contains("://"),
              let url = URL(string: path, relativeTo: baseURL)?.absoluteURL,
              url.scheme?.lowercased() == baseURL.scheme?.lowercased(),
              url.scheme?.lowercased() == "https",
              url.host?.lowercased() == baseURL.host?.lowercased(),
              url.port == baseURL.port,
              url.user == nil,
              url.password == nil else {
            throw APIError.invalidRequest
        }
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        if let bearerToken {
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return request
    }

    private func responseData(for request: URLRequest) async throws -> Data {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            logger.error("Request failed for a redacted path")
            throw APIError.transport
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.malformedResponse }
        if let error = APIErrorMapper.map(
            status: http.statusCode,
            retryAfter: http.value(forHTTPHeaderField: "Retry-After")
        ) {
            throw error
        }
        return data
    }
}
