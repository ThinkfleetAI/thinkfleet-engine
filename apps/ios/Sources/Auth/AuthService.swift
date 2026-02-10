import Foundation
import os.log

private let authLogger = Logger(subsystem: "com.thinkfleet", category: "auth")

/// Cookie name used by Better Auth in production (https:// base URL enables __Secure- prefix).
private let sessionCookieName = "__Secure-better-auth.session_token"

actor AuthService {
    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
        authLogger.info("AuthService initialized with baseURL: \(baseURL.absoluteString)")
    }

    // MARK: - Email Auth

    struct SignInResponse: Codable {
        let session: SessionInfo?
        let user: AuthUser?
        let token: String?
    }

    struct SessionResponse: Codable {
        let session: SessionInfo?
        let user: AuthUser?
    }

    struct SessionInfo: Codable {
        let id: String
        let token: String
        let expiresAt: String?
    }

    func signInWithEmail(email: String, password: String) async throws -> (signedToken: String, rawToken: String, user: AuthUser) {
        let body: [String: String] = ["email": email, "password": password]
        let (data, response) = try await post(path: "/api/auth/sign-in/email", body: body)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.networkError
        }

        authLogger.info("Sign-in status: \(httpResponse.statusCode)")

        guard httpResponse.statusCode == 200 else {
            throw AuthError.invalidCredentials
        }

        let decoded = try JSONDecoder().decode(SignInResponse.self, from: data)
        // Signed token from Set-Cookie — needed for oRPC API calls (Better Auth HMAC-SHA-256 signed cookies)
        let signedToken = extractSessionToken(from: httpResponse)
        // Raw token from response body — needed for Socket.IO (direct DB lookup)
        let rawToken = decoded.token ?? decoded.session?.token
        authLogger.info("Sign-in signed=\(signedToken?.prefix(20) ?? "nil")... raw=\(rawToken?.prefix(12) ?? "nil")...")

        guard let signed = signedToken, let raw = rawToken, let user = decoded.user else {
            throw AuthError.invalidCredentials
        }

        return (signed, raw, user)
    }

    enum SignUpResult {
        case authenticated(signedToken: String, rawToken: String, user: AuthUser)
        case emailVerificationRequired
    }

    func signUpWithEmail(name: String, email: String, password: String) async throws -> SignUpResult {
        let body: [String: String] = ["name": name, "email": email, "password": password]
        let (data, response) = try await post(path: "/api/auth/sign-up/email", body: body)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.networkError
        }

        authLogger.info("Sign-up status: \(httpResponse.statusCode)")

        guard httpResponse.statusCode == 200 else {
            throw AuthError.signUpFailed
        }

        let decoded = try JSONDecoder().decode(SignInResponse.self, from: data)
        let signedToken = extractSessionToken(from: httpResponse)
        let rawToken = decoded.token ?? decoded.session?.token

        if let signed = signedToken, let raw = rawToken, let user = decoded.user {
            return .authenticated(signedToken: signed, rawToken: raw, user: user)
        }

        return .emailVerificationRequired
    }

    func forgotPassword(email: String) async throws {
        let body: [String: String] = ["email": email]
        _ = try await post(path: "/api/auth/forget-password", body: body)
    }

    // MARK: - Session Management

    func getSession(token: String) async throws -> (token: String, user: AuthUser)? {
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/auth/get-session"))
        request.setValue("\(sessionCookieName)=\(token)", forHTTPHeaderField: "Cookie")
        request.setValue(origin, forHTTPHeaderField: "Origin")

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            return nil
        }

        let decoded = try JSONDecoder().decode(SessionResponse.self, from: data)
        // If server sends a new signed token in Set-Cookie, use it; otherwise keep the existing one
        let newToken = extractSessionToken(from: httpResponse) ?? token

        guard let user = decoded.user else { return nil }
        return (newToken, user)
    }

    func signOut(token: String) async throws {
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/auth/sign-out"))
        request.httpMethod = "POST"
        request.setValue("\(sessionCookieName)=\(token)", forHTTPHeaderField: "Cookie")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(origin, forHTTPHeaderField: "Origin")
        _ = try await session.data(for: request)
    }

    // MARK: - Helpers

    private var origin: String {
        "\(baseURL.scheme ?? "https")://\(baseURL.host ?? "")"
    }

    private func post(path: String, body: [String: String]) async throws -> (Data, URLResponse) {
        let url = baseURL.appendingPathComponent(path)
        authLogger.debug("POST \(url.absoluteString)")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(origin, forHTTPHeaderField: "Origin")
        request.httpBody = try JSONEncoder().encode(body)
        return try await session.data(for: request)
    }

    /// Extract the signed session token from the Set-Cookie header.
    /// The cookie name in production is `__Secure-better-auth.session_token` (https:// enables __Secure- prefix).
    /// We match on `better-auth.session_token=` to handle both prefixed and unprefixed names.
    private func extractSessionToken(from response: HTTPURLResponse) -> String? {
        // HTTPURLResponse may merge multiple Set-Cookie headers; check allHeaderFields
        let allHeaders = response.allHeaderFields
        // Collect all Set-Cookie values
        var setCookieValues: [String] = []
        for (key, value) in allHeaders {
            if let keyStr = key as? String, keyStr.lowercased() == "set-cookie", let val = value as? String {
                setCookieValues.append(val)
            }
        }
        // Also check via the standard accessor (may return a merged string)
        if let single = response.value(forHTTPHeaderField: "Set-Cookie") {
            setCookieValues.append(single)
        }

        let joined = setCookieValues.joined(separator: ", ")
        let pattern = /better-auth\.session_token=([^;,]+)/
        guard let match = joined.firstMatch(of: pattern) else {
            authLogger.warning("No session token found in Set-Cookie headers")
            return nil
        }
        return String(match.1)
    }
}

enum AuthError: LocalizedError {
    case invalidCredentials
    case signUpFailed
    case networkError
    case sessionExpired
    case emailNotVerified

    var errorDescription: String? {
        switch self {
        case .invalidCredentials: "Invalid email or password."
        case .signUpFailed: "Could not create account."
        case .networkError: "Network error. Check your connection."
        case .sessionExpired: "Session expired. Please sign in again."
        case .emailNotVerified: "Please verify your email before signing in."
        }
    }
}
