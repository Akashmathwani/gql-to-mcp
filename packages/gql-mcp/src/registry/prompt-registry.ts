import { ConfigError } from '../types/index.js';

/**
 * Prompt registry — in-memory store for MCP Prompts.
 *
 * Prompts are server-managed, parameterised message templates.
 * They let the server expose reusable workflow starters — the agent calls
 * prompts/get by name, passes arguments, and gets back a ready-to-use
 * message sequence to seed its context.
 *
 * MCP protocol primitives handled here:
 *   prompts/list  → listPrompts()
 *   prompts/get   → getPrompt(name, args)
 *
 * Examples in our platform:
 *   investigate_ticket   — ZenAI investigation workflow starter
 *   onboard_service      — Developer Onboarding Agent workflow
 *   debug_alert          — New Relic alert investigation framing
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A registered MCP prompt definition.
 *
 * name        — unique identifier, used in prompts/get calls
 * description — shown to the LLM to help it decide when to use this prompt
 * arguments   — declared parameters the prompt accepts
 * render()    — called with resolved args; returns the message sequence
 */
export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: PromptArgument[];
  render(args: PromptArgs): Promise<PromptMessage[]> | PromptMessage[];
}

/**
 * A declared prompt argument — shown to the client in prompts/list.
 */
export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * Resolved argument values passed to render().
 */
export type PromptArgs = Record<string, string>;

/**
 * A single message in the rendered prompt sequence.
 * role     — 'user' or 'assistant' (matches MCP spec)
 * content  — text content of the message
 */
export interface PromptMessage {
  role: 'user' | 'assistant';
  content: { type: 'text'; text: string };
}

/**
 * MCP prompts/list item format.
 */
export interface PromptListEntry {
  name: string;
  description: string;
  arguments?: PromptArgument[];
}

/**
 * MCP prompts/get response format.
 */
export interface PromptGetResult {
  description: string;
  messages: PromptMessage[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export class PromptRegistry {
  private readonly prompts = new Map<string, PromptDefinition>();

  // ─────────────────────────────────────────────────────────────────────────
  // Registration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a prompt.
   * Name must be unique — throws on duplicate.
   */
  register(prompt: PromptDefinition): void {
    if (this.prompts.has(prompt.name)) {
      throw new ConfigError(`Duplicate prompt name: "${prompt.name}"`);
    }
    this.validateArguments(prompt);
    this.prompts.set(prompt.name, prompt);
  }

  /**
   * Register multiple prompts at once.
   */
  registerAll(prompts: PromptDefinition[]): void {
    for (const prompt of prompts) {
      this.register(prompt);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MCP protocol — prompts/list
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * All registered prompts in MCP list format.
   * Returned directly in the prompts/list response.
   */
  listPrompts(): PromptListEntry[] {
    return Array.from(this.prompts.values()).map((p) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MCP protocol — prompts/get
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Render a prompt by name with provided arguments.
   *
   * Validates that all required arguments are present before calling render().
   * Returns null if no prompt with this name is registered.
   */
  async getPrompt(name: string, args: PromptArgs = {}): Promise<PromptGetResult | null> {
    const prompt = this.prompts.get(name);
    if (!prompt) return null;

    this.validateRequiredArgs(prompt, args);

    const messages = await prompt.render(args);

    return {
      description: prompt.description,
      messages,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Introspection
  // ─────────────────────────────────────────────────────────────────────────

  hasPrompt(name: string): boolean {
    return this.prompts.has(name);
  }

  getPromptCount(): number {
    return this.prompts.size;
  }

  clear(): void {
    this.prompts.clear();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validate argument definitions at registration time.
   * Catches duplicate argument names before they cause subtle runtime bugs.
   */
  private validateArguments(prompt: PromptDefinition): void {
    const args = prompt.arguments ?? [];
    const seen = new Set<string>();

    for (const arg of args) {
      if (seen.has(arg.name)) {
        throw new ConfigError(`Prompt "${prompt.name}" has duplicate argument: "${arg.name}"`);
      }
      seen.add(arg.name);
    }
  }

  /**
   * Validate that all required arguments are present in the call.
   * Throws a descriptive error so the agent gets useful feedback.
   */
  private validateRequiredArgs(prompt: PromptDefinition, args: PromptArgs): void {
    const required = (prompt.arguments ?? []).filter((a) => a.required);
    const missing = required.filter((a) => !(a.name in args));

    if (missing.length > 0) {
      const names = missing.map((a) => `"${a.name}"`).join(', ');
      throw new Error(`Prompt "${prompt.name}" missing required arguments: ${names}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder helper — fluent API for constructing prompts
// Useful for multi-turn prompts that compose several messages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a PromptMessage array fluently.
 *
 * @example
 * const messages = promptBuilder()
 *   .user(`Investigate this Zendesk ticket: ${args.ticketId}`)
 *   .assistant('I will start by fetching the ticket details and recent errors.')
 *   .user('Focus on errors from the last 2 hours.')
 *   .build();
 */
export function promptBuilder(): PromptBuilder {
  return new PromptBuilder();
}

class PromptBuilder {
  private readonly messages: PromptMessage[] = [];

  user(text: string): this {
    this.messages.push({ role: 'user', content: { type: 'text', text } });
    return this;
  }

  assistant(text: string): this {
    this.messages.push({ role: 'assistant', content: { type: 'text', text } });
    return this;
  }

  build(): PromptMessage[] {
    return [...this.messages];
  }
}
