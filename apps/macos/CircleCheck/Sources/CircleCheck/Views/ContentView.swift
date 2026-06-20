import SwiftUI

struct ContentView: View {
    @State private var currentResult: CheckResult?
    @State private var isChecking = false

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "checkmark.shield.fill")
                    .foregroundStyle(.blue)
                    .font(.title3)
                Text("CircleCheck")
                    .font(.headline)
                Spacer()
                SettingsLink {
                    Image(systemName: "gear")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                Button {
                    NSApp.terminate(nil)
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(.regularMaterial)

            Divider()

            if let result = currentResult {
                ResultView(result: result) {
                    currentResult = nil
                }
            } else {
                CheckView(isChecking: $isChecking) { result in
                    currentResult = result
                }
            }
        }
    }
}
