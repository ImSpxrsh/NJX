import SwiftUI

struct CheckView: View {
    @Binding var isChecking: Bool
    let onResult: (CheckResult) -> Void

    @AppStorage("serverURL") private var serverURL = "http://localhost:3000"
    @AppStorage("householdId") private var householdId = "00000000-0000-4000-8000-000000000001"

    @State private var message = ""
    @State private var errorMessage: String?

    private var canSubmit: Bool {
        !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isChecking
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Label("Paste or type the suspicious message", systemImage: "doc.text")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                TextEditor(text: $message)
                    .font(.body)
                    .frame(minHeight: 140, maxHeight: 200)
                    .padding(8)
                    .background(Color(nsColor: .textBackgroundColor))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            if let error = errorMessage {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(10)
                .background(Color.red.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            HStack {
                Button {
                    message = "Mom it's me, I'm in trouble! I need you to buy $500 in gift cards RIGHT NOW. Don't tell anyone!"
                } label: {
                    Text("Load sample")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
                .foregroundStyle(.secondary)

                Spacer()

                Button {
                    Task { await runCheck() }
                } label: {
                    if isChecking {
                        HStack(spacing: 6) {
                            ProgressView()
                                .controlSize(.small)
                            Text("Checking…")
                        }
                    } else {
                        Text("Check this message")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canSubmit)
                .keyboardShortcut(.return, modifiers: .command)
            }

            Divider()

            HStack {
                Image(systemName: "info.circle")
                    .foregroundStyle(.secondary)
                    .font(.caption)
                Text("The message is analyzed but not stored.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
    }

    private func runCheck() async {
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        isChecking = true
        errorMessage = nil

        do {
            let response = try await APIClient.shared.analyze(
                message: trimmed,
                serverURL: serverURL,
                householdId: householdId
            )
            let result = CheckResult(
                id: response.checkId,
                response: response,
                analyzedAt: Date()
            )
            await MainActor.run {
                onResult(result)
                isChecking = false
            }
        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
                isChecking = false
            }
        }
    }
}
