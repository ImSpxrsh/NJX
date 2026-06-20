import Foundation

enum APIError: LocalizedError {
    case invalidURL(String)
    case networkError(Error)
    case serverError(Int, String?)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL(let url): return "Invalid server URL: \(url)"
        case .networkError(let e): return "Network error: \(e.localizedDescription)"
        case .serverError(let code, let msg): return "Server error \(code): \(msg ?? "unknown")"
        case .decodingError(let e): return "Unexpected response format: \(e.localizedDescription)"
        }
    }
}

actor APIClient {
    static let shared = APIClient()
    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        self.session = URLSession(configuration: config)
    }

    func analyze(
        message: String,
        serverURL: String,
        householdId: String
    ) async throws -> AnalyzeResponse {
        let baseURL = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        guard let url = URL(string: "\(baseURL)/api/analyze") else {
            throw APIError.invalidURL(baseURL)
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")

        let body = AnalyzeRequest(householdId: householdId, message: message)
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }

        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            let body = String(data: data, encoding: .utf8)
            throw APIError.serverError(http.statusCode, body)
        }

        do {
            let decoder = JSONDecoder()
            return try decoder.decode(AnalyzeResponse.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }
}
