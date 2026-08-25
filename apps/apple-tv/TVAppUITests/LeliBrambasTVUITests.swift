import XCTest

final class LeliBrambasTVUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testFixtureHomeExposesNavigationAndMedia() throws {
        let app = fixtureApplication(screen: "home")
        app.launch()

        XCTAssertTrue(app.otherElements["home-screen"].waitForExistence(timeout: 12))
        XCTAssertTrue(app.buttons["nav-search"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["nav-settings"].exists)
        XCTAssertTrue(app.buttons["media-card-1"].waitForExistence(timeout: 5))
    }

    func testFixtureMediaDetailsRenderExpectedContent() throws {
        let app = fixtureApplication(screen: "details")
        app.launch()

        XCTAssertTrue(app.otherElements["details-screen"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["details-title"].label, "The Lantern Archive")
    }

    func testActivationStateDoesNotBypassAuthentication() throws {
        let app = fixtureApplication(screen: "activation")
        app.launch()

        XCTAssertTrue(app.otherElements["activation-screen"].waitForExistence(timeout: 12))
        XCTAssertTrue(app.buttons["activation-start"].exists)
        XCTAssertFalse(app.otherElements["authenticated-root"].exists)
    }

    func testSettingsExposeAuthenticatedSessionAndLogout() throws {
        let app = fixtureApplication(screen: "settings")
        app.launch()

        XCTAssertTrue(app.otherElements["settings-screen"].waitForExistence(timeout: 12))
        XCTAssertTrue(app.otherElements["authenticated-root"].exists)
        XCTAssertTrue(app.buttons["settings-logout"].waitForExistence(timeout: 5))
    }

    private func fixtureApplication(screen: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "--ui-testing",
            "--screenshot-mode",
            "--screenshot-screen",
            screen,
        ]
        return app
    }
}
