import Foundation
import XCTest
@testable import LeliBrambasCore

final class ServicesTests: XCTestCase {
    override func tearDown() {
        URLProtocolStub.reset()
        super.tearDown()
    }

    func testCatalogServiceDecodesAndSortsSyntheticFixture() async throws {
        let observed = LockedBox<URLRequest>()
        let data = try TestFixtures.data(named: "catalog")
        URLProtocolStub.install { request in
            observed.set(request)
            return (makeHTTPResponse(for: request), data)
        }
        let service = GatewayCatalogService(client: makeClient())
        let items = try await service.loadCatalog(sessionToken: "synthetic-session-token")

        XCTAssertEqual(items.map(\.id), [104, 103, 101, 102])
        XCTAssertEqual(observed.get()?.url?.path, "/v1/catalog")
        XCTAssertEqual(
            observed.get()?.value(forHTTPHeaderField: "Authorization"),
            "Bearer synthetic-session-token"
        )
    }

    func testDeviceAuthorizationBeginAndPollUseExpectedEndpoints() async throws {
        let challengeData = try TestFixtures.data(named: "activation-challenge")
        let approvedData = try TestFixtures.data(named: "activation-approved")
        let requests = LockedBox<[URLRequest]>()
        requests.set([])
        URLProtocolStub.install { request in
            var captured = requests.get() ?? []
            captured.append(request)
            requests.set(captured)
            let payload = request.httpMethod == "POST" ? challengeData : approvedData
            return (makeHTTPResponse(for: request), payload)
        }
        let service = GatewayDeviceAuthService(
            client: makeClient(),
            activationBaseURL: URL(string: "https://activate.example.test")!
        )

        let challenge = try await service.begin(deviceName: "Synthetic Apple TV")
        let approval = try await service.poll(deviceCode: challenge.deviceCode)

        XCTAssertEqual(challenge.userCode, "MEMORY")
        XCTAssertEqual(approval.status, .approved)
        XCTAssertEqual(approval.email, "viewer@example.test")
        let captured = requests.get() ?? []
        XCTAssertEqual(captured.map { $0.url?.path }, [
            "/v1/device/authorizations",
            "/v1/device/authorizations/synthetic-device-code",
        ])
        XCTAssertTrue(
            String(data: try XCTUnwrap(captured.first?.httpBody), encoding: .utf8)?
                .contains("Synthetic Apple TV") == true
        )
    }

    func testPlaybackServiceRequestsSignedURLAndResolvesIt() async throws {
        let observed = LockedBox<URLRequest>()
        URLProtocolStub.install { request in
            observed.set(request)
            return (
                makeHTTPResponse(for: request),
                Data(#"{"data":{"playback_url":"https://media.example.test/fixture/movie.m3u8?token=synthetic"}}"#.utf8)
            )
        }
        let item = MediaItem(
            id: 404,
            title: "Synthetic Playback",
            year: 2024,
            description: "A fully synthetic playback fixture.",
            category: "OTHERS",
            posterURL: "fixture://playback"
        )
        let service = GatewayPlaybackService(client: makeClient())
        let url = try await service.playbackURL(
            for: item,
            sessionToken: "synthetic-session-token"
        )

        XCTAssertEqual(url.host, "media.example.test")
        XCTAssertEqual(observed.get()?.url?.path, "/v1/media/404/playback")
        XCTAssertEqual(observed.get()?.httpMethod, "POST")
    }

    func testSessionServiceRotatesAndRevokesThroughFixedEndpoints() async throws {
        let requests = LockedBox<[URLRequest]>()
        requests.set([])
        URLProtocolStub.install { request in
            var captured = requests.get() ?? []
            captured.append(request)
            requests.set(captured)
            if request.httpMethod == "DELETE" {
                return (makeHTTPResponse(for: request, status: 204), Data())
            }
            return (
                makeHTTPResponse(for: request),
                Data(
                    #"{"data":{"session_token":"rotated-synthetic-token","email":"viewer@example.test","expires_at":"2033-05-18T03:33:20Z"}}"#.utf8
                )
            )
        }
        let service = GatewaySessionService(client: makeClient())

        let refreshed = try await service.refresh(sessionToken: "synthetic-session-token")
        try await service.revoke(sessionToken: refreshed.token)

        XCTAssertEqual(refreshed.token, "rotated-synthetic-token")
        XCTAssertEqual(requests.get()?.compactMap { $0.url?.path }, [
            "/v1/sessions/refresh",
            "/v1/sessions/current",
        ])
        XCTAssertEqual(requests.get()?.last?.httpMethod, "DELETE")
        XCTAssertEqual(
            requests.get()?.last?.value(forHTTPHeaderField: "Authorization"),
            "Bearer rotated-synthetic-token"
        )
    }

    private func makeClient() -> APIClient {
        APIClient(
            baseURL: URL(string: "https://gateway.example.test")!,
            session: makeStubbedSession()
        )
    }
}
