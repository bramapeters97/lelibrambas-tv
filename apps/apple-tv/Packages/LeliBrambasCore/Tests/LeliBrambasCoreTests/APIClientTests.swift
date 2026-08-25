import Foundation
import XCTest
@testable import LeliBrambasCore

final class APIClientTests: XCTestCase {
    private struct Message: Codable, Equatable, Sendable { let value: String }
    private struct RequestBody: Encodable, Sendable { let name: String }

    override func tearDown() {
        URLProtocolStub.reset()
        super.tearDown()
    }

    func testSendsJSONBodyAndBearerTokenOnlyToConfiguredHost() async throws {
        let observed = LockedBox<URLRequest>()
        URLProtocolStub.install { request in
            observed.set(request)
            return (
                makeHTTPResponse(for: request),
                Data(#"{"value":"accepted"}"#.utf8)
            )
        }
        let client = APIClient(
            baseURL: URL(string: "https://gateway.example.test")!,
            session: makeStubbedSession()
        )

        let response: Message = try await client.send(
            path: "/v1/synthetic",
            method: .post,
            body: RequestBody(name: "Fixture Viewer"),
            bearerToken: "synthetic-session-token"
        )

        XCTAssertEqual(response, Message(value: "accepted"))
        let request = try XCTUnwrap(observed.get())
        XCTAssertEqual(request.url?.absoluteString, "https://gateway.example.test/v1/synthetic")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer synthetic-session-token")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
        XCTAssertTrue(
            String(data: try XCTUnwrap(requestBodyData(from: request)), encoding: .utf8)?
                .contains("Fixture Viewer") == true
        )
    }

    func testRejectsAbsoluteAndCrossHostPathsBeforeTransport() async {
        let client = APIClient(
            baseURL: URL(string: "https://gateway.example.test")!,
            session: makeStubbedSession()
        )
        do {
            let _: Message = try await client.send(
                path: "https://other.example.test/v1/data",
                method: .get,
                body: Optional<EmptyBody>.none
            )
            XCTFail("Expected absolute URL rejection")
        } catch {
            XCTAssertEqual(error as? APIError, .invalidRequest)
        }
        do {
            let _: Message = try await client.send(
                path: "//other.example.test/v1/data",
                method: .get,
                body: Optional<EmptyBody>.none
            )
            XCTFail("Expected cross-host URL rejection")
        } catch {
            XCTAssertEqual(error as? APIError, .invalidRequest)
        }
    }

    func testMapsRetryAfterAndMalformedResponses() async {
        URLProtocolStub.install { request in
            (
                makeHTTPResponse(for: request, status: 429, headers: ["Retry-After": "17"]),
                Data()
            )
        }
        let client = APIClient(
            baseURL: URL(string: "https://gateway.example.test")!,
            session: makeStubbedSession()
        )
        do {
            let _: Message = try await client.send(
                path: "/v1/rate-limited",
                method: .get,
                body: Optional<EmptyBody>.none
            )
            XCTFail("Expected rate limit")
        } catch {
            XCTAssertEqual(error as? APIError, .rateLimited(retryAfter: 17))
        }

        URLProtocolStub.install { request in
            (makeHTTPResponse(for: request), Data("not-json".utf8))
        }
        do {
            let _: Message = try await client.send(
                path: "/v1/malformed",
                method: .get,
                body: Optional<EmptyBody>.none
            )
            XCTFail("Expected malformed response")
        } catch {
            XCTAssertEqual(error as? APIError, .malformedResponse)
        }
    }

    func testStatusMapperCoversPublicErrorContract() {
        XCTAssertNil(APIErrorMapper.map(status: 204))
        XCTAssertEqual(APIErrorMapper.map(status: 401), .unauthorized)
        XCTAssertEqual(APIErrorMapper.map(status: 403), .forbidden)
        XCTAssertEqual(APIErrorMapper.map(status: 404), .notFound)
        XCTAssertEqual(APIErrorMapper.map(status: 503), .serverUnavailable)
        XCTAssertEqual(APIErrorMapper.map(status: 418), .server(status: 418))
    }
}
