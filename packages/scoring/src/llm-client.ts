/**
 * Unified LLM client. Picks Anthropic or OpenAI based on env vars.
 * Both providers return the same shape: structured JSON parsed against a schema.
 *
 * Selection:
 *   - OPENAI_API_KEY set        → OpenAI (or OpenAI-compatible proxy via OPENAI_BASE_URL)
 *   - ANTHROPIC_API_KEY set     → Anthropic
 *   - neither                   → null (caller falls back to rule-only)
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type LLMProvider = "anthropic" | "openai" | null;

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMJsonRequest {
  messages: LLMMessage[];
  /** A JSON Schema (object) describing the response shape. */
  schema: Record<string, unknown>;
  /** Name of the schema — used in OpenAI's response_format. */
  schemaName: string;
  maxTokens?: number;
}

export function activeProvider(): LLMProvider {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function activeModel(): string {
  const p = activeProvider();
  if (p === "openai") return process.env.OPENAI_MODEL || "gpt-5.5";
  if (p === "anthropic") return "claude-haiku-4-5";
  return "(none)";
}

let cachedAnthropic: Anthropic | null = null;
let cachedOpenAI: OpenAI | null = null;

function hapHeaders(): Record<string, string> {
  // When the runtime points at hap-proxy, propagate a stable client ID so
  // each agent gets its own quota bucket. No-op if HAP_CLIENT_ID is unset.
  const id = process.env.HAP_CLIENT_ID;
  return id ? { "X-HAP-Client-Id": id } : {};
}

function anthropicClient(): Anthropic {
  if (!cachedAnthropic) {
    const baseURL = process.env.ANTHROPIC_BASE_URL || undefined;
    cachedAnthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      ...(baseURL ? { baseURL } : {}),
      defaultHeaders: hapHeaders(),
    });
  }
  return cachedAnthropic;
}

function openaiClient(): OpenAI {
  if (!cachedOpenAI) {
    const baseURL = process.env.OPENAI_BASE_URL || undefined;
    cachedOpenAI = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      ...(baseURL ? { baseURL } : {}),
      defaultHeaders: hapHeaders(),
    });
  }
  return cachedOpenAI;
}

/**
 * Run a single LLM call expecting JSON output that conforms to `schema`.
 * Returns the parsed object, or null on any error / no provider configured.
 */
export async function callLLMJson<T = unknown>(req: LLMJsonRequest): Promise<T | null> {
  const provider = activeProvider();
  if (!provider) return null;

  try {
    if (provider === "openai") {
      const client = openaiClient();
      const model = process.env.OPENAI_MODEL || "gpt-5.5";
      const resp = await client.chat.completions.create({
        model,
        max_tokens: req.maxTokens ?? 1500,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        response_format: {
          type: "json_schema",
          json_schema: {
            name: req.schemaName,
            schema: req.schema,
            strict: true,
          },
        },
      });
      const text = resp.choices[0]?.message?.content;
      if (!text) return null;
      return JSON.parse(text) as T;
    }

    // anthropic path
    const anthropic = anthropicClient();
    const systemMsgs = req.messages.filter((m) => m.role === "system");
    const conversation = req.messages.filter((m) => m.role !== "system");
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: req.maxTokens ?? 1500,
      system:
        systemMsgs.length > 0
          ? systemMsgs.map((m, idx) => ({
              type: "text" as const,
              text: m.content,
              ...(idx === systemMsgs.length - 1
                ? { cache_control: { type: "ephemeral" as const } }
                : {}),
            }))
          : undefined,
      messages: conversation.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      // @ts-expect-error — output_config supported on Haiku 4.5
      output_config: {
        format: {
          type: "json_schema",
          schema: req.schema,
        },
      },
    });
    const firstText = resp.content.find((b) => b.type === "text");
    if (!firstText || firstText.type !== "text") return null;
    return JSON.parse(firstText.text) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[llm-client] ${provider} call failed: ${msg.slice(0, 300)}`);
    return null;
  }
}
