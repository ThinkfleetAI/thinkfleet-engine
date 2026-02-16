import type { GatewayBrowserClient } from "../gateway";

export type NeedsSetupResult = {
  needsSetup: boolean;
  hasConfig: boolean;
  hasModels: boolean;
  version: string;
};

export type TestApiKeyResult = {
  ok: boolean;
  error?: string;
};

export type TestSaasConnectionResult = {
  ok: boolean;
  error?: string;
  orgName?: string;
};

export async function checkNeedsSetup(
  client: GatewayBrowserClient,
): Promise<NeedsSetupResult> {
  return client.request<NeedsSetupResult>("wizard.needsSetup", {});
}

export async function testApiKey(
  client: GatewayBrowserClient,
  provider: string,
  apiKey: string,
): Promise<TestApiKeyResult> {
  return client.request<TestApiKeyResult>("wizard.testApiKey", {
    provider,
    apiKey,
  });
}

export async function testSaasConnection(
  client: GatewayBrowserClient,
  apiUrl: string,
  agentDbId: string,
  gatewayToken?: string,
): Promise<TestSaasConnectionResult> {
  return client.request<TestSaasConnectionResult>(
    "wizard.testSaasConnection",
    { apiUrl, agentDbId, gatewayToken },
  );
}

export async function startWizard(
  client: GatewayBrowserClient,
  mode?: "local" | "remote",
): Promise<{ sessionId: string; done: boolean; step?: unknown }> {
  return client.request("wizard.start", { mode });
}

export async function wizardNext(
  client: GatewayBrowserClient,
  sessionId: string,
  answer?: { stepId: string; value: unknown },
): Promise<{ done: boolean; step?: unknown }> {
  return client.request("wizard.next", { sessionId, answer });
}
