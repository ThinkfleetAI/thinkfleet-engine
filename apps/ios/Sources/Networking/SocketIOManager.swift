import Foundation
import SocketIO

@Observable
final class SocketIOManager: @unchecked Sendable {
    private var manager: SocketManager?
    private var socket: SocketIOClient?
    private let sessionStore: SessionStore
    private let baseURL: URL

    private(set) var isConnected = false

    typealias AgentEventHandler = (String, [String: Any]) -> Void
    private var agentEventHandlers: [String: AgentEventHandler] = [:]
    private var rpcCallbacks: [String: (Result<[String: Any], Error>) -> Void] = [:]

    init(baseURL: URL, sessionStore: SessionStore) {
        self.baseURL = baseURL
        self.sessionStore = sessionStore
    }

    func connect() {
        guard let token = sessionStore.sessionToken else { return }

        var params: [String: Any] = ["token": token]
        if let orgId = sessionStore.currentOrganizationId {
            params["organizationId"] = orgId
        }

        manager = SocketManager(
            socketURL: baseURL,
            config: [
                .path("/api/socket.io"),
                .connectParams(params),
                .forceWebsockets(true),
                .reconnects(true),
                .reconnectWait(1),
                .reconnectWaitMax(10),
            ]
        )

        socket = manager?.defaultSocket

        socket?.on(clientEvent: .connect) { [weak self] _, _ in
            self?.isConnected = true
        }

        socket?.on(clientEvent: .disconnect) { [weak self] _, _ in
            self?.isConnected = false
        }

        socket?.on("agent:event") { [weak self] data, _ in
            guard let dict = data.first as? [String: Any],
                  let agentId = dict["agentId"] as? String
            else { return }
            self?.agentEventHandlers[agentId]?(agentId, dict)
        }

        socket?.on("rpc:response") { [weak self] data, _ in
            guard let dict = data.first as? [String: Any],
                  let id = dict["id"] as? String
            else { return }
            if let error = dict["error"] as? [String: Any] {
                let message = error["message"] as? String ?? "RPC error"
                self?.rpcCallbacks[id]?(.failure(SocketRPCError(message: message)))
            } else {
                self?.rpcCallbacks[id]?(.success(dict))
            }
            self?.rpcCallbacks.removeValue(forKey: id)
        }

        socket?.connect()
    }

    func disconnect() {
        socket?.disconnect()
        manager = nil
        socket = nil
        agentEventHandlers.removeAll()
        rpcCallbacks.removeAll()
    }

    func subscribeToAgent(_ agentId: String, handler: @escaping AgentEventHandler) {
        agentEventHandlers[agentId] = handler
        socket?.emit("subscribe", ["agentId": agentId])
    }

    func unsubscribeFromAgent(_ agentId: String) {
        agentEventHandlers.removeValue(forKey: agentId)
        socket?.emit("unsubscribe", ["agentId": agentId])
    }

    func sendRPC(agentId: String, method: String, params: [String: Any] = [:]) async throws -> [String: Any] {
        let id = UUID().uuidString
        let request: [String: Any] = [
            "id": id,
            "agentId": agentId,
            "method": method,
            "params": params,
        ]

        return try await withCheckedThrowingContinuation { continuation in
            rpcCallbacks[id] = { result in
                nonisolated(unsafe) let r = result
                continuation.resume(with: r)
            }
            socket?.emit("rpc", request)

            // Timeout after 60 seconds
            Task {
                try? await Task.sleep(for: .seconds(60))
                if let callback = rpcCallbacks.removeValue(forKey: id) {
                    callback(.failure(SocketRPCError(message: "RPC timeout")))
                }
            }
        }
    }
}

struct SocketRPCError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}
