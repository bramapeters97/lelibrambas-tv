import Foundation
import XCTest
@testable import LeliBrambasCore

final class SessionStoreAndRedactorTests: XCTestCase {
    func testMemorySessionStoreRoundTripAndClear() throws {
        let store = MemorySessionStore()
        XCTAssertNil(try store.load())
        let session = SessionRecord(
            token: "synthetic-session-token",
            email: "viewer@example.test",
            expiresAt: Date(timeIntervalSince1970: 2_000_000_000)
        )
        try store.save(session)
        XCTAssertEqual(try store.load(), session)
        try store.clear()
        XCTAssertNil(try store.load())
    }

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
