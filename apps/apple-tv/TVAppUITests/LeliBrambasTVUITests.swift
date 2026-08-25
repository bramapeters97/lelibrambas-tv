import XCTest

final class LeliBrambasTVUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testFixtureHomeOpensMediaDetails() throws {
        let app = fixtureApplication(screen: "home")
        app.launch()

        XCTAssertTrue(app.otherElements["home-screen"].waitForExistence(timeout: 12))
        let card = app.buttons["media-card-1"]
        XCTAssertTrue(card.waitForExistence(timeout: 5))
        card.tap()
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

    func testMainNavigationReachesSearchAndSettings() throws {
        let app = fixtureApplication(screen: "home")
        app.launch()
        XCTAssertTrue(app.otherElements["home-screen"].waitForExistence(timeout: 12))

        app.buttons["nav-search"].tap()
        XCTAssertTrue(app.otherElements["search-screen"].waitForExistence(timeout: 5))
        app.buttons["nav-settings"].tap()
        XCTAssertTrue(app.otherElements["settings-screen"].waitForExistence(timeout: 5))
    }

    func testLogoutReturnsToDeviceActivation() throws {
        let app = fixtureApplication(screen: "home")
        app.launch()
        XCTAssertTrue(app.otherElements["home-screen"].waitForExistence(timeout: 12))

        app.buttons["nav-settings"].tap()
        XCTAssertTrue(app.otherElements["settings-screen"].waitForExistence(timeout: 5))
        app.buttons["settings-logout"].tap()

        let confirmation = app.buttons["confirm-logout"]
        XCTAssertTrue(confirmation.waitForExistence(timeout: 5))
        confirmation.tap()
        XCTAssertTrue(app.otherElements["activation-screen"].waitForExistence(timeout: 5))
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
