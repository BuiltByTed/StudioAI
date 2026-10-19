import SwiftUI

@main
struct StudioAITestHostApp: App {
    @Environment(\.openURL) private var openURL
    var body: some Scene {
        WindowGroup {
            Button("Open Studio AI in Safari") {
                if let url = URL(string: ProcessInfo.processInfo.environment["STUDIO_TEST_URL"] ?? "http://127.0.0.1:5178/") {
                    openURL(url)
                }
            }.accessibilityIdentifier("open-studio-ai")
        }
    }
}
