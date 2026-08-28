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
        XCTAssertTrue(waitForFocus(on: app.buttons["hero-play"]))
    }

    func testHomeFocusMovesFromHeroThroughConsecutiveShelves() throws {
        let app = fixtureApplication(screen: "home")
        app.launch()

        XCTAssertTrue(identified("home-screen", in: app).waitForExistence(timeout: 12))
        let remote = XCUIRemote.shared
        let heroPlay = app.buttons["hero-play"]
        let heroDetails = app.buttons["hero-details"]
        XCTAssertTrue(heroPlay.waitForExistence(timeout: 5))
        XCTAssertTrue(waitForFocus(on: heroPlay))

        remote.press(.right)
        XCTAssertTrue(waitForFocus(on: heroDetails))
        remote.press(.left)
        XCTAssertTrue(waitForFocus(on: heroPlay))

        remote.press(.down)
        XCTAssertTrue(waitForFocusAppearance(on: app.buttons["collection-jeugdfilms"]))
        remote.press(.down)
        let firstCard = app.buttons["media-card-1"]
        XCTAssertTrue(waitForFocusAppearance(on: firstCard))

        remote.press(.right)
        let secondCard = app.buttons["media-card-6"]
        XCTAssertTrue(waitForFocusAppearance(on: secondCard))
        XCTAssertTrue(waitForNoFocusAppearance(on: firstCard))
        remote.press(.left)
        XCTAssertTrue(waitForFocusAppearance(on: firstCard))
        XCTAssertTrue(waitForNoFocusAppearance(on: secondCard))
        remote.press(.right)
        XCTAssertTrue(waitForFocusAppearance(on: secondCard))
        remote.press(.right)
        XCTAssertTrue(waitForFocusAppearance(on: secondCard))

        remote.press(.down)
        XCTAssertTrue(waitForFocusAppearance(on: app.buttons["media-card-5"]))
        XCTAssertTrue(waitForNoFocusAppearance(on: secondCard))
        remote.press(.down)
        XCTAssertTrue(waitForFocusAppearance(on: app.buttons["media-card-3"]))
        remote.press(.right)
        XCTAssertTrue(waitForFocusAppearance(on: app.buttons["media-card-3"]))
        remote.press(.down)
        XCTAssertTrue(waitForFocusAppearance(on: app.buttons["media-card-4"]))
    }

    func testFocusedMovieOpensMatchingDetailsAndReturnsFocus() throws {
        let app = fixtureApplication(screen: "home")
        app.launch()

        XCTAssertTrue(identified("home-screen", in: app).waitForExistence(timeout: 12))
        let remote = XCUIRemote.shared
        remote.press(.down)
        XCTAssertTrue(waitForFocusAppearance(on: app.buttons["collection-jeugdfilms"]))
        remote.press(.down)

        let originCard = app.buttons["media-card-1"]
        XCTAssertTrue(waitForFocusAppearance(on: originCard))
        remote.press(.select)

        XCTAssertTrue(identified("details-screen", in: app).waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["The Lantern Archive"].waitForExistence(timeout: 5))
        let play = app.buttons["details-play"]
        let back = app.buttons["details-back"]
        XCTAssertTrue(waitForFocus(on: play))
        remote.press(.up)
        XCTAssertTrue(waitForFocus(on: back))
        remote.press(.down)
        XCTAssertTrue(waitForFocus(on: play))

        remote.press(.menu)
        XCTAssertTrue(identified("home-screen", in: app).waitForExistence(timeout: 8))
        XCTAssertTrue(waitForFocusAppearance(on: originCard))
        XCTAssertTrue(waitForSingleFocusAppearance(in: app))
    }

    func testFixtureMediaDetailsRenderExpectedContent() throws {
        let app = fixtureApplication(screen: "details")
        app.launch()

        XCTAssertTrue(identified("details-screen", in: app).waitForExistence(timeout: 12))
        XCTAssertTrue(app.staticTexts["The Lantern Archive"].waitForExistence(timeout: 5))
        XCTAssertTrue(waitForFocus(on: app.buttons["details-play"]))
    }

    func testProductionLaunchRunsTheWebIdentThenShowsTheLocalProfileSelector() throws {
        let app = productionApplication()
        app.launch()

        let intro = identified("intro-screen", in: app)
        XCTAssertTrue(intro.waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["LELIBRAMBAS+"].waitForExistence(timeout: 4))
        XCTAssertTrue(app.staticTexts["A private family archive"].exists)
        XCTAssertFalse(identified("profile-selector", in: app).exists)
        XCTAssertFalse(identified("activation-screen", in: app).exists)
        attachScreenshot(named: "production-intro-ident")

        XCTAssertTrue(identified("profile-selector", in: app).waitForExistence(timeout: 15))
        XCTAssertFalse(intro.exists)
        let firstProfile = app.buttons["profile-bart-astrid"]
        let secondProfile = app.buttons["profile-bram-edvin"]
        XCTAssertTrue(firstProfile.waitForExistence(timeout: 5))
        XCTAssertTrue(secondProfile.exists)
        XCTAssertTrue(app.buttons["profile-eline-luca"].exists)
        XCTAssertTrue(waitForFocus(on: firstProfile))
        attachScreenshot(named: "profile-focus-first")
        XCUIRemote.shared.press(.right)
        XCTAssertTrue(waitForFocus(on: secondProfile))
        XCTAssertTrue(waitForNoFocusAppearance(on: firstProfile))
        attachScreenshot(named: "profile-focus-second")
        XCUIRemote.shared.press(.left)
        XCTAssertTrue(waitForFocus(on: firstProfile))
        XCTAssertTrue(waitForNoFocusAppearance(on: secondProfile))
        XCTAssertFalse(identified("browse-root", in: app).exists)
        XCTAssertFalse(identified("activation-screen", in: app).exists)
        XCTAssertFalse(app.buttons["Activate Apple TV"].exists)
    }

    func testProductionProfileSelectionOpensBundledHome() throws {
        let app = productionApplication()
        app.launch()

        let profile = app.buttons["profile-bart-astrid"]
        XCTAssertTrue(profile.waitForExistence(timeout: 15))
        XCTAssertTrue(waitForFocus(on: profile))
        XCUIRemote.shared.press(.select)

        XCTAssertTrue(identified("home-screen", in: app).waitForExistence(timeout: 15))
        XCTAssertTrue(identified("browse-root", in: app).exists)
        XCTAssertTrue(app.buttons["switch-profile"].waitForExistence(timeout: 5))
        XCTAssertTrue(waitForFocus(on: app.buttons["hero-play"]))
        XCTAssertFalse(identified("activation-screen", in: app).exists)
    }

    func testProductionBackgroundReturnReplaysIntroAndRequiresProfileAgain() throws {
        let app = productionApplication()
        app.launch()

        let profile = app.buttons["profile-bart-astrid"]
        XCTAssertTrue(profile.waitForExistence(timeout: 15))
        XCTAssertTrue(waitForFocus(on: profile))
        XCUIRemote.shared.press(.select)
        XCTAssertTrue(identified("home-screen", in: app).waitForExistence(timeout: 15))

        XCUIRemote.shared.press(.menu)
        XCTAssertTrue(waitForBackground(on: app))
        app.activate()

        let intro = identified("intro-screen", in: app)
        XCTAssertTrue(intro.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["LELIBRAMBAS+"].waitForExistence(timeout: 5))
        XCTAssertFalse(identified("home-screen", in: app).exists)
        XCTAssertFalse(identified("profile-selector", in: app).exists)

        XCTAssertTrue(identified("profile-selector", in: app).waitForExistence(timeout: 15))
        XCTAssertFalse(intro.exists)
        XCTAssertTrue(app.buttons["profile-bart-astrid"].exists)
        XCTAssertFalse(identified("home-screen", in: app).exists)
        XCTAssertFalse(identified("activation-screen", in: app).exists)
    }

    func testSettingsDescribeLiveContentWithoutLoginControls() throws {
        let app = fixtureApplication(screen: "settings")
        app.launch()

        XCTAssertTrue(identified("settings-screen", in: app).waitForExistence(timeout: 12))
        XCTAssertTrue(app.buttons["nav-home"].exists)
        XCTAssertTrue(app.staticTexts["Live Cloudflare catalogue"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Sign out"].exists)
        let settings = app.buttons["nav-settings"]
        XCTAssertTrue(waitForFocus(on: settings))
        attachScreenshot(named: "navigation-focus-settings")
        XCUIRemote.shared.press(.up)
        let library = app.buttons["nav-library"]
        XCTAssertTrue(waitForFocus(on: library))
        XCTAssertTrue(waitForNoFocusAppearance(on: settings))
        XCUIRemote.shared.press(.down)
        XCTAssertTrue(waitForFocus(on: settings))
        XCTAssertTrue(waitForNoFocusAppearance(on: library))
        XCUIRemote.shared.press(.down)
        let switchProfile = app.buttons["switch-profile"]
        XCTAssertTrue(waitForFocus(on: switchProfile))
        XCTAssertTrue(waitForNoFocusAppearance(on: settings))
        attachScreenshot(named: "navigation-focus-switch-profile")
        XCUIRemote.shared.press(.up)
        XCTAssertTrue(waitForFocus(on: settings))
        XCTAssertTrue(waitForNoFocusAppearance(on: switchProfile))
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
        XCTAssertTrue(waitForFocus(on: searchField))
    }

    func testSearchMovesPredictablyBetweenFieldAndResults() throws {
        let app = fixtureApplication(screen: "search")
        app.launch()

        XCTAssertTrue(identified("search-screen", in: app).waitForExistence(timeout: 12))
        let searchField = identified("search-field", in: app)
        XCTAssertTrue(waitForFocus(on: searchField))

        let remote = XCUIRemote.shared
        remote.press(.down)
        let firstCard = app.buttons["media-card-1"]
        let secondCard = app.buttons["media-card-2"]
        XCTAssertTrue(waitForFocusAppearance(on: firstCard))
        remote.press(.right)
        XCTAssertTrue(waitForFocusAppearance(on: secondCard))
        XCTAssertTrue(waitForNoFocusAppearance(on: firstCard))
        remote.press(.up)
        XCTAssertTrue(waitForFocus(on: searchField))
        XCTAssertTrue(waitForNoFocusAppearance(on: secondCard))
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
        XCTAssertTrue(waitForFocus(on: app.buttons["media-card-1"]))
    }

    func testLibraryGridPreservesDirectionalPosition() throws {
        let app = fixtureApplication(screen: "library")
        app.launch()

        XCTAssertTrue(identified("library-screen", in: app).waitForExistence(timeout: 12))
        let remote = XCUIRemote.shared
        XCTAssertTrue(waitForFocusAppearance(on: app.buttons["media-card-1"]))
        remote.press(.right)
        XCTAssertTrue(waitForFocusAppearance(on: app.buttons["media-card-2"]))
        remote.press(.down)
        XCTAssertTrue(waitForFocusAppearance(on: app.buttons["media-card-6"]))
        remote.press(.up)
        XCTAssertTrue(waitForFocusAppearance(on: app.buttons["media-card-2"]))
    }

    func testFixtureCollectionsUpdatesResultsInline() throws {
        let app = fixtureApplication(screen: "playback-ready")
        app.launch()

        XCTAssertTrue(identified("collections-screen", in: app).waitForExistence(timeout: 12))
        XCTAssertTrue(identified("collection-results-jeugdfilms", in: app).waitForExistence(timeout: 5))

        let childhoodCollection = app.buttons["collection-jeugdfilms"]
        let holidayCollection = app.buttons["collection-vakantiefilms"]
        XCTAssertTrue(childhoodCollection.waitForExistence(timeout: 5))
        XCTAssertTrue(holidayCollection.waitForExistence(timeout: 5))
        XCTAssertTrue(waitForFocusAppearance(on: childhoodCollection))
        XCUIRemote.shared.press(.right)
        XCTAssertTrue(waitForFocusAppearance(on: holidayCollection))
        XCTAssertTrue(waitForNoFocusAppearance(on: childhoodCollection))
        XCTAssertTrue(identified("collection-results-vakantiefilms", in: app).waitForExistence(timeout: 5))

        XCUIRemote.shared.press(.down)
        XCTAssertTrue(waitForFocusAppearance(on: app.buttons["media-card-5"]))
        XCTAssertTrue(waitForNoFocusAppearance(on: holidayCollection))
        XCUIRemote.shared.press(.up)
        XCTAssertTrue(waitForFocusAppearance(on: holidayCollection))
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

    private func waitForFocus(on element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        let predicate = NSPredicate { object, _ in
            (object as? XCUIElement)?.hasFocus == true
        }
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        let result = XCTWaiter.wait(for: [expectation], timeout: timeout)
        guard result == .completed else {
            let focusedElements = XCUIApplication()
                .descendants(matching: .any)
                .matching(NSPredicate(format: "hasFocus == true"))
                .allElementsBoundByIndex
                .map { "\($0.elementType):\($0.identifier):\($0.label)" }
            print("[focus-debug] expected=\(element.identifier) actual=\(focusedElements)")
            return false
        }
        return true
    }

    private func waitForBackground(on app: XCUIApplication, timeout: TimeInterval = 8) -> Bool {
        let predicate = NSPredicate { object, _ in
            guard let app = object as? XCUIApplication else { return false }
            switch app.state {
            case .runningBackground, .runningBackgroundSuspended:
                return true
            default:
                return false
            }
        }
        return XCTWaiter.wait(
            for: [XCTNSPredicateExpectation(predicate: predicate, object: app)],
            timeout: timeout
        ) == .completed
    }

    private func waitForFocusAppearance(on element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        waitForFocus(on: element, timeout: timeout)
    }

    private func waitForNoFocusAppearance(on element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        let predicate = NSPredicate { object, _ in
            guard let element = object as? XCUIElement else { return false }
            return !element.hasFocus
        }
        return XCTWaiter.wait(
            for: [XCTNSPredicateExpectation(predicate: predicate, object: element)],
            timeout: timeout
        ) == .completed
    }

    private func waitForSingleFocusAppearance(in app: XCUIApplication, timeout: TimeInterval = 5) -> Bool {
        let focusedAppearance = app.buttons.matching(NSPredicate(format: "hasFocus == true"))
        let predicate = NSPredicate { _, _ in focusedAppearance.count == 1 }
        return XCTWaiter.wait(
            for: [XCTNSPredicateExpectation(predicate: predicate, object: app)],
            timeout: timeout
        ) == .completed
    }

    private func attachScreenshot(named name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
