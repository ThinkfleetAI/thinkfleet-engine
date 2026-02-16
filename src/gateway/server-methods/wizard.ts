import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolveConfigPathCandidate } from "../../config/paths.js";
import { loadConfig } from "../../config/io.js";
import { defaultRuntime } from "../../runtime.js";
import { VERSION } from "../../version.js";
import { WizardSession } from "../../wizard/session.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateWizardCancelParams,
  validateWizardNeedsSetupParams,
  validateWizardNextParams,
  validateWizardStartParams,
  validateWizardStatusParams,
  validateWizardTestApiKeyParams,
  validateWizardTestSaasConnectionParams,
} from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

export const wizardHandlers: GatewayRequestHandlers = {
  "wizard.start": async ({ params, respond, context }) => {
    if (!validateWizardStartParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid wizard.start params: ${formatValidationErrors(validateWizardStartParams.errors)}`,
        ),
      );
      return;
    }
    const running = context.findRunningWizard();
    if (running) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "wizard already running"));
      return;
    }
    const sessionId = randomUUID();
    const opts = {
      mode: params.mode as "local" | "remote" | undefined,
      workspace: typeof params.workspace === "string" ? params.workspace : undefined,
    };
    const session = new WizardSession((prompter) =>
      context.wizardRunner(opts, defaultRuntime, prompter),
    );
    context.wizardSessions.set(sessionId, session);
    const result = await session.next();
    if (result.done) {
      context.purgeWizardSession(sessionId);
    }
    respond(true, { sessionId, ...result }, undefined);
  },
  "wizard.next": async ({ params, respond, context }) => {
    if (!validateWizardNextParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid wizard.next params: ${formatValidationErrors(validateWizardNextParams.errors)}`,
        ),
      );
      return;
    }
    const sessionId = params.sessionId as string;
    const session = context.wizardSessions.get(sessionId);
    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "wizard not found"));
      return;
    }
    const answer = params.answer as { stepId?: string; value?: unknown } | undefined;
    if (answer) {
      if (session.getStatus() !== "running") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "wizard not running"));
        return;
      }
      try {
        await session.answer(String(answer.stepId ?? ""), answer.value);
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, formatForLog(err)));
        return;
      }
    }
    const result = await session.next();
    if (result.done) {
      context.purgeWizardSession(sessionId);
    }
    respond(true, result, undefined);
  },
  "wizard.cancel": ({ params, respond, context }) => {
    if (!validateWizardCancelParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid wizard.cancel params: ${formatValidationErrors(validateWizardCancelParams.errors)}`,
        ),
      );
      return;
    }
    const sessionId = params.sessionId as string;
    const session = context.wizardSessions.get(sessionId);
    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "wizard not found"));
      return;
    }
    session.cancel();
    const status = {
      status: session.getStatus(),
      error: session.getError(),
    };
    context.wizardSessions.delete(sessionId);
    respond(true, status, undefined);
  },
  "wizard.status": ({ params, respond, context }) => {
    if (!validateWizardStatusParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid wizard.status params: ${formatValidationErrors(validateWizardStatusParams.errors)}`,
        ),
      );
      return;
    }
    const sessionId = params.sessionId as string;
    const session = context.wizardSessions.get(sessionId);
    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "wizard not found"));
      return;
    }
    const status = {
      status: session.getStatus(),
      error: session.getError(),
    };
    if (status.status !== "running") {
      context.wizardSessions.delete(sessionId);
    }
    respond(true, status, undefined);
  },
  "wizard.needsSetup": async ({ params, respond }) => {
    if (!validateWizardNeedsSetupParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid wizard.needsSetup params: ${formatValidationErrors(validateWizardNeedsSetupParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const configPath = resolveConfigPathCandidate();
      const hasConfig = existsSync(configPath);
      let hasModels = false;
      if (hasConfig) {
        const cfg = loadConfig();
        const models = cfg.models;
        hasModels = !!(models && typeof models === "object" && Object.keys(models).length > 0);
      }
      respond(
        true,
        { needsSetup: !hasConfig || !hasModels, hasConfig, hasModels, version: VERSION },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "wizard.testApiKey": async ({ params, respond }) => {
    if (!validateWizardTestApiKeyParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid wizard.testApiKey params: ${formatValidationErrors(validateWizardTestApiKeyParams.errors)}`,
        ),
      );
      return;
    }
    const provider = params.provider as string;
    const apiKey = params.apiKey as string;
    try {
      const endpoints: Record<string, { url: string; headers: Record<string, string> }> = {
        openai: {
          url: "https://api.openai.com/v1/models",
          headers: { Authorization: `Bearer ${apiKey}` },
        },
        anthropic: {
          url: "https://api.anthropic.com/v1/models",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
        },
        google: {
          url: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          headers: {},
        },
        groq: {
          url: "https://api.groq.com/openai/v1/models",
          headers: { Authorization: `Bearer ${apiKey}` },
        },
        mistral: {
          url: "https://api.mistral.ai/v1/models",
          headers: { Authorization: `Bearer ${apiKey}` },
        },
        xai: {
          url: "https://api.x.ai/v1/models",
          headers: { Authorization: `Bearer ${apiKey}` },
        },
        deepseek: {
          url: "https://api.deepseek.com/v1/models",
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      };
      const ep = endpoints[provider.toLowerCase()];
      if (!ep) {
        respond(true, { ok: false, error: `Unknown provider: ${provider}` }, undefined);
        return;
      }
      const res = await fetch(ep.url, {
        method: "GET",
        headers: ep.headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        respond(true, { ok: true }, undefined);
      } else {
        const body = await res.text().catch(() => "");
        respond(
          true,
          { ok: false, error: `API returned ${res.status}: ${body.slice(0, 200)}` },
          undefined,
        );
      }
    } catch (err) {
      respond(true, { ok: false, error: formatForLog(err) }, undefined);
    }
  },
  "wizard.testSaasConnection": async ({ params, respond }) => {
    if (!validateWizardTestSaasConnectionParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid wizard.testSaasConnection params: ${formatValidationErrors(validateWizardTestSaasConnectionParams.errors)}`,
        ),
      );
      return;
    }
    const apiUrl = (params.apiUrl as string).replace(/\/+$/, "");
    const agentDbId = params.agentDbId as string;
    const oauthClientId = params.oauthClientId as string;
    const oauthClientSecret = params.oauthClientSecret as string;
    try {
      // Step 1: Exchange OAuth credentials for an access token
      const tokenUrl = `${apiUrl}/api/internal/oauth/token`;
      const tokenRes = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: oauthClientId,
          client_secret: oauthClientSecret,
        }).toString(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!tokenRes.ok) {
        const body = await tokenRes.text().catch(() => "");
        respond(
          true,
          {
            ok: false,
            error: `OAuth token exchange failed (${tokenRes.status}): ${body.slice(0, 200)}`,
          },
          undefined,
        );
        return;
      }
      const tokenData = (await tokenRes.json()) as { access_token?: string };
      const accessToken = tokenData.access_token ?? "";

      // Step 2: Verify SaaS reachability with the access token
      const healthUrl = `${apiUrl}/api/internal/health?agentDbId=${encodeURIComponent(agentDbId)}`;
      const res = await fetch(healthUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { orgName?: string };
        respond(true, { ok: true, orgName: data.orgName }, undefined);
      } else {
        const body = await res.text().catch(() => "");
        respond(
          true,
          { ok: false, error: `SaaS returned ${res.status}: ${body.slice(0, 200)}` },
          undefined,
        );
      }
    } catch (err) {
      respond(true, { ok: false, error: formatForLog(err) }, undefined);
    }
  },
};
