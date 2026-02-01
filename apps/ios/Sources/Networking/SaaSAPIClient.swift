import Foundation

actor SaaSAPIClient {
    let baseURL: URL
    private let session: URLSession
    private let sessionStore: SessionStore

    init(baseURL: URL, sessionStore: SessionStore, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.sessionStore = sessionStore
        self.session = session
    }

    // MARK: - oRPC Calls

    func rpc<T: Decodable>(_ path: String, input: Encodable? = nil) async throws -> T {
        let url = baseURL.appendingPathComponent("/api/rpc/\(path)")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        applyAuth(to: &request)

        if let input {
            request.httpBody = try JSONEncoder().encode(input)
        } else {
            request.httpBody = Data("{}".utf8)
        }

        let (data, response) = try await session.data(for: request)

        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 401 {
            let refreshed = await refreshSession()
            if refreshed {
                applyAuth(to: &request)
                let (retryData, retryResponse) = try await session.data(for: request)
                guard let retryHttp = retryResponse as? HTTPURLResponse, retryHttp.statusCode == 200 else {
                    throw APIError.requestFailed(statusCode: (retryResponse as? HTTPURLResponse)?.statusCode ?? 0)
                }
                return try JSONDecoder().decode(T.self, from: retryData)
            }
            await MainActor.run { sessionStore.clearSession() }
            throw APIError.unauthorized
        }

        guard let httpResponse = response as? HTTPURLResponse, (200 ..< 300).contains(httpResponse.statusCode) else {
            throw APIError.requestFailed(statusCode: (response as? HTTPURLResponse)?.statusCode ?? 0)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    // MARK: - Generic REST

    func get<T: Decodable>(path: String) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        applyAuth(to: &request)
        let (data, _) = try await session.data(for: request)
        return try JSONDecoder().decode(T.self, from: data)
    }

    // MARK: - Helpers

    private func applyAuth(to request: inout URLRequest) {
        if let token = sessionStore.sessionToken {
            request.setValue("better-auth.session_token=\(token)", forHTTPHeaderField: "Cookie")
        }
        if let orgId = sessionStore.currentOrganizationId {
            request.setValue(orgId, forHTTPHeaderField: "x-organization-id")
        }
    }

    private func refreshSession() async -> Bool {
        guard let token = sessionStore.sessionToken else { return false }
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/auth/session"))
        request.setValue("better-auth.session_token=\(token)", forHTTPHeaderField: "Cookie")

        guard let (_, response) = try? await session.data(for: request),
              let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200
        else { return false }

        if let setCookie = httpResponse.value(forHTTPHeaderField: "Set-Cookie"),
           let match = setCookie.firstMatch(of: /better-auth\.session_token=([^;]+)/)
        {
            let newToken = String(match.1)
            await MainActor.run { sessionStore.setSession(token: newToken, user: sessionStore.currentUser!) }
        }
        return true
    }
}

enum APIError: LocalizedError {
    case unauthorized
    case requestFailed(statusCode: Int)
    case decodingFailed

    var errorDescription: String? {
        switch self {
        case .unauthorized: "Authentication required."
        case let .requestFailed(code): "Request failed with status \(code)."
        case .decodingFailed: "Failed to parse response."
        }
    }
}
