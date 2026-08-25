import Foundation
import XCTest
@testable import LeliBrambasCore

final class RedactorTests: XCTestCase {
    func testRedactorNeverReturnsSecretsOrURLPaths() {
        XCTAssertEqual(Redactor.email("viewer@example.test"), "<redacted>@example.test")
        XCTAssertEqual(Redactor.email("not-an-email"), "<redacted>")
        XCTAssertEqual(Redactor.token("synthetic-secret"), "<redacted:16>")
        XCTAssertEqual(Redactor.token(nil), "<none>")
        XCTAssertEqual(
            Redactor.signedURL(
                URL(string: "https://media.example.test/private/movie.m3u8?token=synthetic-secret")
            ),
            "https://media.example.test/<redacted>"
        )
    }
}
