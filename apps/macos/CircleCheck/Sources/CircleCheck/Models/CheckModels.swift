import Foundation

// MARK: - API request

struct AnalyzeRequest: Encodable {
    let householdId: String
    let message: String
    let mode: String = "fixture"
}

// MARK: - API response models

struct AnalyzeResponse: Decodable {
    let checkId: String
    let state: CheckState
    let extraction: EvidenceExtraction
    let decision: PolicyDecision
    let demoContactUrl: String?
    let verification: VerificationMetadata?

    struct VerificationMetadata: Decodable {
        let requestId: String
        let expiresAt: String
    }
}

enum CheckState: String, Decodable, CaseIterable {
    case received = "RECEIVED"
    case paused = "PAUSED"
    case pending = "PENDING"
    case verified = "VERIFIED"
    case denied = "DENIED"
    case expired = "EXPIRED"
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = CheckState(rawValue: raw) ?? .unknown
    }
}

struct EvidenceExtraction: Decodable {
    let plainLanguageSummary: String
    let requestedAction: String?
    let uncertainty: Bool
}

struct PolicyDecision: Decodable {
    let level: RiskLevel
    let verificationRequired: Bool
    let reasons: [String]
    let requiredAction: RequiredAction
    let policyScore: Double
}

enum RiskLevel: String, Decodable, Comparable {
    case l0 = "L0"
    case l1 = "L1"
    case l2 = "L2"
    case l3 = "L3"

    static func < (lhs: RiskLevel, rhs: RiskLevel) -> Bool {
        let order: [RiskLevel] = [.l0, .l1, .l2, .l3]
        return (order.firstIndex(of: lhs) ?? 0) < (order.firstIndex(of: rhs) ?? 0)
    }

    var displayName: String {
        switch self {
        case .l0: return "L0 — Low concern"
        case .l1: return "L1 — Callback advised"
        case .l2: return "L2 — Verify before acting"
        case .l3: return "L3 — Stop and verify"
        }
    }

    var color: (red: Double, green: Double, blue: Double) {
        switch self {
        case .l0: return (0.07, 0.53, 0.35)
        case .l1: return (0.76, 0.49, 0.0)
        case .l2: return (0.86, 0.37, 0.05)
        case .l3: return (0.75, 0.11, 0.11)
        }
    }

    var instruction: String {
        switch self {
        case .l0: return "No warning signs identified. You can continue as normal."
        case .l1: return "If unsure, call back using a number you already know — not one from this message."
        case .l2: return "Stop. Contact your trusted person through a separate channel before acting."
        case .l3: return "Do not act on this request. Contact your trusted person using a number you already know."
        }
    }
}

enum RequiredAction: String, Decodable {
    case none = "NONE"
    case knownNumberCallback = "KNOWN_NUMBER_CALLBACK"
    case trustedContactConfirmation = "TRUSTED_CONTACT_CONFIRMATION"
    case mandatoryHoldAndVerify = "MANDATORY_HOLD_AND_VERIFY"
}

// MARK: - Check result wrapping analysis + response

struct CheckResult: Identifiable {
    let id: String
    let response: AnalyzeResponse
    let analyzedAt: Date

    var riskLevel: RiskLevel { response.decision.level }
    var summary: String { response.extraction.plainLanguageSummary }
    var reasons: [String] { response.decision.reasons }
    var demoContactUrl: URL? { response.demoContactUrl.flatMap { URL(string: $0) } }
}
