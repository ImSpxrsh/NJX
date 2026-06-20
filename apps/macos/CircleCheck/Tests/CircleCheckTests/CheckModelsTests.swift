import XCTest
@testable import CircleCheck

final class CheckModelsTests: XCTestCase {

    func testRiskLevelOrdering() {
        XCTAssertLessThan(RiskLevel.l0, RiskLevel.l1)
        XCTAssertLessThan(RiskLevel.l1, RiskLevel.l2)
        XCTAssertLessThan(RiskLevel.l2, RiskLevel.l3)
    }

    func testRiskLevelDecoding() throws {
        let json = #"{"level": "L3", "verificationRequired": true, "reasons": [], "requiredAction": "MANDATORY_HOLD_AND_VERIFY", "policyScore": 0.9}"#
        let decision = try JSONDecoder().decode(PolicyDecision.self, from: Data(json.utf8))
        XCTAssertEqual(decision.level, .l3)
        XCTAssertTrue(decision.verificationRequired)
    }

    func testCheckStateUnknownFallback() throws {
        let json = #""UNKNOWN_FUTURE_STATE""#
        let state = try JSONDecoder().decode(CheckState.self, from: Data(json.utf8))
        XCTAssertEqual(state, .unknown)
    }

    func testAnalyzeResponseWithDemoUrl() throws {
        let json = #"""
        {
            "checkId": "abc123",
            "state": "PENDING",
            "extraction": {
                "plainLanguageSummary": "Test summary",
                "requestedAction": "Send gift cards",
                "uncertainty": false
            },
            "decision": {
                "level": "L3",
                "verificationRequired": true,
                "reasons": ["Urgency detected"],
                "requiredAction": "MANDATORY_HOLD_AND_VERIFY",
                "policyScore": 0.85
            },
            "demoContactUrl": "http://localhost:3000/verify/abc123token",
            "verification": {
                "requestId": "req-id",
                "expiresAt": "2024-06-20T12:00:00Z"
            }
        }
        """#
        let response = try JSONDecoder().decode(AnalyzeResponse.self, from: Data(json.utf8))
        XCTAssertEqual(response.checkId, "abc123")
        XCTAssertEqual(response.state, .pending)
        XCTAssertEqual(response.decision.level, .l3)
        XCTAssertNotNil(response.demoContactUrl)
        XCTAssertEqual(response.demoContactUrl, "http://localhost:3000/verify/abc123token")
    }

    func testAnalyzeResponseWithoutDemoUrl() throws {
        let json = #"""
        {
            "checkId": "xyz789",
            "state": "PAUSED",
            "extraction": {
                "plainLanguageSummary": "No issues detected",
                "requestedAction": null,
                "uncertainty": false
            },
            "decision": {
                "level": "L0",
                "verificationRequired": false,
                "reasons": [],
                "requiredAction": "NONE",
                "policyScore": 0.1
            }
        }
        """#
        let response = try JSONDecoder().decode(AnalyzeResponse.self, from: Data(json.utf8))
        XCTAssertNil(response.demoContactUrl)
        XCTAssertNil(response.verification)
    }

    func testL3InstructionMentionsStop() {
        XCTAssertTrue(RiskLevel.l3.instruction.lowercased().contains("do not act"))
    }

    func testAllRiskLevelsHaveInstructions() {
        for level in [RiskLevel.l0, .l1, .l2, .l3] {
            XCTAssertFalse(level.instruction.isEmpty)
            XCTAssertFalse(level.displayName.isEmpty)
        }
    }
}
