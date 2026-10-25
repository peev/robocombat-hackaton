import {
  setActiveAiRequests,
  setInferenceStats,
} from "@/lib/hardware/nvidia";

export interface InferenceResult {
  text: string;
  latencyMs: number;
  tokensPerSecond: number | null;
  provider: "ollama" | "openai-compatible" | "unavailable";
  model: string | null;
  realInference: boolean;
}

const OLLAMA_URL = process.env.LOCAL_LLM_URL ?? "http://127.0.0.1:11434";
const OPENAI_COMPAT_URL =
  process.env.LOCAL_OPENAI_COMPAT_URL ?? "http://127.0.0.1:8000/v1";
const MODEL = process.env.LOCAL_LLM_MODEL ?? "";

async function tryOllama(
  prompt: string,
  system: string
): Promise<InferenceResult | null> {
  const models = MODEL
    ? [MODEL]
    : ["llama3.2", "llama3.1", "mistral", "qwen2.5", "phi3"];
  for (const model of models) {
    try {
      const start = Date.now();
      setActiveAiRequests(1);
      const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          options: { temperature: 0.2, num_predict: 600 },
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        message?: { content?: string };
        eval_count?: number;
        eval_duration?: number;
      };
      const text = data.message?.content?.trim();
      if (!text) continue;
      const latencyMs = Date.now() - start;
      const tps =
        data.eval_count && data.eval_duration
          ? data.eval_count / (data.eval_duration / 1e9)
          : null;
      setInferenceStats(latencyMs, tps);
      return {
        text,
        latencyMs,
        tokensPerSecond: tps,
        provider: "ollama",
        model,
        realInference: true,
      };
    } catch {
      continue;
    } finally {
      setActiveAiRequests(0);
    }
  }
  return null;
}

async function tryOpenAiCompat(
  prompt: string,
  system: string
): Promise<InferenceResult | null> {
  try {
    const start = Date.now();
    setActiveAiRequests(1);
    const res = await fetch(`${OPENAI_COMPAT_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL || "local-model",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { completion_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    const latencyMs = Date.now() - start;
    const tps = data.usage?.completion_tokens
      ? data.usage.completion_tokens / (latencyMs / 1000)
      : null;
    setInferenceStats(latencyMs, tps);
    return {
      text,
      latencyMs,
      tokensPerSecond: tps,
      provider: "openai-compatible",
      model: MODEL || "local-model",
      realInference: true,
    };
  } catch {
    return null;
  } finally {
    setActiveAiRequests(0);
  }
}

export async function localInfer(
  prompt: string,
  system: string
): Promise<InferenceResult> {
  const ollama = await tryOllama(prompt, system);
  if (ollama) return ollama;
  const compat = await tryOpenAiCompat(prompt, system);
  if (compat) return compat;

  setInferenceStats(null, null);
  return {
    text: "",
    latencyMs: 0,
    tokensPerSecond: null,
    provider: "unavailable",
    model: null,
    realInference: false,
  };
}

export async function probeLocalInference(): Promise<{
  available: boolean;
  provider: string | null;
  model: string | null;
  detail: string;
}> {
  const result = await localInfer(
    'Reply with exactly: {"ok":true}',
    "You are a connectivity probe. Reply with JSON only."
  );
  if (!result.realInference) {
    return {
      available: false,
      provider: null,
      model: null,
      detail:
        "No local LLM endpoint responded. Set LOCAL_LLM_URL / LOCAL_LLM_MODEL or start Ollama. Do not download large models without approval.",
    };
  }
  return {
    available: true,
    provider: result.provider,
    model: result.model,
    detail: `Local inference OK via ${result.provider} (${result.model}) in ${result.latencyMs}ms`,
  };
}
