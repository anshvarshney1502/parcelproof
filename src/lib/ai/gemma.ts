import { GoogleGenAI, ApiError } from "@google/genai";
import { config } from "../env";

export class ModelError extends Error {
  constructor(message: string, public kind: "rate_limit" | "unavailable" | "timeout" | "bad_output" | "provider", public transient: boolean) {
    super(message);
  }
}

export interface ModelClient {
  modelId: string;
  generate(prompt: string): Promise<string>;
}

const TIMEOUT_MS = 120_000;

/** The configured Gemma model on Google's hosted API. There is deliberately no fallback to another model. */
export function gemmaClient(): ModelClient {
  const { apiKey, modelId } = config.gemma();
  if (!/^gemma-/i.test(modelId)) throw new ModelError(`GEMMA_MODEL_ID must be a Gemma model (got "${modelId}").`, "unavailable", false);
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } });
  return {
    modelId,
    async generate(prompt) {
      try {
        const res = await ai.models.generateContent({
          model: modelId,
          contents: prompt,
          config: { temperature: 0.1, maxOutputTokens: 8192 },
        });
        const text = res.text;
        if (!text) throw new ModelError("The model returned an empty response.", "bad_output", true);
        return text;
      } catch (e) {
        throw toModelError(e, modelId);
      }
    },
  };
}

export function toModelError(e: unknown, modelId: string): ModelError {
  if (e instanceof ModelError) return e;
  if (e instanceof ApiError) {
    if (e.status === 429) return new ModelError("The Gemma API rate limit or free quota was reached. Try again later.", "rate_limit", true);
    if (e.status === 404 || e.status === 403)
      return new ModelError(`The model "${modelId}" is not available to this API key (HTTP ${e.status}).`, "unavailable", false);
    if (e.status === 400) return new ModelError("The Gemma API rejected the request (HTTP 400).", "provider", false);
    if (e.status >= 500) return new ModelError(`The Gemma API had a temporary error (HTTP ${e.status}).`, "provider", true);
  }
  const msg = e instanceof Error ? e.message : "";
  if (/timeout|timed out|abort/i.test(msg)) return new ModelError("The Gemma request timed out.", "timeout", true);
  return new ModelError("The Gemma request failed.", "provider", true);
}

/** Extracts the JSON object from a model reply. Tolerates code fences and leading prose, nothing more. */
export function parseJsonReply(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) throw new ModelError("The model reply did not contain JSON.", "bad_output", true);
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    throw new ModelError("The model reply was not valid JSON.", "bad_output", true);
  }
}
