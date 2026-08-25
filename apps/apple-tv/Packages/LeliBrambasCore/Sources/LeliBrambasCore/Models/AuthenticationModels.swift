import Foundation

public struct ActivationChallenge: Codable, Equatable, Sendable {
    public let deviceCode: String
    public let userCode: String
    public let verificationURL: URL
    public let verificationURLComplete: URL?
    public let expiresAt: Date
    public let intervalSeconds: Int

    public init(
        deviceCode: String,
        userCode: String,
        verificationURL: URL,
        verificationURLComplete: URL?,
        expiresAt: Date,
        intervalSeconds: Int
    ) {
        self.deviceCode = deviceCode
        self.userCode = userCode
        self.verificationURL = verificationURL
        self.verificationURLComplete = verificationURLComplete
        self.expiresAt = expiresAt
        self.intervalSeconds = max(2, intervalSeconds)
    }

    private enum CodingKeys: String, CodingKey {
        case deviceCode = "device_code"
        case userCode = "user_code"
        case verificationURL = "verification_url"
        case verificationURLComplete = "verification_url_complete"
        case expiresAt = "expires_at"
        case intervalSeconds = "interval_seconds"
    }

    public var isExpired: Bool { expiresAt <= Date() }
}

public enum ActivationStatus: String, Codable, Equatable, Sendable {
    case pending
    case approved
    case denied
    case expired
}

public struct ActivationPollResponse: Codable, Equatable, Sendable {
    public let status: ActivationStatus
    public let sessionToken: String?
    public let email: String?
    public let expiresAt: Date?

    public init(
        status: ActivationStatus,
        sessionToken: String? = nil,
        email: String? = nil,
        expiresAt: Date? = nil
    ) {
        self.status = status
        self.sessionToken = sessionToken
        self.email = email
        self.expiresAt = expiresAt
    }

    private enum CodingKeys: String, CodingKey {
        case status
        case sessionToken = "session_token"
        case email
        case expiresAt = "expires_at"
    }
}

public struct SessionRecord: Codable, Equatable, Sendable {
    public let token: String
    public let email: String?
    public let expiresAt: Date

    public init(token: String, email: String?, expiresAt: Date) {
        self.token = token
        self.email = email
        self.expiresAt = expiresAt
    }

    public var isExpired: Bool { expiresAt <= Date() }
}

public enum AuthenticationState: Equatable, Sendable {
    case signedOut
    case requesting
    case awaitingApproval(ActivationChallenge)
    case authorized(SessionRecord)
    case failed(AuthenticationFailure)
}

public enum AuthenticationFailure: String, Error, Equatable, Sendable {
    case invalidCode
    case expiredCode
    case unauthorizedEmail
    case denied
    case network
    case server
    case malformedResponse
}

public enum AuthenticationEvent: Equatable, Sendable {
    case begin
    case challenge(ActivationChallenge)
    case poll(ActivationPollResponse)
    case fail(AuthenticationFailure)
    case restore(SessionRecord?)
    case logout
}

public struct AuthenticationStateMachine: Sendable {
    public private(set) var state: AuthenticationState = .signedOut

    public init() {}

    public mutating func send(_ event: AuthenticationEvent, now: Date = Date()) {
        switch event {
        case .begin:
            state = .requesting
        case let .challenge(challenge):
            state = challenge.expiresAt <= now ? .failed(.expiredCode) : .awaitingApproval(challenge)
        case let .poll(result):
            switch result.status {
            case .pending:
                break
            case .denied:
                state = .failed(.denied)
            case .expired:
                state = .failed(.expiredCode)
            case .approved:
                guard let token = result.sessionToken,
                      !token.isEmpty,
                      let expiresAt = result.expiresAt,
                      expiresAt > now else {
                    state = .failed(.malformedResponse)
                    return
                }
                state = .authorized(SessionRecord(token: token, email: result.email, expiresAt: expiresAt))
            }
        case let .fail(failure):
            state = .failed(failure)
        case let .restore(session):
            if let session, session.expiresAt > now {
                state = .authorized(session)
            } else {
                state = .signedOut
            }
        case .logout:
            state = .signedOut
        }
    }
}
