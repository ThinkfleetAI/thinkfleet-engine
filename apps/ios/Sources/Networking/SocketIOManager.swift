import Foundation
import os.log
import SocketIO

private let socketLog = Logger(subsystem: "com.thinkfleet", category: "socket")

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
        guard let token = sessionStore.rawToken ?? sessionStore.sessionToken else {
            socketLog.warning("connect: no session token, skipping")
            return
        }

        // Disconnect existing connection first
        if socket != nil {
            socketLog.info("connect: disconnecting existing socket before reconnect")
            socket?.disconnect()
            manager = nil
            socket = nil
        }

        var params: [String: Any] = ["token": token]
        if let orgId = sessionStore.currentOrganizationId {
            params["organizationId"] = orgId
            socketLog.info("connect: connecting with orgId=\(orgId)")
        } else {
            socketLog.warning("connect: no organizationId set — server may reject agent operations")
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
                .log(false),
            ]
        )

        socket = manager?.defaultSocket

        socket?.on(clientEvent: .connect) { [weak self] _, _ in
            socketLog.info("Socket.IO connected")
            self?.isConnected = true
        }

        socket?.on(clientEvent: .disconnect) { [weak self] data, _ in
            socketLog.info("Socket.IO disconnected: \(String(describing: data))")
            self?.isConnected = false
        }

        socket?.on(clientEvent: .error) { _, _ in
            socketLog.error("Socket.IO connection error")
        }

        socket?.on(clientEvent: .reconnect) { _, _ in
            socketLog.info("Socket.IO reconnecting...")
        }

        socket?.on(clientEvent: .reconnectAttempt) { data, _ in
            socketLog.info("Socket.IO reconnect attempt \(String(describing: data))")
        }

        socket?.on("agent:event") { [weak self] data, _ in
            guard let dict = data.first as? [String: Any],
                  let agentId = dict["agentId"] as? String
            else {
                socketLog.warning("agent:event: invalid data format: \(String(describing: data.first))")
                return
            }
            let eventType = (dict["event"] as? String) ?? "unknown"
            socketLog.debug("agent:event received: agent=\(agentId) event=\(eventType)")

            if let handler = self?.agentEventHandlers[agentId] {
                handler(agentId, dict)
            } else {
                socketLog.warning("agent:event: no handler for agent \(agentId)")
            }
        }

        socket?.on("rpc:response") { [weak self] data, _ in
            guard let dict = data.first as? [String: Any],
                  let id = dict["id"] as? String
            else {
                socketLog.warning("rpc:response: invalid format")
                return
            }
            if let error = dict["error"] as? [String: Any] {
                let message = error["message"] as? String ?? "RPC error"
                socketLog.error("rpc:response error id=\(id): \(message)")
                self?.rpcCallbacks[id]?(.failure(SocketRPCError(message: message)))
            } else {
                socketLog.info("rpc:response success id=\(id)")
                self?.rpcCallbacks[id]?(.success(dict))
            }
            self?.rpcCallbacks.removeValue(forKey: id)
        }

        socketLog.info("connect: calling socket.connect() to \(self.baseURL.absoluteString)")
        socket?.connect()
    }

    func disconnect() {
        socketLog.info("disconnect: tearing down socket")
        socket?.disconnect()
        manager = nil
        socket = nil
        agentEventHandlers.removeAll()
        rpcCallbacks.removeAll()
        isConnected = false
    }

    func subscribeToAgent(_ agentId: String, handler: @escaping AgentEventHandler) {
        agentEventHandlers[agentId] = handler
        if isConnected {
            socketLog.info("subscribe: emitting subscribe for agent \(agentId)")
            socket?.emit("subscribe", ["agentId": agentId])
        } else {
            socketLog.warning("subscribe: socket not connected, queueing subscribe for agent \(agentId)")
            // Re-subscribe once connected
            socket?.on(clientEvent: .connect) { [weak self] _, _ in
                guard self?.agentEventHandlers[agentId] != nil else { return }
                socketLog.info("subscribe: deferred subscribe for agent \(agentId) after connect")
                self?.socket?.emit("subscribe", ["agentId": agentId])
            }
        }
    }

    func unsubscribeFromAgent(_ agentId: String) {
        agentEventHandlers.removeValue(forKey: agentId)
        socket?.emit("unsubscribe", ["agentId": agentId])
        socketLog.info("unsubscribe: agent \(agentId)")
    }

    /// Subscribe to an agent's chat events with typed payload parsing
    func subscribeToChatEvents(_ agentId: String, handler: @escaping (ChatEventPayload) -> Void) {
        subscribeToAgent(agentId) { _, dict in
            if let event = ChatEventPayload(from: dict) {
                socketLog.debug("chatEvent: state=\(event.state) text=\(event.text?.prefix(50) ?? "nil")")
                handler(event)
            }
        }
    }

    func sendRPC(agentId: String, method: String, params: [String: Any] = [:]) async throws -> [String: Any] {
        // Wait up to 5 seconds for socket connection to establish
        if !isConnected {
            socketLog.info("sendRPC: waiting for socket connection before sending \(method)...")
            for _ in 0 ..< 50 {
                try? await Task.sleep(for: .milliseconds(100))
                if isConnected { break }
            }
        }
        guard isConnected else {
            socketLog.error("sendRPC: socket not connected after waiting, cannot send \(method) to \(agentId)")
            throw SocketRPCError(message: "Socket not connected")
        }

        let id = UUID().uuidString
        let request: [String: Any] = [
            "id": id,
            "agentId": agentId,
            "method": method,
            "params": params,
        ]

        socketLog.info("sendRPC: id=\(id) agent=\(agentId) method=\(method)")

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
                    socketLog.error("sendRPC: timeout for id=\(id) method=\(method)")
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
