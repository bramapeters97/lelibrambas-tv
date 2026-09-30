import XCTest

final class MobileFlowTests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    @MainActor
    func testNavigationSearchProfilesAndTabState() {
        let app = launch()
        app.buttons["profile-bart-astrid"].tap()
        XCTAssertTrue(app.staticTexts["The Lantern Archive"].firstMatch.waitForExistence(timeout: 10))
        attach(app, name: "Home")

        app.tabBars.buttons["Search"].tap()
        let search = app.searchFields.firstMatch
        XCTAssertTrue(search.waitForExistence(timeout: 5))
        search.tap()
        search.typeText("North Sea")
        // Query the native NavigationLink button; SwiftUI may attach the test
        // identifier to its enclosing accessibility container.
        let result = app.buttons["North Sea Summer, 2004"]
        XCTAssertTrue(result.waitForExistence(timeout: 5))
        result.tap()
        XCTAssertTrue(app.staticTexts["details-title"].waitForExistence(timeout: 5))
        attach(app, name: "Details")

        app.tabBars.buttons["Collections"].tap()
        XCTAssertTrue(app.navigationBars["Collections"].waitForExistence(timeout: 5))
        app.tabBars.buttons["Search"].tap()
        XCTAssertTrue(app.staticTexts["details-title"].waitForExistence(timeout: 5))
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(search.waitForExistence(timeout: 5))
        XCTAssertEqual(search.value as? String, "North Sea")

        app.tabBars.buttons["Profile"].tap()
        app.buttons["profile-bram-edvin"].tap()
        XCTAssertTrue(app.tabBars.buttons["Home"].isSelected)
        app.tabBars.buttons["Search"].tap()
        XCTAssertFalse(app.staticTexts["details-title"].exists)
    }

    @MainActor
    func testAccessibilityTextAndLandscapeRemainNavigable() {
        let app = launch(extra: ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"])
        app.buttons["profile-bart-astrid"].tap()
        XCTAssertTrue(app.tabBars.buttons["Search"].waitForExistence(timeout: 10))
        attach(app, name: "Home-accessibility-text")
        XCUIDevice.shared.orientation = .landscapeLeft
        app.tabBars.buttons["Collections"].tap()
        XCTAssertTrue(app.navigationBars["Collections"].waitForExistence(timeout: 5))
        attach(app, name: "Collections-landscape")
        XCUIDevice.shared.orientation = .portrait
    }

    @MainActor
    private func launch(extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-LBFixtureMode"] + extra
        app.launch()
        XCTAssertTrue(app.buttons["profile-bart-astrid"].waitForExistence(timeout: 10))
        return app
    }

    @MainActor
    private func attach(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
