import XCTest

/// Real Safari / Home Screen tests, using a staging-only deterministic thread.
/// No production records or actual inference are changed by these gestures.
final class StudioAIUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    @MainActor
    func testOriginalSafariKeyboardScrolling() throws {
        XCUIDevice.shared.orientation = .portrait
        let host = XCUIApplication()
        host.launchEnvironment["STUDIO_TEST_URL"] = try XCTUnwrap(ProcessInfo.processInfo.environment["STUDIO_TEST_URL"])
        host.launch()
        host.buttons["open-studio-ai"].tap()
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 15))
        try signIn(safari)
        try verifyKeyboardScrolling(safari)
    }

    @MainActor
    func testInstallAndScrollHomeScreenApp() throws {
        XCUIDevice.shared.orientation = .portrait
        let host = XCUIApplication()
        host.launchEnvironment["STUDIO_TEST_URL"] = try XCTUnwrap(ProcessInfo.processInfo.environment["STUDIO_TEST_URL"])
        host.launch(); host.buttons["open-studio-ai"].tap()
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 15))
        try signIn(safari)
        XCTAssertTrue(safari.buttons["Open Sidebar"].firstMatch.waitForExistence(timeout: 30))
        safari.buttons["MoreMenuButton"].tap()
        safari.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Share'")).firstMatch.tap()
        let add = safari.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS 'Add to Home Screen'")).firstMatch
        for _ in 0..<4 { if add.exists { break }; safari.swipeUp() }
        XCTAssertTrue(add.waitForExistence(timeout: 10)); add.tap()
        let addButton = safari.buttons["Add"]
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: addButton)], timeout: 30), .completed)
        attach("Original Home Screen installation metadata")
        // Give only this disposable QA shortcut a distinct label. The actual
        // manifest and splash are generated unchanged by Homeframe.
        let name = safari.otherElements["AddToHomeScreenView"].textFields.firstMatch
        XCTAssertTrue(name.waitForExistence(timeout: 10))
        let originalName = name.value as? String ?? ""
        XCTAssertEqual(originalName, "Studio AI")
        name.tap(); name.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: originalName.count))
        name.typeText("Studio AI QA Original")
        addButton.tap()
        XCTAssertTrue(addButton.waitForNonExistence(timeout: 10))
        XCUIDevice.shared.press(.home)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let icon = springboard.icons["Studio AI QA Original"].firstMatch
        XCTAssertTrue(icon.waitForExistence(timeout: 10))
        for _ in 0..<5 { if icon.isHittable { break }; springboard.swipeLeft() }
        icon.tap()
        let web = XCUIApplication(bundleIdentifier: "com.apple.webapp")
        XCTAssertTrue(web.wait(for: .runningForeground, timeout: 15))
        try signIn(web)
        let menu = web.buttons["Open Sidebar"].firstMatch
        XCTAssertTrue(menu.waitForExistence(timeout: 30))
        attach("Original installed launch")
        menu.tap()
        let fixture = web.links.matching(NSPredicate(format: "label CONTAINS 'QA original UI keyboard scrolling'")).firstMatch
        XCTAssertTrue(fixture.waitForExistence(timeout: 10)); fixture.tap()
        try verifyKeyboardScrolling(web)
        XCUIDevice.shared.orientation = .landscapeLeft
        attach("Original installed landscape notes")
        XCUIDevice.shared.orientation = .portrait
        web.terminate(); icon.tap()
        XCTAssertTrue(menu.waitForExistence(timeout: 30))
        attach("Original installed cold relaunch")
    }

    @MainActor
    func testInstalledKeyboardScrolling() throws {
        XCUIDevice.shared.orientation = .portrait
        let web = XCUIApplication(bundleIdentifier: "com.apple.webapp")
        web.activate()
        XCTAssertTrue(web.wait(for: .runningForeground, timeout: 15))
        try signIn(web)
        let menu = web.buttons["Open Sidebar"].firstMatch
        XCTAssertTrue(menu.waitForExistence(timeout: 30))
        menu.tap()
        let fixture = web.links.matching(NSPredicate(format: "label CONTAINS 'QA original UI keyboard scrolling'")).firstMatch
        XCTAssertTrue(fixture.waitForExistence(timeout: 10)); fixture.tap()
        try verifyKeyboardScrolling(web)
        XCUIDevice.shared.orientation = .landscapeLeft
        attach("Original installed landscape notes")
        XCUIDevice.shared.orientation = .portrait
        web.terminate(); web.activate()
        XCTAssertTrue(menu.waitForExistence(timeout: 30))
        attach("Original installed cold relaunch")
    }

    @MainActor
    private func verifyKeyboardScrolling(_ app: XCUIApplication) throws {
        let menu = app.buttons["Open Sidebar"].firstMatch
        let composer = app.textViews.matching(NSPredicate(format: "label == 'Send a Message' OR identifier == 'chat-input' OR label == 'How can I help you today?'")).firstMatch
        guard composer.waitForExistence(timeout: 45) else {
            attach("Original UI missing composer")
            let tree = XCTAttachment(string: app.debugDescription)
            tree.name = "Original UI accessibility"; tree.lifetime = .keepAlways; add(tree)
            XCTFail("Original composer did not appear")
            return
        }
        XCTAssertTrue(menu.waitForExistence(timeout: 10))
        let initialHeader = menu.frame
        attach("Original conversation before keyboard")
        composer.tap()
        let keyboards = [app.keyboards.firstMatch, XCUIApplication(bundleIdentifier: "com.apple.springboard").keyboards.firstMatch]
        let keyboardReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in keyboards.contains { $0.exists } }, object: nil)
        let result = XCTWaiter.wait(for: [keyboardReady], timeout: 20)
        if result != .completed { attach("Keyboard accessibility lookup failure") }
        XCTAssertEqual(result, .completed)
        let keyboard = try XCTUnwrap(keyboards.first { $0.exists })
        XCTAssertGreaterThan(keyboard.frame.height, 200, "Must exercise a real software keyboard")
        if app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Speed up your typing'")).firstMatch.exists {
            app.buttons["Continue"].tap()
        }
        let letter = keyboard.keys.matching(NSPredicate(format: "label ==[c] 'a'")).firstMatch
        XCTAssertTrue(letter.waitForExistence(timeout: 10))
        letter.tap()
        let draft = composer.value as? String
        assertGeometry(menu, composer, keyboard, initialHeader)
        attach("Original keyboard open")

        // Exercise both directions repeatedly, with pauses to expose snapback
        // after the finger lifts. Coordinates derive from actual chrome bounds.
        for (index, direction) in [1, 1, 1, -1, -1, -1, 1, -1, 1, -1].enumerated() {
            let top = menu.frame.maxY + 20
            // First exercise the thread, then the floating dock controls.
            let bottom = composer.frame.minY - (index < 6 ? 80 : 20)
            XCTAssertGreaterThan(bottom - top, 60, "A usable thread must remain above the keyboard")
            let x = app.frame.midX
            let startY = direction > 0 ? top + 10 : bottom - 10
            let endY = direction > 0 ? bottom - 10 : top + 10
            let origin = app.coordinate(withNormalizedOffset: .zero)
            origin.withOffset(CGVector(dx: x, dy: startY)).press(
                forDuration: 0.06,
                thenDragTo: origin.withOffset(CGVector(dx: x, dy: endY)),
                withVelocity: .slow,
                thenHoldForDuration: 0.05
            )
            XCTAssertTrue(keyboard.exists, "Scrolling must preserve keyboard focus")
            assertGeometry(menu, composer, keyboard, initialHeader)
            let settled = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
                abs(menu.frame.minY - initialHeader.minY) <= 2
                    && composer.frame.maxY <= keyboard.frame.minY + 2
            }, object: nil)
            XCTAssertEqual(XCTWaiter.wait(for: [settled], timeout: 2), .completed)
            attach("Original keyboard scroll \(direction)")
        }
        XCTAssertEqual(composer.value as? String, draft, "Scrolling must preserve the draft")
        menu.tap()
        XCTAssertFalse(app.buttons["Close menu"].exists)
        XCTAssertFalse(app.buttons["Close Sidebar"].exists, "No close button inside the mobile sidebar")
        let notes = app.links["Notes"].firstMatch
        XCTAssertTrue(notes.waitForExistence(timeout: 10))
        notes.tap()
        XCTAssertTrue(app.staticTexts["Notes"].firstMatch.waitForExistence(timeout: 10))
        attach("Original notes after keyboard")
    }

    @MainActor
    private func assertGeometry(_ menu: XCUIElement, _ composer: XCUIElement, _ keyboard: XCUIElement, _ initialHeader: CGRect) {
        XCTAssertEqual(menu.frame.minY, initialHeader.minY, accuracy: 2, "Header moved with keyboard or thread scroll")
        XCTAssertGreaterThan(composer.frame.height, 20, "Clipped / offscreen accessibility frames must not count as visible")
        XCTAssertTrue(composer.isHittable, "Composer must remain usable after scrolling")
        XCTAssertLessThanOrEqual(composer.frame.maxY, keyboard.frame.minY + 2, "Composer is hidden by the keyboard")
    }

    @MainActor
    private func signIn(_ app: XCUIApplication) throws {
        let email = app.textFields.matching(NSPredicate(format: "label == 'Email' OR label == 'Email address' OR placeholderValue == 'Enter Your Email'")).firstMatch
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            app.buttons["Open Sidebar"].exists || app.buttons["Open navigation"].exists || email.exists
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 40), .completed)
        if !email.exists { return }
        let path = try XCTUnwrap(ProcessInfo.processInfo.environment["STUDIO_TEST_ACCOUNT_FILE"])
        let account = try JSONDecoder().decode(Account.self, from: Data(contentsOf: URL(fileURLWithPath: path)))
        email.tap(); email.typeText(account.email)
        let password = app.secureTextFields.firstMatch
        password.tap(); password.typeText(account.password)
        app.buttons.matching(NSPredicate(format: "label ==[c] 'Sign in'")).firstMatch.tap()
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
