import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCallMetrics,
  costUsd,
  formatSuiteCostLine,
  rollupSuiteTotals,
} from "../lib/ai-metrics.ts";

test("costUsd uses cache hit/miss and output rates for kimi-k3", () => {
  const cost = costUsd({
    prompt_tokens: 1_000_000,
    completion_tokens: 1_000_000,
    total_tokens: 2_000_000,
    prompt_cache_hit_tokens: 500_000,
    prompt_cache_miss_tokens: 500_000,
  });
  // 0.5*0.30 + 0.5*3.00 + 1*15.00 = 0.15 + 1.5 + 15
  assert.ok(Math.abs(cost - 16.65) < 1e-9);
});

test("costUsd treats all prompt tokens as miss when cache split absent", () => {
  const cost = costUsd({
    prompt_tokens: 1_000_000,
    completion_tokens: 0,
    total_tokens: 1_000_000,
  });
  assert.equal(cost, 3);
});

test("buildCallMetrics and suite rollup include total cost", () => {
  const a = buildCallMetrics({
    label: "extract",
    usage: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100 },
    latency_ms: 2000,
    ttft_ms: 400,
  });
  const b = buildCallMetrics({
    label: "chat",
    usage: {
      prompt_tokens: 2000,
      completion_tokens: 50,
      total_tokens: 2050,
      prompt_cache_hit_tokens: 1500,
      prompt_cache_miss_tokens: 500,
    },
    latency_ms: 1000,
    ttft_ms: 200,
  });
  assert.equal(a.tokens_per_second, 50);
  assert.ok(a.decode_tokens_per_second !== null);
  const totals = rollupSuiteTotals([a, b]);
  assert.equal(totals.suite_call_count, 2);
  assert.equal(totals.suite_total_tokens, 3150);
  assert.equal(totals.suite_total_latency_ms, 3000);
  assert.equal(totals.suite_total_cost_usd, a.cost_usd + b.cost_usd);
  assert.equal(totals.ttft_ms_min, 200);
  assert.equal(totals.ttft_ms_max, 400);
  assert.match(formatSuiteCostLine(totals), /^Suite total cost: \$/);
});
