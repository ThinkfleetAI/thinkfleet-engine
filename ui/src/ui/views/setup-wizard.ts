import { html, nothing } from "lit";

export type SetupWizardProps = {
  step: number;
  mode: "standalone" | "saas" | null;
  loading: boolean;
  version: string;
  provider: string;
  apiKey: string;
  apiKeyValid: boolean | null;
  apiKeyTesting: boolean;
  saasApiUrl: string;
  saasAgentDbId: string;
  saasOAuthClientId: string;
  saasOAuthClientSecret: string;
  saasValid: boolean | null;
  saasTesting: boolean;
  saasOrgName: string;
  error: string | null;
  onSetStep: (step: number) => void;
  onSetMode: (mode: "standalone" | "saas") => void;
  onSetProvider: (provider: string) => void;
  onSetApiKey: (key: string) => void;
  onTestApiKey: () => void;
  onSetSaasApiUrl: (url: string) => void;
  onSetSaasAgentDbId: (id: string) => void;
  onSetSaasOAuthClientId: (id: string) => void;
  onSetSaasOAuthClientSecret: (secret: string) => void;
  onTestSaasConnection: () => void;
  onFinish: () => void;
  onSkip: () => void;
};

const STEPS = ["Welcome", "Mode", "Configure", "Review"];

const PROVIDERS = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "google", label: "Google" },
  { id: "groq", label: "Groq" },
  { id: "mistral", label: "Mistral" },
  { id: "xai", label: "xAI" },
  { id: "deepseek", label: "DeepSeek" },
];

function renderStepIndicator(currentStep: number) {
  return html`
    <div class="wizard__steps">
      ${STEPS.map((label, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep;
        return html`
          ${i > 0
            ? html`<div class="wizard__step-line ${isDone ? "wizard__step-line--done" : ""}"></div>`
            : nothing}
          <div
            class="wizard__step-dot ${isActive ? "wizard__step-dot--active" : ""} ${isDone ? "wizard__step-dot--done" : ""}"
            title="${label}"
          >
            ${isDone ? "\u2713" : i + 1}
          </div>
        `;
      })}
    </div>
  `;
}

function renderWelcome(props: SetupWizardProps) {
  return html`
    <div class="wizard__content">
      <h2 class="wizard__title">Welcome to ThinkFleet Engine</h2>
      <p class="wizard__subtitle">
        Let's get your AI agent runtime configured and ready to go.<br />
        This wizard will walk you through the essential settings.
      </p>
      ${props.version
        ? html`<p class="wizard__version" style="text-align:center">v${props.version}</p>`
        : nothing}
      <div class="wizard__actions" style="justify-content:center">
        <button class="wizard__btn wizard__btn--primary" @click=${() => props.onSetStep(1)}>
          Get Started
        </button>
      </div>
      <div style="text-align:center">
        <button class="wizard__btn wizard__btn--ghost" @click=${props.onSkip}>
          Skip setup
        </button>
      </div>
    </div>
  `;
}

function renderModeSelection(props: SetupWizardProps) {
  return html`
    <div class="wizard__content">
      <h2 class="wizard__title">Choose Your Mode</h2>
      <p class="wizard__subtitle">
        How would you like to run ThinkFleet Engine?
      </p>
      <div class="wizard__cards">
        <div
          class="wizard__card ${props.mode === "standalone" ? "wizard__card--selected" : ""}"
          @click=${() => props.onSetMode("standalone")}
        >
          <div class="wizard__card-icon">&#x1F4BB;</div>
          <div class="wizard__card-title">Standalone</div>
          <div class="wizard__card-desc">
            Bring your own API keys and run independently.
          </div>
        </div>
        <div
          class="wizard__card ${props.mode === "saas" ? "wizard__card--selected" : ""}"
          @click=${() => props.onSetMode("saas")}
        >
          <div class="wizard__card-icon">&#x2601;</div>
          <div class="wizard__card-title">SaaS Connected</div>
          <div class="wizard__card-desc">
            Connect to ThinkFleet SaaS for managed credentials and channels.
          </div>
        </div>
      </div>
      <div class="wizard__actions">
        <button class="wizard__btn wizard__btn--secondary" @click=${() => props.onSetStep(0)}>
          Back
        </button>
        <button
          class="wizard__btn wizard__btn--primary"
          ?disabled=${!props.mode}
          @click=${() => props.onSetStep(2)}
        >
          Continue
        </button>
      </div>
    </div>
  `;
}

function renderStandaloneConfig(props: SetupWizardProps) {
  return html`
    <div class="wizard__content">
      <h2 class="wizard__title">AI Provider Setup</h2>
      <p class="wizard__subtitle">Select a provider and enter your API key.</p>

      <div class="wizard__providers">
        ${PROVIDERS.map(
          (p) => html`
            <div
              class="wizard__provider ${props.provider === p.id ? "wizard__provider--selected" : ""}"
              @click=${() => props.onSetProvider(p.id)}
            >
              ${p.label}
            </div>
          `,
        )}
      </div>

      ${props.provider
        ? html`
            <div class="wizard__field">
              <label class="wizard__label">${PROVIDERS.find((p) => p.id === props.provider)?.label ?? props.provider} API Key</label>
              <div class="wizard__input-row">
                <input
                  class="wizard__input ${props.apiKeyValid === false ? "wizard__input--error" : ""}"
                  type="password"
                  placeholder="Enter your API key..."
                  .value=${props.apiKey}
                  @input=${(e: Event) => props.onSetApiKey((e.target as HTMLInputElement).value)}
                />
                <button
                  class="wizard__test-btn"
                  ?disabled=${!props.apiKey || props.apiKeyTesting}
                  @click=${props.onTestApiKey}
                >
                  ${props.apiKeyTesting ? "Testing..." : "Test"}
                </button>
              </div>
            </div>

            ${props.apiKeyValid === true
              ? html`<div class="wizard__status wizard__status--success">\u2713 API key is valid</div>`
              : nothing}
            ${props.apiKeyValid === false
              ? html`<div class="wizard__status wizard__status--error">\u2717 ${props.error || "Invalid API key"}</div>`
              : nothing}
          `
        : nothing}

      <div class="wizard__actions">
        <button class="wizard__btn wizard__btn--secondary" @click=${() => props.onSetStep(1)}>
          Back
        </button>
        <button
          class="wizard__btn wizard__btn--primary"
          ?disabled=${!props.provider || !props.apiKey}
          @click=${() => props.onSetStep(3)}
        >
          Continue
        </button>
      </div>
    </div>
  `;
}

function renderSaasConfig(props: SetupWizardProps) {
  return html`
    <div class="wizard__content">
      <h2 class="wizard__title">Connect to ThinkFleet SaaS</h2>
      <p class="wizard__subtitle">
        Enter your SaaS connection details to enable managed credentials and channels.
      </p>

      <div class="wizard__field">
        <label class="wizard__label">SaaS API URL</label>
        <input
          class="wizard__input"
          type="url"
          placeholder="https://api.thinkfleet.ai"
          .value=${props.saasApiUrl}
          @input=${(e: Event) => props.onSetSaasApiUrl((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="wizard__field">
        <label class="wizard__label">Agent Database ID</label>
        <input
          class="wizard__input"
          type="text"
          placeholder="Your agent DB ID"
          .value=${props.saasAgentDbId}
          @input=${(e: Event) => props.onSetSaasAgentDbId((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="wizard__field">
        <label class="wizard__label">OAuth Client ID</label>
        <input
          class="wizard__input"
          type="text"
          placeholder="OAuth client ID from your organization"
          .value=${props.saasOAuthClientId}
          @input=${(e: Event) => props.onSetSaasOAuthClientId((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="wizard__field">
        <label class="wizard__label">OAuth Client Secret</label>
        <input
          class="wizard__input"
          type="password"
          placeholder="OAuth client secret"
          .value=${props.saasOAuthClientSecret}
          @input=${(e: Event) => props.onSetSaasOAuthClientSecret((e.target as HTMLInputElement).value)}
        />
      </div>

      <div style="text-align:center">
        <button
          class="wizard__test-btn"
          ?disabled=${!props.saasApiUrl || !props.saasAgentDbId || !props.saasOAuthClientId || !props.saasOAuthClientSecret || props.saasTesting}
          @click=${props.onTestSaasConnection}
        >
          ${props.saasTesting ? "Testing connection..." : "Test Connection"}
        </button>
      </div>

      ${props.saasValid === true
        ? html`<div class="wizard__status wizard__status--success">
            \u2713 Connected${props.saasOrgName ? ` to ${props.saasOrgName}` : ""}
          </div>`
        : nothing}
      ${props.saasValid === false
        ? html`<div class="wizard__status wizard__status--error">\u2717 ${props.error || "Connection failed"}</div>`
        : nothing}

      <div class="wizard__actions">
        <button class="wizard__btn wizard__btn--secondary" @click=${() => props.onSetStep(1)}>
          Back
        </button>
        <button
          class="wizard__btn wizard__btn--primary"
          ?disabled=${!props.saasApiUrl || !props.saasAgentDbId}
          @click=${() => props.onSetStep(3)}
        >
          Continue
        </button>
      </div>
    </div>
  `;
}

function renderReview(props: SetupWizardProps) {
  const isStandalone = props.mode === "standalone";

  return html`
    <div class="wizard__content">
      <h2 class="wizard__title">Review & Save</h2>
      <p class="wizard__subtitle">
        Here's a summary of your configuration. Click "Save & Start" to apply.
      </p>

      <div class="wizard__summary">
        <div class="wizard__summary-row">
          <span class="wizard__summary-label">Mode</span>
          <span class="wizard__summary-value">${isStandalone ? "Standalone" : "SaaS Connected"}</span>
        </div>
        ${isStandalone
          ? html`
              <div class="wizard__summary-row">
                <span class="wizard__summary-label">Provider</span>
                <span class="wizard__summary-value">${PROVIDERS.find((p) => p.id === props.provider)?.label ?? props.provider}</span>
              </div>
              <div class="wizard__summary-row">
                <span class="wizard__summary-label">API Key</span>
                <span class="wizard__summary-value">${props.apiKey ? "\u2022".repeat(8) + props.apiKey.slice(-4) : "Not set"}</span>
              </div>
              ${props.apiKeyValid === true
                ? html`
                    <div class="wizard__summary-row">
                      <span class="wizard__summary-label">Key Status</span>
                      <span class="wizard__summary-value" style="color:#22c55e">\u2713 Verified</span>
                    </div>
                  `
                : nothing}
            `
          : html`
              <div class="wizard__summary-row">
                <span class="wizard__summary-label">SaaS URL</span>
                <span class="wizard__summary-value">${props.saasApiUrl}</span>
              </div>
              <div class="wizard__summary-row">
                <span class="wizard__summary-label">Agent DB ID</span>
                <span class="wizard__summary-value">${props.saasAgentDbId}</span>
              </div>
              <div class="wizard__summary-row">
                <span class="wizard__summary-label">OAuth</span>
                <span class="wizard__summary-value">${props.saasOAuthClientId ? "\u2022".repeat(6) + props.saasOAuthClientId.slice(-4) : "Not set"}</span>
              </div>
              ${props.saasOrgName
                ? html`
                    <div class="wizard__summary-row">
                      <span class="wizard__summary-label">Organization</span>
                      <span class="wizard__summary-value">${props.saasOrgName}</span>
                    </div>
                  `
                : nothing}
            `}
      </div>

      ${props.error
        ? html`<div class="wizard__status wizard__status--error">${props.error}</div>`
        : nothing}

      <div class="wizard__actions">
        <button class="wizard__btn wizard__btn--secondary" @click=${() => props.onSetStep(2)}>
          Back
        </button>
        <button
          class="wizard__btn wizard__btn--primary"
          ?disabled=${props.loading}
          @click=${props.onFinish}
        >
          ${props.loading ? "Saving..." : "Save & Start"}
        </button>
      </div>
    </div>
  `;
}

export function renderSetupWizard(props: SetupWizardProps) {
  const configStep =
    props.mode === "saas" ? renderSaasConfig(props) : renderStandaloneConfig(props);

  return html`
    <div class="wizard">
      <div class="wizard__container">
        <div class="wizard__header">
          <div class="wizard__logo">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 468.13 82.53" style="height:42px;width:auto">
              <path fill="var(--accent, #3875c8)" d="M73.91,36.12c.65-2.05,2.03-7.74-.6-12.79-1.85-3.55-5.24-6-10.08-7.29-1.47-2.59-6.93-10.51-18.02-8.72-4.06.66-7.1,3.67-7.58,7.36h-6.04v-3.5c2.31-.74,3.98-2.9,3.98-5.45,0-3.16-2.57-5.72-5.72-5.72s-5.72,2.57-5.72,5.72c0,2.55,1.67,4.71,3.98,5.45v3.5h-3.86c-4.88,0-8.85,3.97-8.85,8.85v6.57h-4.21c-.74-2.31-2.9-3.98-5.45-3.98-3.16,0-5.72,2.57-5.72,5.72s2.57,5.72,5.72,5.72c2.55,0,4.71-1.67,5.45-3.98h4.21v14h-4.21c-.74-2.31-2.9-3.98-5.45-3.98-3.16,0-5.72,2.57-5.72,5.72s2.57,5.72,5.72,5.72c2.55,0,4.71-1.67,5.45-3.98h4.21v7.19c0,4.88,3.97,8.85,8.85,8.85h3.86v3.75c-2.31.74-3.98,2.9-3.98,5.45,0,3.16,2.57,5.72,5.72,5.72s5.72-2.57,5.72-5.72c0-2.55-1.67-4.71-3.98-5.45v-3.75h6.24c.55,1.93,1.9,3.62,3.79,4.66,1.36.75,3.29,1.51,5.54,1.51,2.69,0,5.84-1.09,8.99-4.61,1.69-.04,5.34-.44,8.11-2.95,1.94-1.76,3.06-4.17,3.33-7.18,1.98-.96,6.12-3.46,7.95-8.22,1.6-4.15,1.05-8.93-1.62-14.21ZM29.84,3.49c1.23,0,2.24,1,2.24,2.24s-1,2.24-2.24,2.24-2.24-1-2.24-2.24,1-2.24,2.24-2.24ZM5.72,34.07c-1.23,0-2.24-1-2.24-2.24s1-2.24,2.24-2.24,2.24,1,2.24,2.24-1,2.24-2.24,2.24ZM5.72,51.56c-1.23,0-2.24-1-2.24-2.24s1-2.24,2.24-2.24,2.24,1,2.24,2.24-1,2.24-2.24,2.24ZM29.84,78.55c-1.23,0-2.24-1-2.24-2.24s1-2.24,2.24-2.24,2.24,1,2.24,2.24-1,2.24-2.24,2.24ZM37.54,55.82h-9.67c-.55,0-1-.45-1-1v-27.86c0-.55.45-1,1-1h9.67v29.87ZM18.86,58.26V23.52c0-2.96,2.41-5.36,5.36-5.36h13.32v4.31h-9.67c-2.48,0-4.49,2.01-4.49,4.49v27.86c0,2.48,2.01,4.49,4.49,4.49h9.67v4.31h-13.32c-2.96,0-5.36-2.41-5.36-5.36ZM72.29,49.04c-1.77,4.66-6.73,6.59-6.96,6.68-.27.09-5.04,1.57-10.21,1.24.56-3.12-.09-5.68-.14-5.87-.24-.93-1.19-1.49-2.13-1.24-.93.24-1.49,1.2-1.24,2.13.02.06,1.56,6.2-3.26,9.92-.76.59-.91,1.68-.32,2.45.34.45.86.68,1.38.68.37,0,.75-.12,1.06-.36,1.68-1.29,2.8-2.78,3.54-4.28.02,0,.04.01.06.01.88.09,1.75.12,2.6.12,2.82,0,5.38-.41,7.17-.8-.35,1.41-.99,2.56-1.93,3.42-2.52,2.3-6.41,2.06-6.45,2.06l-.9-.07-.58.7c-3.32,4.02-6.93,5-10.71,2.91-1.42-.78-2.26-2.11-2.26-3.57v-11c.41-.91,2.67-5,10.58-6.69.94-.2,1.54-1.13,1.34-2.07-.2-.94-1.13-1.54-2.07-1.34-4.75,1.02-7.85,2.83-9.86,4.59v-8.35c.64-.99,2.73-3.79,6.94-5.94,1.1.49,3.63,2.02,4.92,5.99.24.74.92,1.21,1.66,1.21.18,0,.36-.03.54-.09.92-.3,1.42-1.28,1.12-2.2-1.03-3.18-2.73-5.21-4.28-6.49,2.93-.87,6.54-1.36,10.93-1.07.94.06,1.79-.66,1.85-1.62.06-.96-.66-1.79-1.62-1.86-11.58-.77-18.46,3.39-22.07,6.76v-7.52c.64-.78,2.3-2.57,4.86-3.55.9-.35,1.35-1.35,1-2.25-.35-.9-1.36-1.35-2.25-1-1.43.55-2.63,1.28-3.61,2.02v-6.96c0-2.43,1.99-4.51,4.73-4.96.91-.15,1.77-.21,2.59-.21,5.53,0,8.9,3.08,10.64,5.35-1.57.22-3.44.75-4.95,1.95-1.37-1.44-3.32-2.91-6.14-4.06-.89-.36-1.91.07-2.27.96-.36.89.07,1.91.96,2.27,6.02,2.44,7,6.52,7.05,6.73.17.82.89,1.4,1.71,1.4.11,0,.22-.01.33-.03.94-.18,1.56-1.1,1.38-2.04-.02-.1-.23-1.08-.96-2.42,1.64-1.41,4.54-1.48,5.65-1.39,4.16,1,7,2.9,8.45,5.66,2.48,4.73.21,10.64.19,10.69l-.03.08c-.19.47-2.36,5.54-9.42,6.64-.95.15-1.6,1.04-1.45,1.99.13.86.88,1.48,1.72,1.48.09,0,.18,0,.27-.02,5.39-.84,8.56-3.57,10.32-5.8,1.3,3.41,1.48,6.46.48,9.07Z"/>
              <text font-family="sans-serif" font-size="69" font-weight="700" transform="translate(80.97 64.17)"><tspan fill="var(--accent, #3875c8)" x="0" y="0">Think</tspan><tspan fill="var(--text-strong, #c9c7c7)" x="205.69" y="0">F</tspan><tspan fill="var(--text-strong, #c9c7c7)" x="248.12" y="0">l</tspan><tspan fill="var(--text-strong, #c9c7c7)" x="271.65" y="0">eet</tspan></text>
            </svg>
          </div>
        </div>

        ${renderStepIndicator(props.step)}

        ${props.step === 0 ? renderWelcome(props) : nothing}
        ${props.step === 1 ? renderModeSelection(props) : nothing}
        ${props.step === 2 ? configStep : nothing}
        ${props.step === 3 ? renderReview(props) : nothing}
      </div>
    </div>
  `;
}
