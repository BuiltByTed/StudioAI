import XCTest

final class StudioAIUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    @MainActor
    func testSafariAuthenticationKeyboardAndNavigation() throws {
        addUIInterruptionMonitor(withDescription: "Safari password prompt") { alert in
            if alert.buttons["Not Now"].exists { alert.buttons["Not Now"].tap(); return true }
            return false
        }
        let safari = try launchSafari()
        try signIn(safari)
        try prepareCurrentBuild(safari)
        let menu = safari.buttons["Open navigation"]
        XCTAssertTrue(menu.waitForExistence(timeout: 30))
        let initialHeader = menu.frame
        let composer = safari.textViews["Message"]
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        composer.tap()
        XCTAssertTrue(safari.keyboards.firstMatch.waitForExistence(timeout: 10))
        XCTAssertGreaterThan(safari.keyboards.firstMatch.frame.height, 200, "A hardware-keyboard accessory bar is not a software-keyboard test.")
        if safari.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Speed up your typing'")).firstMatch.exists {
            safari.buttons["Continue"].tap()
        }
        let letter = safari.keyboards.firstMatch.keys.matching(NSPredicate(format: "label ==[c] 'a'")).firstMatch
        XCTAssertTrue(letter.waitForExistence(timeout: 10))
        XCTAssertTrue(letter.isHittable, "A visible software letter key is required.")
        letter.tap()
        let savedDraft = try XCTUnwrap(composer.value as? String)
        XCTAssertEqual(menu.frame.minY, initialHeader.minY, accuracy: 2)
        XCTAssertLessThanOrEqual(composer.frame.maxY, safari.keyboards.firstMatch.frame.minY + 2)
        attach("Safari keyboard open")
        // Scroll the actual primary page while keeping the composer focused.
        let start = safari.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.31))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: -90)))
        XCTAssertEqual(menu.frame.minY, initialHeader.minY, accuracy: 2)
        menu.tap()
        XCTAssertFalse(safari.buttons["Close menu"].exists)
        let notes = safari.links["Notes"]
        XCTAssertTrue(notes.waitForExistence(timeout: 10))
        notes.tap()
        XCTAssertTrue(safari.staticTexts["Notes"].firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(menu.waitForExistence(timeout: 10))
        attach("Safari notes")
        menu.tap()
        safari.links.matching(NSPredicate(format: "label BEGINSWITH 'New conversation'")).firstMatch.tap()
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        XCTAssertEqual(composer.value as? String, savedDraft)
        attach("Safari restored draft")
    }

    @MainActor
    func testInstallHomeScreenApp() throws {
        let safari = try launchSafari()
        try signIn(safari)
        try prepareCurrentBuild(safari)
        XCTAssertTrue(safari.buttons["Open navigation"].waitForExistence(timeout: 30))
        let pageMenu = safari.buttons["MoreMenuButton"]
        XCTAssertTrue(pageMenu.waitForExistence(timeout: 10))
        pageMenu.tap()
        attach("Safari page menu")
        let share = safari.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Share'")).firstMatch
        XCTAssertTrue(share.waitForExistence(timeout: 10))
        share.tap()
        attach("Safari share sheet")
        let hierarchy = XCTAttachment(string: safari.debugDescription); hierarchy.name = "Share sheet accessibility"; hierarchy.lifetime = .keepAlways; self.add(hierarchy)
        let add = safari.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS 'Add to Home Screen'")).firstMatch
        for _ in 0..<4 { if add.exists { break }; safari.swipeUp() }
        XCTAssertTrue(add.waitForExistence(timeout: 10))
        add.tap()
        let addButton = safari.buttons["Add"]
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: addButton)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 30), .completed)
        attach("Add Studio AI to Home Screen")
        addButton.tap()
        XCTAssertTrue(addButton.waitForNonExistence(timeout: 10))
        XCUIDevice.shared.press(.home)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let icon = springboard.icons["Studio AI"].firstMatch
        XCTAssertTrue(icon.waitForExistence(timeout: 10))
        for _ in 0..<5 { if icon.isHittable { break }; springboard.swipeLeft() }
        XCTAssertTrue(icon.isHittable)
        icon.tap()
        let web = XCUIApplication(bundleIdentifier: "com.apple.webapp")
        XCTAssertTrue(web.wait(for: .runningForeground, timeout: 15))
        try signIn(web)
        XCTAssertTrue(web.buttons["Open navigation"].waitForExistence(timeout: 30))
        attach("Studio AI Home Screen launch")
    }

    @MainActor
    func testHomeScreenKeyboardAndRestore() throws {
        let web = XCUIApplication(bundleIdentifier: "com.apple.webapp")
        web.activate()
        XCTAssertTrue(web.wait(for: .runningForeground, timeout: 15))
        try signIn(web)
        try prepareCurrentBuild(web)
        let menu = web.buttons["Open navigation"]
        XCTAssertTrue(menu.waitForExistence(timeout: 30))
        attach("Home Screen ready")
        let composer = web.textViews["Message"]
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        let initialHeader = menu.frame
        composer.tap()
        let letter = web.keyboards.firstMatch.keys.matching(NSPredicate(format: "label ==[c] 'a'")).firstMatch
        XCTAssertTrue(letter.waitForExistence(timeout: 10))
        XCTAssertTrue(letter.isHittable)
        letter.tap()
        XCTAssertEqual(menu.frame.minY, initialHeader.minY, accuracy: 2)
        XCTAssertLessThanOrEqual(composer.frame.maxY, web.keyboards.firstMatch.frame.minY + 2)
        attach("Home Screen keyboard open")
        let draft = composer.value as? String
        menu.tap()
        web.links["Notes"].tap()
        XCTAssertTrue(web.staticTexts["Notes"].firstMatch.waitForExistence(timeout: 10))
        attach("Home Screen notes")
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(menu.waitForExistence(timeout: 10))
        attach("Home Screen landscape")
        XCUIDevice.shared.orientation = .portrait
        menu.tap()
        web.links.matching(NSPredicate(format: "label BEGINSWITH 'New conversation'")).firstMatch.tap()
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        XCTAssertEqual(composer.value as? String, draft)
        web.terminate(); web.activate()
        XCTAssertTrue(web.buttons["Open navigation"].waitForExistence(timeout: 30))
        XCTAssertEqual(composer.value as? String, draft)
        attach("Home Screen cold restore")
    }

    @MainActor
    func testTabletKeyboardAndNavigation() throws {
        XCUIDevice.shared.orientation = .portrait
        let safari = try launchSafari()
        try signIn(safari)
        try prepareCurrentBuild(safari)
        let composer = safari.textViews["Message"]
        XCTAssertTrue(composer.waitForExistence(timeout: 20))
        composer.tap()
        let letter = safari.keyboards.firstMatch.keys.matching(NSPredicate(format: "label ==[c] 'a'")).firstMatch
        XCTAssertTrue(letter.waitForExistence(timeout: 10))
        letter.tap()
        XCTAssertLessThanOrEqual(composer.frame.maxY, safari.keyboards.firstMatch.frame.minY + 2)
        attach("iPad portrait keyboard")
        safari.buttons["Open navigation"].tap()
        safari.links["Notes"].tap()
        XCTAssertTrue(safari.staticTexts["Notes"].firstMatch.waitForExistence(timeout: 10))
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(safari.links["Notes"].waitForExistence(timeout: 10))
        attach("iPad landscape notes")
        safari.links.matching(NSPredicate(format: "label BEGINSWITH 'New conversation'")).firstMatch.tap()
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        composer.tap()
        XCTAssertTrue(letter.waitForExistence(timeout: 10))
        letter.tap()
        XCTAssertLessThanOrEqual(composer.frame.maxY, safari.keyboards.firstMatch.frame.minY + 2)
        attach("iPad landscape keyboard")
        XCUIDevice.shared.orientation = .portrait
    }

    @MainActor
    private func prepareCurrentBuild(_ app: XCUIApplication) throws {
        // Activate only from a route without an unsent composer. A retained draft
        // correctly defers an update, including in a separate installed context.
        let menu = app.buttons["Open navigation"]
        XCTAssertTrue(menu.waitForExistence(timeout: 30))
        if app.textViews["Message"].exists {
            menu.tap()
            app.links["Notes"].tap()
        }
        let update = app.buttons["Update when ready"]
        if update.waitForExistence(timeout: 20) {
            update.tap()
            XCTAssertTrue(update.waitForNonExistence(timeout: 20))
        }
        XCTAssertTrue(menu.waitForExistence(timeout: 30))
        if !app.textViews["Message"].exists {
            menu.tap()
            app.links.matching(NSPredicate(format: "label BEGINSWITH 'New conversation'")).firstMatch.tap()
        }
    }

    @MainActor
    private func launchSafari() throws -> XCUIApplication {
        let host = XCUIApplication()
        host.launchEnvironment["STUDIO_TEST_URL"] = ProcessInfo.processInfo.environment["STUDIO_TEST_URL"] ?? "http://127.0.0.1:5178/"
        host.launch()
        host.buttons["open-studio-ai"].tap()
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 15))
        return safari
    }

    @MainActor
    private func signIn(_ app: XCUIApplication) throws {
        let email = app.textFields["Email address"]
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            app.buttons["Open navigation"].exists || email.exists
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 30), .completed)
        if app.buttons["Open navigation"].exists { return }
        let path = try XCTUnwrap(ProcessInfo.processInfo.environment["STUDIO_TEST_ACCOUNT_FILE"])
        let account = try JSONDecoder().decode(Account.self, from: Data(contentsOf: URL(fileURLWithPath: path)))
        XCTAssertTrue(email.waitForExistence(timeout: 30))
        email.tap(); email.typeText(account.email)
        let password = app.secureTextFields["Password"]
        password.tap(); password.typeText(account.password)
        app.buttons["Sign in"].tap()
        let notNow = app.alerts.buttons["Not Now"]
        if notNow.waitForExistence(timeout: 3) { notNow.tap() }
    }
    @MainActor
    private func attach(_ name: String) {
        let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        image.name = name; image.lifetime = .keepAlways; add(image)
    }
    private struct Account: Decodable { let email: String; let password: String }
}
