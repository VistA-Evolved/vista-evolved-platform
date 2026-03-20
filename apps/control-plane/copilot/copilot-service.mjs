// ---------------------------------------------------------------------------
// Copilot service — governed orchestrator for read-only + draft-only AI
// ---------------------------------------------------------------------------
// This is the main entry point. It manages the conversation loop:
// 1. Receives operator message
// 2. Sends to provider with tool definitions
// 3. If provider requests tool calls, executes them and returns results
// 4. Returns final response with audit trace
//
// Governed by: ai-assist-safety-spec.md, service-map §7
// ---------------------------------------------------------------------------

import { loadCopilotConfig } from './config.mjs';
import { createProvider } from './providers.mjs';
import { getAllTools, getToolDefinitionsForProvider, executeTool } from './tool-registry.mjs';
import { logCopilotEvent, getAuditLog, getAuditLogLength } from './audit.mjs';
import { SYSTEM_PROMPT } from './system-prompt.mjs';

// Register all tools on import
import './tools/index.mjs';

let config = null;
let provider = null;

/** Initialize copilot (called at server startup) */
export function initCopilot() {
  config = loadCopilotConfig();
  provider = createProvider(config);
  return {
    enabled: config.enabled,
    operational: config.isOperational,
    status: config.statusLabel,
    provider: provider.id,
    tools: getAllTools().map(t => t.name),
  };
}

/** Get current copilot status (for UX) */
export function getCopilotStatus() {
  if (!config) initCopilot();
  return {
    enabled: config.enabled,
    operational: config.isOperational,
    status: config.statusLabel,
    provider: provider.id,
    toolCount: getAllTools().length,
    tools: getAllTools().map(t => ({ name: t.name, category: t.category })),
    auditEntries: getAuditLogLength(),
  };
}

/**
 * Handle a copilot chat request.
 * @param {Object} options
 * @param {string} options.message — operator's message
 * @param {Array<{role:string,content:string}>} [options.history] — conversation history
 * @param {Object} options.toolContext — tool execution context
 * @returns {Promise<Object>} — copilot response
 */
export async function chat({ message, history = [], toolContext }) {
  if (!config) initCopilot();

  // Guard: copilot disabled
  if (!config.isOperational) {
    return {
      ok: false,
      content: '',
      reason: config.statusLabel,
      provider: provider.id,
    };
  }

  const startMs = Date.now();
  const messages = [...history, { role: 'user', content: message }];
  const tools = getToolDefinitionsForProvider();

  try {
    // First provider call
    let result = await provider.chat({
      systemPrompt: SYSTEM_PROMPT,
      messages,
      tools,
      config,
    });

    logCopilotEvent({
      type: 'chat',
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      ok: true,
      durationMs: Date.now() - startMs,
    });

    // Tool-call loop (max 5 rounds to prevent runaway)
    let rounds = 0;
    while (result.toolCalls && result.toolCalls.length > 0 && rounds < 5) {
      rounds += 1;
      const toolMessages = [];

      for (const tc of result.toolCalls) {
        const toolStartMs = Date.now();
        const toolResult = await executeTool(tc.name, tc.arguments, toolContext);

        logCopilotEvent({
          type: 'tool-call',
          toolName: tc.name,
          toolCategory: toolResult.category || 'unknown',
          ok: toolResult.ok,
          error: toolResult.error,
          durationMs: Date.now() - toolStartMs,
        });

        toolMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult.ok ? toolResult.result : { error: toolResult.error }),
        });
      }

      // Send tool results back to provider
      const updatedMessages = [
        ...messages,
        { role: 'assistant', content: result.content || null, tool_calls: result.toolCalls.map(tc => ({
          id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })) },
        ...toolMessages,
      ];

      result = await provider.chat({
        systemPrompt: SYSTEM_PROMPT,
        messages: updatedMessages,
        tools,
        config,
      });

      logCopilotEvent({
        type: 'chat',
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        ok: true,
        durationMs: Date.now() - startMs,
      });
    }

    return {
      ok: true,
      content: result.content || '',
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      toolRounds: rounds,
    };
  } catch (err) {
    logCopilotEvent({
      type: 'error',
      provider: provider.id,
      error: err.message,
      durationMs: Date.now() - startMs,
      ok: false,
    });
    return {
      ok: false,
      content: '',
      error: err.message,
      provider: provider.id,
    };
  }
}

/** Get copilot audit log */
export { getAuditLog };
