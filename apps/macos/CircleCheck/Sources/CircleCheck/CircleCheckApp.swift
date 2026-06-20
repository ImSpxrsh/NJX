import SwiftUI

@main
struct CircleCheckApp: App {
    @AppStorage("serverURL") private var serverURL = "http://localhost:3000"

    var body: some Scene {
        MenuBarExtra {
            ContentView()
                .frame(width: 400, height: 500)
        } label: {
            Label("CircleCheck", systemImage: "checkmark.shield")
        }
        .menuBarExtraStyle(.window)

        Settings {
            SettingsView()
                .frame(width: 360, height: 220)
        }
    }
}
