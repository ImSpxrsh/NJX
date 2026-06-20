import SwiftUI

struct SettingsView: View {
    @AppStorage("serverURL") private var serverURL = "http://localhost:3000"
    @AppStorage("householdId") private var householdId = "00000000-0000-4000-8000-000000000001"
    @State private var connectionStatus: ConnectionStatus = .idle

    enum ConnectionStatus {
        case idle, testing, ok, failed(String)

        var label: String {
            switch self {
            case .idle: return ""
            case .testing: return "Testing…"
            case .ok: return "✓ Connected"
            case .failed(let msg): return "✗ \(msg)"
            }
        }

        var color: Color {
            switch self {
            case .ok: return .green
            case .failed: return .red
            default: return .secondary
            }
        }
    }

    var body: some View {
        Form {
            Section("Server") {
                TextField("Server URL", text: $serverURL)
                    .textFieldStyle(.roundedBorder)
                    .help("The URL of your running CircleCheck server, e.g. http://localhost:3000")

                HStack {
                    Button("Test connection") {
                        Task { await testConnection() }
                    }
                    .disabled(connectionStatus == .testing)

                    if case .testing = connectionStatus {
                        ProgressView().controlSize(.small)
                    }

                    if connectionStatus.label != "" {
                        Text(connectionStatus.label)
                            .font(.caption)
                            .foregroundStyle(connectionStatus.color)
                    }
                }
            }

            Section("Demo Settings") {
                TextField("Household ID", text: $householdId)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(.body, design: .monospaced))
                    .help("The demo household UUID (from DEMO_HOUSEHOLD_ID in your server's .env)")

                Text("Only needed for demo mode. Leave as default for local development.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .padding()
        .navigationTitle("CircleCheck Settings")
    }

    private func testConnection() async {
        connectionStatus = .testing
        // Ping the server with a minimal request
        let baseURL = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: baseURL) else {
            connectionStatus = .failed("Invalid URL")
            return
        }
        do {
            let (_, response) = try await URLSession.shared.data(from: url)
            if let http = response as? HTTPURLResponse, (200..<500).contains(http.statusCode) {
                connectionStatus = .ok
            } else {
                connectionStatus = .failed("Unexpected response")
            }
        } catch {
            connectionStatus = .failed(error.localizedDescription)
        }
    }
}

extension SettingsView.ConnectionStatus: Equatable {
    static func == (lhs: SettingsView.ConnectionStatus, rhs: SettingsView.ConnectionStatus) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle), (.testing, .testing), (.ok, .ok): return true
        case (.failed(let a), .failed(let b)): return a == b
        default: return false
        }
    }
}
