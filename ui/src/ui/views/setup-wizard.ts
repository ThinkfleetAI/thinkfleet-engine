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
  saasGatewayToken: string;
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
  onSetSaasGatewayToken: (token: string) => void;
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
        <label class="wizard__label">Gateway Token</label>
        <input
          class="wizard__input"
          type="password"
          placeholder="Gateway authentication token"
          .value=${props.saasGatewayToken}
          @input=${(e: Event) => props.onSetSaasGatewayToken((e.target as HTMLInputElement).value)}
        />
      </div>

      <div style="text-align:center">
        <button
          class="wizard__test-btn"
          ?disabled=${!props.saasApiUrl || !props.saasAgentDbId || props.saasTesting}
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
          <div class="wizard__logo">ThinkFleet Engine</div>
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
