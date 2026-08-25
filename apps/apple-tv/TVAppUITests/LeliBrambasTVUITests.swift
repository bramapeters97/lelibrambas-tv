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

    func testFixtureSearchMatchesWebHierarchyAndDefaultsToTheField() throws {
        let app = fixtureApplication(screen: "search")
        app.launch()

        XCTAssertTrue(identified("search-screen", in: app).waitForExistence(timeout: 12))
        XCTAssertTrue(app.staticTexts["Search the archive"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["TITLES, FOLDER GROUPS, YEARS AND COLLECTIONS"].exists)
        XCTAssertTrue(app.staticTexts["SUGGESTED FOR YOU"].exists)
        XCTAssertTrue(app.staticTexts["Start with a familiar shelf"].exists)
        XCTAssertTrue(app.staticTexts["6 results"].exists)
        let searchField = identified("search-field", in: app)
        XCTAssertTrue(searchField.waitForExistence(timeout: 5))
        XCTAssertTrue(searchField.hasFocus)
    }

    func testFixtureFullLibraryMatchesWebHierarchy() throws {
        let app = fixtureApplication(screen: "library")
        app.launch()

        XCTAssertTrue(identified("library-screen", in: app).waitForExistence(timeout: 12))
        XCTAssertTrue(app.staticTexts["Full Library"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["EVERY FILM IN THE PRIVATE ARCHIVE"].exists)
        XCTAssertTrue(app.staticTexts["COMPLETE CATALOGUE"].exists)
        XCTAssertTrue(app.staticTexts["All movies"].exists)
        XCTAssertTrue(app.staticTexts["6 titles"].exists)
    }

    func testFixtureCollectionsUpdatesResultsInline() throws {
        let app = fixtureApplication(screen: "playback-ready")
        app.launch()

        XCTAssertTrue(identified("collections-screen", in: app).waitForExistence(timeout: 12))
        XCTAssertTrue(identified("collection-results-jeugdfilms", in: app).waitForExistence(timeout: 5))

        let holidayCollection = app.buttons["collection-vakantiefilms"]
        XCTAssertTrue(holidayCollection.waitForExistence(timeout: 5))
        holidayCollection.tap()

        XCTAssertTrue(identified("collection-results-vakantiefilms", in: app).waitForExistence(timeout: 5))
        XCTAssertTrue(identified("collections-screen", in: app).exists)
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
