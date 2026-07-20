/** Moonshot Kimi pricing (USD per 1M tokens), flat across the context window. */
export const AI_PRICING = {
  "kimi-k3": {
    inputCacheHitPerM: 0.3,
    inputCacheMissPerM: 3.0,
    outputPerM: 15.0,
  },
  // K2.6 runs non-thinking here (A/B comparison model); cache-hit rate approximate.
  "kimi-k2.6": {
    inputCacheHitPerM: 0.16,
    inputCacheMissPerM: 0.95,
    outputPerM: 4.0,
  },
} as const;

export type AiModel = keyof typeof AI_PRICING;

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  /** When absent, cost math treats all prompt tokens as cache-miss (conservative). */
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
}

export interface CallMetrics {
  label: string;
  model: AiModel;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_cache_hit_tokens: number;
  prompt_cache_miss_tokens: number;
  cost_usd: number;
  ttft_ms: number | null;
  latency_ms: number;
  tokens_per_second: number;
  /** Completion tokens / seconds after first token (null if no TTFT). */
  decode_tokens_per_second: number | null;
}

export interface SuiteTotals {
  suite_call_count: number;
  suite_total_prompt_tokens: number;
  suite_total_completion_tokens: number;
  suite_total_tokens: number;
  suite_total_cost_usd: number;
  /** Sum of per-call latencies — model time, excludes test overhead. */
  suite_total_latency_ms: number;
  ttft_ms_min: number | null;
  ttft_ms_avg: number | null;
  ttft_ms_max: number | null;
  tokens_per_second_avg: number | null;
}

export function costUsd(usage: TokenUsage, model: AiModel = "kimi-k3"): number {
  const rates = AI_PRICING[model];
  let hit = usage.prompt_cache_hit_tokens;
  let miss = usage.prompt_cache_miss_tokens;
  if (hit === undefined || miss === undefined) {
    hit = 0;
    miss = usage.prompt_tokens;
  }
  return (
    (hit / 1e6) * rates.inputCacheHitPerM +
    (miss / 1e6) * rates.inputCacheMissPerM +
    (usage.completion_tokens / 1e6) * rates.outputPerM
  );
}

export function buildCallMetrics(input: {
  label: string;
  model?: AiModel;
  usage: TokenUsage;
  latency_ms: number;
  ttft_ms?: number | null;
}): CallMetrics {
  const model = input.model ?? "kimi-k3";
  const usage = input.usage;
  const hit = usage.prompt_cache_hit_tokens ?? 0;
  const miss =
    usage.prompt_cache_miss_tokens ??
    (usage.prompt_cache_hit_tokens === undefined ? usage.prompt_tokens : Math.max(0, usage.prompt_tokens - hit));
  const latency_s = Math.max(input.latency_ms, 1) / 1000;
  const ttft = input.ttft_ms ?? null;
  const afterTtft_s =
    ttft !== null && input.latency_ms > ttft ? (input.latency_ms - ttft) / 1000 : null;

  return {
    label: input.label,
    model,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens || usage.prompt_tokens + usage.completion_tokens,
    prompt_cache_hit_tokens: hit,
    prompt_cache_miss_tokens: miss,
    cost_usd: costUsd({ ...usage, prompt_cache_hit_tokens: hit, prompt_cache_miss_tokens: miss }, model),
    ttft_ms: ttft,
    latency_ms: input.latency_ms,
    tokens_per_second: usage.completion_tokens / latency_s,
    decode_tokens_per_second:
      afterTtft_s && afterTtft_s > 0 ? usage.completion_tokens / afterTtft_s : null,
  };
}

export function rollupSuiteTotals(calls: CallMetrics[]): SuiteTotals {
  const ttfts = calls.map((c) => c.ttft_ms).filter((t): t is number => t !== null);
  const tps = calls.map((c) => c.tokens_per_second);
  return {
    suite_call_count: calls.length,
    suite_total_prompt_tokens: calls.reduce((s, c) => s + c.prompt_tokens, 0),
    suite_total_completion_tokens: calls.reduce((s, c) => s + c.completion_tokens, 0),
    suite_total_tokens: calls.reduce((s, c) => s + c.total_tokens, 0),
    suite_total_cost_usd: calls.reduce((s, c) => s + c.cost_usd, 0),
    suite_total_latency_ms: calls.reduce((s, c) => s + c.latency_ms, 0),
    ttft_ms_min: ttfts.length ? Math.min(...ttfts) : null,
    ttft_ms_avg: ttfts.length ? ttfts.reduce((a, b) => a + b, 0) / ttfts.length : null,
    ttft_ms_max: ttfts.length ? Math.max(...ttfts) : null,
    tokens_per_second_avg: tps.length ? tps.reduce((a, b) => a + b, 0) / tps.length : null,
  };
}

export function formatSuiteCostLine(totals: SuiteTotals): string {
  return `Suite total cost: $${totals.suite_total_cost_usd.toFixed(6)} (${totals.suite_call_count} calls, ${totals.suite_total_tokens} tokens, ${(totals.suite_total_latency_ms / 1000).toFixed(1)}s model time)`;
}
