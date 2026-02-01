import { contextBridge, ipcRenderer } from "electron";

export interface ElectronAPI {
  gateway: {
    start: () => Promise<string>;
    stop: () => Promise<string>;
    restart: () => Promise<string>;
    getStatus: () => Promise<{ status: string; port: number }>;
    sendMessage: (agentId: string, message: string, sessionId?: string) => Promise<void>;
    onStatusChange: (callback: (status: { status: string; port: number }) => void) => () => void;
    onMessage: (callback: (data: string) => void) => () => void;
  };
  auth: {
    login: (saasUrl: string) => Promise<{ agentDbId: string; token: string }>;
    logout: () => Promise<void>;
    getSession: () => Promise<{
      isAuthenticated: boolean;
      saasUrl: string;
      agentMode: string;
    }>;
  };
  settings: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
  };
  app: {
    getVersion: () => Promise<string>;
    onUpdateAvailable: (callback: (info: { version: string }) => void) => () => void;
    onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void;
  };
}

const api: ElectronAPI = {
  gateway: {
    start: () => ipcRenderer.invoke("gateway:start"),
    stop: () => ipcRenderer.invoke("gateway:stop"),
    restart: () => ipcRenderer.invoke("gateway:restart"),
    getStatus: () => ipcRenderer.invoke("gateway:status"),
    sendMessage: (agentId, message, sessionId) =>
      ipcRenderer.invoke("gateway:send-message", agentId, message, sessionId),
    onStatusChange: (callback) => {
      const handler = (_event: unknown, status: { status: string; port: number }) =>
        callback(status);
      ipcRenderer.on("gateway:status-changed", handler);
      return () => ipcRenderer.removeListener("gateway:status-changed", handler);
    },
    onMessage: (callback) => {
      const handler = (_event: unknown, data: string) => callback(data);
      ipcRenderer.on("gateway:message", handler);
      return () => ipcRenderer.removeListener("gateway:message", handler);
    },
  },
  auth: {
    login: (saasUrl) => ipcRenderer.invoke("auth:login", saasUrl),
    logout: () => ipcRenderer.invoke("auth:logout"),
    getSession: () => ipcRenderer.invoke("auth:session"),
  },
  settings: {
    get: (key) => ipcRenderer.invoke("settings:get", key),
    set: (key, value) => ipcRenderer.invoke("settings:set", key, value),
  },
  app: {
    getVersion: () => ipcRenderer.invoke("app:version"),
    onUpdateAvailable: (callback) => {
      const handler = (_event: unknown, info: { version: string }) => callback(info);
      ipcRenderer.on("update:available", handler);
      return () => ipcRenderer.removeListener("update:available", handler);
    },
    onUpdateDownloaded: (callback) => {
      const handler = (_event: unknown, info: { version: string }) => callback(info);
      ipcRenderer.on("update:downloaded", handler);
      return () => ipcRenderer.removeListener("update:downloaded", handler);
    },
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);
