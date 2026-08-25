import Foundation

public struct AppConfiguration: Equatable, Sendable {
    public let apiBaseURL: URL
    public let activationBaseURL: URL
    public let requestTimeout: TimeInterval

    public init(apiBaseURL: URL, activationBaseURL: URL, requestTimeout: TimeInterval = 20) throws {
        guard apiBaseURL.scheme == "https", activationBaseURL.scheme == "https" else {
            throw ConfigurationError.secureTransportRequired
        }
        self.apiBaseURL = apiBaseURL
        self.activationBaseURL = activationBaseURL
        self.requestTimeout = max(5, requestTimeout)
    }

    public static func resolve(from values: [String: Any]) throws -> AppConfiguration {
        guard let apiValue = values["API_BASE_URL"] as? String,
              let apiURL = URL(string: apiValue),
              let activationValue = values["ACTIVATION_BASE_URL"] as? String,
              let activationURL = URL(string: activationValue) else {
            throw ConfigurationError.missingRequiredValue
        }
        return try AppConfiguration(apiBaseURL: apiURL, activationBaseURL: activationURL)
    }
}

public enum ConfigurationError: Error, Equatable, Sendable {
    case missingRequiredValue
    case secureTransportRequired
}
