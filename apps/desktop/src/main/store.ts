import ElectronStore from "electron-store";

export interface StoreSchema {
  gatewayPort: number;
  agentMode: "standalone" | "saas";
  saasUrl: string;
  saasAgentDbId: string;
  saasGatewayToken: string;
  selectedAgentId: string;
  onboardingComplete: boolean;
  windowBounds: { width: number; height: number; x?: number; y?: number };
  // Device registration
  deviceId: string;
  deviceAuthToken: string;
  deviceConfigVersion: number;
  // Proxy
  proxyUrl: string;
  proxyBypass: string;
  // Local agent
  localAgentEnabled: boolean;
}

export type Store = ElectronStore<StoreSchema>;

export function createStore(): Store {
  return new ElectronStore<StoreSchema>({
    name: "thinkfleet-desktop",
    defaults: {
      gatewayPort: 18789,
      agentMode: "standalone",
      saasUrl: "",
      saasAgentDbId: "",
      saasGatewayToken: "",
      selectedAgentId: "default",
      onboardingComplete: false,
      windowBounds: { width: 480, height: 680 },
      deviceId: "",
      deviceAuthToken: "",
      deviceConfigVersion: 0,
      proxyUrl: "",
      proxyBypass: "",
      localAgentEnabled: false,
    },
  });
}
