// ---------------------------------------------------------------------------
// Copilot configuration — disabled by default, provider-neutral
// ---------------------------------------------------------------------------
// Governed by: docs/explanation/ai-assist-safety-spec.md
//              docs/explanation/control-plane-service-map-and-operator-console-architecture.md §7
// ---------------------------------------------------------------------------

/**
 * Reads copilot configuration from environment variables.
 * Returns a frozen config object.
 *
 * COPILOT_ENABLED      — "true" to enable copilot features (default: false)
 * COPILOT_PROVIDER      — provider id: "openai" | "stub" (default: none)
 * OPENAI_API_KEY         — required when COPILOT_PROVIDER=openai
 * OPENAI_MODEL           — model id (default: "gpt-4o")
 * COPILOT_MAX_TOKENS     — max response tokens (default: 2048)
 * COPILOT_TEMPERATURE    — sampling temperature (default: 0.2)
 */
export function loadCopilotConfig() {
  const enabled = process.env.COPILOT_ENABLED === 'true';
  const provider = process.env.COPILOT_PROVIDER || '';
  const openaiApiKey = process.env.OPENAI_API_KEY || '';
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';
  const maxTokens = parseInt(process.env.COPILOT_MAX_TOKENS || '2048', 10) || 2048;
  const temperature = parseFloat(process.env.COPILOT_TEMPERATURE || '0.2') || 0.2;

  return Object.freeze({
    enabled,
    provider,
    openaiApiKey,
    openaiModel,
    maxTokens,
    temperature,

    /** True only when enabled AND a valid provider+credentials exist */
    get isOperational() {
      if (!enabled) return false;
      if (provider === 'openai' && openaiApiKey) return true;
      if (provider === 'stub') return true;
      return false;
    },

    /** Human-readable status for UX */
    get statusLabel() {
      if (!enabled) return 'disabled';
      if (!provider) return 'no-provider-configured';
      if (provider === 'openai' && !openaiApiKey) return 'missing-credentials';
      if (this.isOperational) return 'operational';
      return 'unknown-provider';
    },
  });
}
