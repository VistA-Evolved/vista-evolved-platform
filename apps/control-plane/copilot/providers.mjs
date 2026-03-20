// ---------------------------------------------------------------------------
// Copilot provider interface + implementations
// ---------------------------------------------------------------------------
// Provider-neutral: copilot-service.mjs calls provider.chat() without
// knowing the underlying LLM. Adapters implement the CopilotProvider shape.
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CopilotProvider
 * @property {string} id — provider identifier
 * @property {(options: ChatOptions) => Promise<ChatResult>} chat
 */

/**
 * @typedef {Object} ChatOptions
 * @property {string} systemPrompt
 * @property {Array<{role:string, content:string}>} messages
 * @property {Array<Object>} tools — function-calling tool definitions
 * @property {Object} config — copilot config
 */

/**
 * @typedef {Object} ChatResult
 * @property {string} content — text response
 * @property {Array<{name:string, arguments:Object}>} [toolCalls] — requested tool calls
 * @property {string} provider — provider id
 * @property {string} model — model used
 * @property {Object} [usage] — token usage if available
 */

// ---- OpenAI adapter --------------------------------------------------------

function createOpenAIProvider(config) {
  return {
    id: 'openai',
    async chat({ systemPrompt, messages, tools }) {
      // Dynamic import so the module only loads when actually needed
      const endpoint = 'https://api.openai.com/v1/chat/completions';

      const body = {
        model: config.openaiModel,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      };

      if (tools && tools.length > 0) {
        body.tools = tools;
        body.tool_choice = 'auto';
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`OpenAI API error ${resp.status}: ${text.substring(0, 200)}`);
      }

      const data = await resp.json();
      const choice = data.choices?.[0];
      if (!choice) throw new Error('No choices in OpenAI response');

      const toolCalls = (choice.message?.tool_calls || []).map(tc => ({
        id: tc.id,
        name: tc.function?.name,
        arguments: JSON.parse(tc.function?.arguments || '{}'),
      }));

      return {
        content: choice.message?.content || '',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        provider: 'openai',
        model: data.model || config.openaiModel,
        usage: data.usage || undefined,
      };
    },
  };
}

// ---- Stub adapter (for testing without real provider) -----------------------

function createStubProvider() {
  return {
    id: 'stub',
    async chat({ messages }) {
      const lastMessage = messages[messages.length - 1]?.content || '';
      return {
        content: `[STUB PROVIDER] This is a stub response for testing. The copilot received: "${lastMessage.substring(0, 100)}". In production, configure COPILOT_PROVIDER=openai with valid credentials.`,
        provider: 'stub',
        model: 'stub-v1',
      };
    },
  };
}

// ---- Disabled provider (honest "not configured" behavior) ------------------

function createDisabledProvider(statusLabel) {
  return {
    id: 'disabled',
    async chat() {
      return {
        content: '',
        provider: 'disabled',
        model: 'none',
        disabledReason: statusLabel,
      };
    },
  };
}

// ---- Factory ----------------------------------------------------------------

/**
 * Creates the appropriate provider based on config.
 * Returns a disabled provider with honest status when not operational.
 */
export function createProvider(config) {
  if (!config.enabled) {
    return createDisabledProvider('disabled');
  }
  if (config.provider === 'openai' && config.openaiApiKey) {
    return createOpenAIProvider(config);
  }
  if (config.provider === 'stub') {
    return createStubProvider();
  }
  return createDisabledProvider(config.statusLabel);
}
