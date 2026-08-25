import Foundation
import XCTest
@testable import LeliBrambasCore

final class AuthenticationStateMachineTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 2_000_000_000)

    func testChallengeAndApprovedPollAuthorizeSession() {
        var machine = AuthenticationStateMachine()
        machine.send(.begin, now: now)
        XCTAssertEqual(machine.state, .requesting)

        let challenge = makeChallenge(expiresAt: now.addingTimeInterval(600))
        machine.send(.challenge(challenge), now: now)
        XCTAssertEqual(machine.state, .awaitingApproval(challenge))

        let response = ActivationPollResponse(
            status: .approved,
            sessionToken: "synthetic-session-token",
            email: "viewer@example.test",
            expiresAt: now.addingTimeInterval(3_600)
        )
        machine.send(.poll(response), now: now)
        XCTAssertEqual(
            machine.state,
            .authorized(
                SessionRecord(
                    token: "synthetic-session-token",
                    email: "viewer@example.test",
                    expiresAt: now.addingTimeInterval(3_600)
                )
            )
        )
    }

    func testPendingPollPreservesAwaitingState() {
        var machine = AuthenticationStateMachine()
        let challenge = makeChallenge(expiresAt: now.addingTimeInterval(600))
        machine.send(.challenge(challenge), now: now)
        machine.send(.poll(ActivationPollResponse(status: .pending)), now: now)
        XCTAssertEqual(machine.state, .awaitingApproval(challenge))
    }

    func testExpiredChallengeFailsImmediately() {
        var machine = AuthenticationStateMachine()
        machine.send(.challenge(makeChallenge(expiresAt: now)), now: now)
        XCTAssertEqual(machine.state, .failed(.expiredCode))
    }

    func testDeniedAndExpiredPollsFail() {
        var denied = AuthenticationStateMachine()
        denied.send(.poll(ActivationPollResponse(status: .denied)), now: now)
        XCTAssertEqual(denied.state, .failed(.denied))

        var expired = AuthenticationStateMachine()
        expired.send(.poll(ActivationPollResponse(status: .expired)), now: now)
        XCTAssertEqual(expired.state, .failed(.expiredCode))
    }

    func testMalformedApprovalFailsClosed() {
        var machine = AuthenticationStateMachine()
        machine.send(
            .poll(
                ActivationPollResponse(
                    status: .approved,
                    sessionToken: "",
                    email: "viewer@example.test",
                    expiresAt: now.addingTimeInterval(60)
                )
            ),
            now: now
        )
        XCTAssertEqual(machine.state, .failed(.malformedResponse))
    }

    func testRestoreOnlyAcceptsUnexpiredSessionAndLogoutClearsState() {
        let valid = SessionRecord(
            token: "synthetic-session-token",
            email: nil,
            expiresAt: now.addingTimeInterval(60)
        )
        var machine = AuthenticationStateMachine()
        machine.send(.restore(valid), now: now)
        XCTAssertEqual(machine.state, .authorized(valid))
        machine.send(.logout, now: now)
        XCTAssertEqual(machine.state, .signedOut)

        let expired = SessionRecord(
            token: "expired-synthetic-token",
            email: nil,
            expiresAt: now
        )
        machine.send(.restore(expired), now: now)
        XCTAssertEqual(machine.state, .signedOut)
    }

    func testActivationFixtureDecodesSnakeCaseFields() throws {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let challenge = try decoder.decode(
            APIEnvelope<ActivationChallenge>.self,
            from: TestFixtures.data(named: "activation-challenge")
        ).data

        XCTAssertEqual(challenge.deviceCode, "synthetic-device-code")
        XCTAssertEqual(challenge.userCode, "MEMORY")
        XCTAssertEqual(challenge.intervalSeconds, 3)
        XCTAssertEqual(challenge.verificationURL.host, "activate.example.test")
    }

    private func makeChallenge(expiresAt: Date) -> ActivationChallenge {
        ActivationChallenge(
            deviceCode: "synthetic-device-code",
            userCode: "MEMORY",
            verificationURL: URL(string: "https://activate.example.test")!,
            verificationURLComplete: nil,
            expiresAt: expiresAt,
            intervalSeconds: 1
        )
    }
}
