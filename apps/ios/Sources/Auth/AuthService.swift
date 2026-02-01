import Foundation
import os.log

private let authLogger = Logger(subsystem: "com.thinkfleet", category: "auth")

actor AuthService {
    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
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

    func signInWithEmail(email: String, password: String) async throws -> (token: String, user: AuthUser) {
        let body: [String: String] = ["email": email, "password": password]
        let (data, response) = try await post(path: "/api/auth/sign-in/email", body: body)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.networkError
        }

        authLogger.info("Sign-in status: \(httpResponse.statusCode), body: \(String(data: data, encoding: .utf8) ?? "nil")")

        guard httpResponse.statusCode == 200 else {
            throw AuthError.invalidCredentials
        }

        // Extract session token from Set-Cookie header or response body
        let cookieToken = extractSessionToken(from: httpResponse)

        let decoded = try JSONDecoder().decode(SignInResponse.self, from: data)
        let finalToken = cookieToken ?? decoded.session?.token ?? decoded.token

        guard let sessionToken = finalToken, let user = decoded.user else {
            throw AuthError.invalidCredentials
        }

        return (sessionToken, user)
    }

    enum SignUpResult {
        case authenticated(token: String, user: AuthUser)
        case emailVerificationRequired
    }

    func signUpWithEmail(name: String, email: String, password: String) async throws -> SignUpResult {
        let body: [String: String] = ["name": name, "email": email, "password": password]
        let (data, response) = try await post(path: "/api/auth/sign-up/email", body: body)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.networkError
        }

        authLogger.info("Sign-up status: \(httpResponse.statusCode), body: \(String(data: data, encoding: .utf8) ?? "nil")")

        guard httpResponse.statusCode == 200 else {
            throw AuthError.signUpFailed
        }

        let cookieToken = extractSessionToken(from: httpResponse)
        let decoded = try JSONDecoder().decode(SignInResponse.self, from: data)
        let finalToken = cookieToken ?? decoded.session?.token ?? decoded.token

        if let sessionToken = finalToken, let user = decoded.user {
            return .authenticated(token: sessionToken, user: user)
        }

        return .emailVerificationRequired
    }

    func forgotPassword(email: String) async throws {
        let body: [String: String] = ["email": email]
        _ = try await post(path: "/api/auth/forget-password", body: body)
    }

    // MARK: - Session Management

    func getSession(token: String) async throws -> (token: String, user: AuthUser)? {
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/auth/session"))
        request.setValue("better-auth.session_token=\(token)", forHTTPHeaderField: "Cookie")

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            return nil
        }

        let newToken = extractSessionToken(from: httpResponse) ?? token
        let decoded = try JSONDecoder().decode(SessionResponse.self, from: data)

        guard let user = decoded.user else { return nil }
        return (newToken, user)
    }

    func signOut(token: String) async throws {
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/auth/sign-out"))
        request.httpMethod = "POST"
        request.setValue("better-auth.session_token=\(token)", forHTTPHeaderField: "Cookie")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        _ = try await session.data(for: request)
    }

    // MARK: - Helpers

    private func post(path: String, body: [String: String]) async throws -> (Data, URLResponse) {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await session.data(for: request)
    }

    private func extractSessionToken(from response: HTTPURLResponse) -> String? {
        guard let setCookie = response.value(forHTTPHeaderField: "Set-Cookie") else { return nil }
        let pattern = /better-auth\.session_token=([^;]+)/
        guard let match = setCookie.firstMatch(of: pattern) else { return nil }
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
