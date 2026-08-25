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

    func testProductionLaunchShowsTheLocalProfileSelector() throws {
        let app = productionApplication()
        app.launch()

        XCTAssertTrue(identified("profile-selector", in: app).waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["profile-bart-astrid"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["profile-bram-edvin"].exists)
        XCTAssertTrue(app.buttons["profile-eline-luca"].exists)
        XCTAssertFalse(identified("browse-root", in: app).exists)
        XCTAssertFalse(identified("activation-screen", in: app).exists)
        XCTAssertFalse(app.buttons["Activate Apple TV"].exists)
    }

    func testProductionProfileSelectionOpensBundledHome() throws {
        let app = productionApplication()
        app.launch()

        let profile = app.buttons["profile-bart-astrid"]
        XCTAssertTrue(profile.waitForExistence(timeout: 15))
        profile.tap()

        XCTAssertTrue(identified("home-screen", in: app).waitForExistence(timeout: 15))
        XCTAssertTrue(identified("browse-root", in: app).exists)
        XCTAssertTrue(app.buttons["switch-profile"].waitForExistence(timeout: 5))
        XCTAssertFalse(identified("activation-screen", in: app).exists)
    }

    func testSettingsDescribeBundledContentWithoutLoginControls() throws {
        let app = fixtureApplication(screen: "settings")
        app.launch()

        XCTAssertTrue(identified("settings-screen", in: app).waitForExistence(timeout: 12))
        XCTAssertTrue(app.buttons["nav-home"].exists)
        XCTAssertTrue(app.staticTexts["Bundled catalogue and artwork"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Sign out"].exists)
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

    private func productionApplication() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-ApplePersistenceIgnoreState", "YES"]
        return app
    }

    private func identified(_ identifier: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }
}
