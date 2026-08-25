import Foundation

public protocol CatalogServing: Sendable {
    func loadCatalog(sessionToken: String) async throws -> [MediaItem]
}

public protocol DeviceAuthorizing: Sendable {
    func begin(deviceName: String) async throws -> ActivationChallenge
    func poll(deviceCode: String) async throws -> ActivationPollResponse
}

public protocol PlaybackServing: Sendable {
    func playbackURL(for item: MediaItem, sessionToken: String) async throws -> URL
}

public protocol SessionServing: Sendable {
    func refresh(sessionToken: String) async throws -> SessionRecord
    func revoke(sessionToken: String) async throws
}

public final class GatewayCatalogService: CatalogServing, @unchecked Sendable {
    private let client: APIClient

    public init(client: APIClient) { self.client = client }

    public func loadCatalog(sessionToken: String) async throws -> [MediaItem] {
        let envelope: APIEnvelope<[MediaItem]> = try await client.send(
            path: "/v1/catalog",
            method: .get,
            body: Optional<EmptyBody>.none,
            bearerToken: sessionToken
        )
        return CatalogOrganizer.sorted(envelope.data)
    }
}

public final class GatewayDeviceAuthService: DeviceAuthorizing, @unchecked Sendable {
    private struct BeginRequest: Encodable, Sendable { let deviceName: String }
    private let client: APIClient
    private let activationBaseURL: URL

    public init(client: APIClient, activationBaseURL: URL) {
        self.client = client
        self.activationBaseURL = activationBaseURL
    }

    public func begin(deviceName: String) async throws -> ActivationChallenge {
        let envelope: APIEnvelope<ActivationChallenge> = try await client.send(
            path: "/v1/device/authorizations",
            method: .post,
            body: BeginRequest(deviceName: deviceName)
        )
        guard isAllowedActivationURL(envelope.data.verificationURL),
              envelope.data.verificationURLComplete.map(isAllowedActivationURL) ?? true else {
            throw APIError.malformedResponse
        }
        return envelope.data
    }

    public func poll(deviceCode: String) async throws -> ActivationPollResponse {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
        guard !deviceCode.isEmpty,
              deviceCode.utf8.count <= 256,
              deviceCode.unicodeScalars.allSatisfy(allowed.contains) else {
            throw APIError.invalidRequest
        }
        let envelope: APIEnvelope<ActivationPollResponse> = try await client.send(
            path: "/v1/device/authorizations/\(deviceCode)",
            method: .get,
            body: Optional<EmptyBody>.none
        )
        return envelope.data
    }

    private func isAllowedActivationURL(_ url: URL) -> Bool {
        guard url.scheme?.lowercased() == "https",
              url.host?.lowercased() == activationBaseURL.host?.lowercased(),
              url.port == activationBaseURL.port else {
            return false
        }
        let expectedPath = activationBaseURL.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !expectedPath.isEmpty else { return true }
        let actualPath = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return actualPath == expectedPath || actualPath.hasPrefix(expectedPath + "/")
    }
}

public final class GatewayPlaybackService: PlaybackServing, @unchecked Sendable {
    private struct PlaybackResponse: Decodable, Sendable {
        let playbackURL: URL
        private enum CodingKeys: String, CodingKey { case playbackURL = "playback_url" }
    }

    private let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func playbackURL(for item: MediaItem, sessionToken: String) async throws -> URL {
        let envelope: APIEnvelope<PlaybackResponse> = try await client.send(
            path: "/v1/media/\(item.id)/playback",
            method: .post,
            body: EmptyBody(),
            bearerToken: sessionToken
        )
        return try PlaybackURLResolver.resolve(envelope.data.playbackURL.absoluteString)
    }
}

public final class GatewaySessionService: SessionServing, @unchecked Sendable {
    private struct RefreshResponse: Decodable, Sendable {
        let sessionToken: String
        let email: String?
        let expiresAt: Date

        private enum CodingKeys: String, CodingKey {
            case sessionToken = "session_token"
            case email
            case expiresAt = "expires_at"
        }
    }

    private let client: APIClient

    public init(client: APIClient) { self.client = client }

    public func refresh(sessionToken: String) async throws -> SessionRecord {
        let envelope: APIEnvelope<RefreshResponse> = try await client.send(
            path: "/v1/sessions/refresh",
            method: .post,
            body: EmptyBody(),
            bearerToken: sessionToken
        )
        guard !envelope.data.sessionToken.isEmpty else { throw APIError.malformedResponse }
        return SessionRecord(
            token: envelope.data.sessionToken,
            email: envelope.data.email,
            expiresAt: envelope.data.expiresAt
        )
    }

    public func revoke(sessionToken: String) async throws {
        try await client.sendWithoutResponse(
            path: "/v1/sessions/current",
            method: .delete,
            body: Optional<EmptyBody>.none,
            bearerToken: sessionToken
        )
    }
}
