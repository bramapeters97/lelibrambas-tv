import XCTest

final class LeliBrambasTVUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testFixtureHomeExposesNavigationAndMedia() throws {
        let app = fixtureApplication(screen: "home")
        app.launch()

        XCTAssertTrue(identified("home-screen", in: app).waitForExistence(timeout: 12))
        XCTAssertTrue(app.buttons["nav-search"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["nav-settings"].exists)
        XCTAssertTrue(app.staticTexts["The Lantern Archive"].waitForExistence(timeout: 5))
    }

    func testFixtureMediaDetailsRenderExpectedContent() throws {
        let app = fixtureApplication(screen: "details")
        app.launch()

        XCTAssertTrue(identified("details-screen", in: app).waitForExistence(timeout: 12))
        XCTAssertTrue(app.staticTexts["The Lantern Archive"].waitForExistence(timeout: 5))
    }

    func testActivationStateDoesNotBypassAuthentication() throws {
        let app = fixtureApplication(screen: "activation")
        app.launch()

        XCTAssertTrue(identified("activation-screen", in: app).waitForExistence(timeout: 12))
        XCTAssertTrue(app.buttons["Activate Apple TV"].waitForExistence(timeout: 5))
        XCTAssertFalse(identified("authenticated-root", in: app).exists)
    }

    func testSettingsExposeAuthenticatedSessionAndLogout() throws {
        let app = fixtureApplication(screen: "settings")
        app.launch()

        XCTAssertTrue(identified("settings-screen", in: app).waitForExistence(timeout: 12))
        XCTAssertTrue(app.buttons["nav-home"].exists)
        XCTAssertTrue(app.buttons["Sign out"].waitForExistence(timeout: 5))
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

    private func identified(_ identifier: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }
}
