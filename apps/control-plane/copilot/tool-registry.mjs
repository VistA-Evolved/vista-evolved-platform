// ---------------------------------------------------------------------------
// Tool registry — bounded allowlist of operator-safe copilot tools
// ---------------------------------------------------------------------------
// Governed by: docs/explanation/ai-assist-safety-spec.md §7 (AI overlay rules)
// Each tool has: name, description, parameters schema, handler, category
// Categories: "read-only" | "draft-only"
// ---------------------------------------------------------------------------

/** @type {Map<string, ToolDefinition>} */
const registry = new Map();

/**
 * @typedef {Object} ToolDefinition
 * @property {string} name
 * @property {string} description
 * @property {'read-only'|'draft-only'} category
 * @property {Object} parameters — JSON Schema for tool parameters
 * @property {(params: any, context: ToolContext) => Promise<any>} handler
 */

/**
 * @typedef {Object} ToolContext
 * @property {string} backendUrl — real backend base URL
 * @property {Function} backendFetch — fetch helper for real backend
 * @property {Object} fixtures — fixture data for fallback
 * @property {Object} contractData — contract-backed data
 */

/** Register a tool in the bounded allowlist */
export function registerTool(definition) {
  if (!definition.name || !definition.handler || !definition.category) {
    throw new Error(`Tool registration requires name, handler, and category`);
  }
  if (definition.category !== 'read-only' && definition.category !== 'draft-only') {
    throw new Error(`Tool category must be "read-only" or "draft-only", got "${definition.category}"`);
  }
  registry.set(definition.name, Object.freeze(definition));
}

/** Get all registered tools (frozen copies) */
export function getAllTools() {
  return Array.from(registry.values());
}

/** Get tool by name */
export function getTool(name) {
  return registry.get(name) || null;
}

/** Execute a tool by name with params and context */
export async function executeTool(name, params, context) {
  const tool = registry.get(name);
  if (!tool) {
    return { ok: false, error: `Tool "${name}" is not in the allowed registry` };
  }
  try {
    const result = await tool.handler(params, context);
    return { ok: true, tool: name, category: tool.category, result };
  } catch (err) {
    return { ok: false, tool: name, error: err.message || 'Tool execution failed' };
  }
}

/** Get tool definitions formatted for LLM function-calling */
export function getToolDefinitionsForProvider() {
  return getAllTools().map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: `[${t.category}] ${t.description}`,
      parameters: t.parameters || { type: 'object', properties: {} },
    },
  }));
}
