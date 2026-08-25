import Foundation
import XCTest
@testable import LeliBrambasCore

final class AppConfigurationTests: XCTestCase {
    func testResolvesRequiredSecureURLs() throws {
        let configuration = try AppConfiguration.resolve(from: [
            "API_BASE_URL": "https://gateway.example.test",
            "ACTIVATION_BASE_URL": "https://activate.example.test",
        ])

        XCTAssertEqual(configuration.apiBaseURL.absoluteString, "https://gateway.example.test")
        XCTAssertEqual(configuration.activationBaseURL.absoluteString, "https://activate.example.test")
        XCTAssertEqual(configuration.requestTimeout, 20)
    }

    func testRejectsMissingConfiguration() {
        XCTAssertThrowsError(try AppConfiguration.resolve(from: [:])) { error in
            XCTAssertEqual(error as? ConfigurationError, .missingRequiredValue)
        }
    }

    func testRejectsInsecureTransport() {
        XCTAssertThrowsError(
            try AppConfiguration(
                apiBaseURL: URL(string: "http://gateway.example.test")!,
                activationBaseURL: URL(string: "https://activate.example.test")!
            )
        ) { error in
            XCTAssertEqual(error as? ConfigurationError, .secureTransportRequired)
        }
    }

    func testClampsTimeoutToFiveSeconds() throws {
        let configuration = try AppConfiguration(
            apiBaseURL: URL(string: "https://gateway.example.test")!,
            activationBaseURL: URL(string: "https://activate.example.test")!,
            requestTimeout: 1
        )
        XCTAssertEqual(configuration.requestTimeout, 5)
    }
}
