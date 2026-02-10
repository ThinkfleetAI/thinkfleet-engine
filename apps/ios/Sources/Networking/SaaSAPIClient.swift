import Foundation
import os.log

private let rpcLogger = Logger(subsystem: "com.thinkfleet", category: "rpc")

actor SaaSAPIClient {
    let baseURL: URL
    private let session: URLSession
    private let sessionStore: SessionStore

    init(baseURL: URL, sessionStore: SessionStore, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.sessionStore = sessionStore
        self.session = session
    }

    // MARK: - oRPC Protocol Envelope
    // oRPC RPC protocol wraps requests as {"json": <input>} and responses as {"json": <output>}

    private struct RPCRequest<T: Encodable>: Encodable { let json: T }
    private struct RPCResponse<T: Decodable>: Decodable { let json: T }
    private struct EmptyInput: Encodable {}

    // MARK: - oRPC Calls

    func rpc<T: Decodable>(_ path: String, input: Encodable? = nil) async throws -> T {
        let rpcPath = path.replacingOccurrences(of: ".", with: "/")
        let url = baseURL.appendingPathComponent("/api/rpc/\(rpcPath)")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        applyAuth(to: &request)

        if let input {
            request.httpBody = try encodeRPCInput(input)
        } else {
            request.httpBody = try JSONEncoder().encode(RPCRequest(json: EmptyInput()))
        }

        let (data, response) = try await session.data(for: request)

        if let httpResponse = response as? HTTPURLResponse {
            let bodyPreview = String(data: data.prefix(500), encoding: .utf8) ?? "non-utf8"
            rpcLogger.info("RPC \(rpcPath) → \(httpResponse.statusCode): \(bodyPreview)")
        }

        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 401 {
            let refreshed = await refreshSession()
            if refreshed {
                applyAuth(to: &request)
                let (retryData, retryResponse) = try await session.data(for: request)
                guard let retryHttp = retryResponse as? HTTPURLResponse, retryHttp.statusCode == 200 else {
                    throw APIError.requestFailed(statusCode: (retryResponse as? HTTPURLResponse)?.statusCode ?? 0)
                }
                return try decodeRPCResponse(retryData)
            }
            // Don't clear session here — the token may still be valid (server propagation delay).
            // The caller (e.g. loadOrganizations) can retry, and signOut handles clearing.
            throw APIError.unauthorized
        }

        guard let httpResponse = response as? HTTPURLResponse, (200 ..< 300).contains(httpResponse.statusCode) else {
            throw APIError.requestFailed(statusCode: (response as? HTTPURLResponse)?.statusCode ?? 0)
        }

        return try decodeRPCResponse(data)
    }

    /// Wrap input in oRPC envelope: {"json": <input>}
    private func encodeRPCInput(_ input: Encodable) throws -> Data {
        let inputData = try JSONEncoder().encode(input)
        let inputJson = try JSONSerialization.jsonObject(with: inputData)
        let wrapped: [String: Any] = ["json": inputJson]
        return try JSONSerialization.data(withJSONObject: wrapped)
    }

    /// Unwrap oRPC response envelope: {"json": <data>} → <data>
    private func decodeRPCResponse<T: Decodable>(_ data: Data) throws -> T {
        return try JSONDecoder().decode(RPCResponse<T>.self, from: data).json
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

    /// Cookie name used by Better Auth in production (https:// base URL enables __Secure- prefix).
    private static let sessionCookieName = "__Secure-better-auth.session_token"

    private func applyAuth(to request: inout URLRequest) {
        if let token = sessionStore.sessionToken {
            let cookie = "\(Self.sessionCookieName)=\(token)"
            let urlPath = request.url?.lastPathComponent ?? "?"
            rpcLogger.info("applyAuth: Cookie=\(cookie.prefix(50))... to \(urlPath)")
            request.setValue(cookie, forHTTPHeaderField: "Cookie")
        } else {
            rpcLogger.warning("applyAuth: no session token!")
        }
        // Origin header required by Better Auth for CSRF validation on POST requests
        let origin = "\(baseURL.scheme ?? "https")://\(baseURL.host ?? "")"
        request.setValue(origin, forHTTPHeaderField: "Origin")
        if let orgId = sessionStore.currentOrganizationId {
            request.setValue(orgId, forHTTPHeaderField: "x-organization-id")
        }
    }

    private func refreshSession() async -> Bool {
        guard let token = sessionStore.sessionToken else { return false }
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/auth/get-session"))
        request.setValue("\(Self.sessionCookieName)=\(token)", forHTTPHeaderField: "Cookie")
        request.setValue("\(baseURL.scheme ?? "https")://\(baseURL.host ?? "")", forHTTPHeaderField: "Origin")

        guard let (_, response) = try? await session.data(for: request),
              let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200
        else { return false }

        // If server sends a refreshed signed token in Set-Cookie, update the stored token
        if let newSignedToken = Self.extractSessionToken(from: httpResponse) {
            await MainActor.run { sessionStore.setSession(token: newSignedToken, user: sessionStore.currentUser!) }
        }
        return true
    }

    /// Extract the signed session token from the Set-Cookie header.
    private static func extractSessionToken(from response: HTTPURLResponse) -> String? {
        guard let setCookie = response.value(forHTTPHeaderField: "Set-Cookie") else { return nil }
        let pattern = /better-auth\.session_token=([^;,]+)/
        guard let match = setCookie.firstMatch(of: pattern) else { return nil }
        return String(match.1)
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
