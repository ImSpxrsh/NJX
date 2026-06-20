import SwiftUI

struct ResultView: View {
    let result: CheckResult
    let onReset: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Risk level badge
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Risk Assessment")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .textCase(.uppercase)
                        Text(result.riskLevel.displayName)
                            .font(.title3.bold())
                            .foregroundColor(Color(
                                red: result.riskLevel.color.red,
                                green: result.riskLevel.color.green,
                                blue: result.riskLevel.color.blue
                            ))
                    }
                    Spacer()
                    RiskIndicator(level: result.riskLevel)
                }
                .padding(14)
                .background(Color(
                    red: result.riskLevel.color.red,
                    green: result.riskLevel.color.green,
                    blue: result.riskLevel.color.blue
                ).opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color(
                            red: result.riskLevel.color.red,
                            green: result.riskLevel.color.green,
                            blue: result.riskLevel.color.blue
                        ).opacity(0.4), lineWidth: 1.5)
                )

                // Instruction
                VStack(alignment: .leading, spacing: 6) {
                    Label("What to do", systemImage: "arrow.right.circle.fill")
                        .font(.subheadline.bold())
                    Text(result.riskLevel.instruction)
                        .font(.body)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(12)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 8))

                // Summary from extraction
                if !result.summary.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Analysis", systemImage: "text.magnifyingglass")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        Text(result.summary)
                            .font(.caption)
                            .foregroundStyle(.primary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                // Reasons
                if !result.reasons.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Signals detected", systemImage: "list.bullet")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        ForEach(result.reasons, id: \.self) { reason in
                            HStack(alignment: .top, spacing: 6) {
                                Image(systemName: "exclamationmark.circle.fill")
                                    .foregroundStyle(.orange)
                                    .font(.caption)
                                    .padding(.top, 1)
                                Text(reason)
                                    .font(.caption)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }

                // Demo contact URL (only in demo mode)
                if let contactURL = result.demoContactUrl {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Demo: Trusted contact link", systemImage: "link")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        Link(destination: contactURL) {
                            Text(contactURL.absoluteString)
                                .font(.caption)
                                .lineLimit(2)
                                .truncationMode(.middle)
                        }
                        Text("Demo mode only — this link would normally be sent to your trusted contact.")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .italic()
                    }
                    .padding(10)
                    .background(Color.yellow.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.yellow.opacity(0.4), lineWidth: 1))
                }

                // Check another
                HStack {
                    Text("Reference: \(result.id.prefix(8))…")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                    Spacer()
                    Button("Check another") {
                        onReset()
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                }
            }
            .padding(16)
        }
    }
}

struct RiskIndicator: View {
    let level: RiskLevel

    private var fillCount: Int {
        switch level {
        case .l0: return 1
        case .l1: return 2
        case .l2: return 3
        case .l3: return 4
        }
    }

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<4) { index in
                RoundedRectangle(cornerRadius: 2)
                    .frame(width: 8, height: 20 + CGFloat(index) * 4)
                    .foregroundColor(
                        index < fillCount
                        ? Color(red: level.color.red, green: level.color.green, blue: level.color.blue)
                        : Color(nsColor: .separatorColor)
                    )
            }
        }
        .accessibilityLabel("\(level.displayName) indicator")
    }
}
