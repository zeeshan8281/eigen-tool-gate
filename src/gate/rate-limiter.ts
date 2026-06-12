import type { ConstraintCheckResult, RateLimits } from "./types.js";

interface Window {
  windowMs: number;
  limit: number;
  /** Timestamps (unix ms) of recent calls, pruned lazily. */
  hits: number[];
}

/**
 * Sliding-window rate limiter. Tracks per-tool windows (from a rule's
 * `max_calls_per_minute`) and two global windows (per-minute, per-hour).
 *
 * `check()` is read-only (no mutation) so the gate can deny without recording a
 * "hit"; `record()` is called only after a call is ALLOWed. Splitting the two
 * keeps denied calls from consuming the budget they were denied for.
 */
export class RateLimiter {
  private perTool = new Map<string, Window>();
  private globalMinute?: Window;
  private globalHour?: Window;

  constructor(global?: RateLimits) {
    if (global?.global_max_calls_per_minute != null) {
      this.globalMinute = { windowMs: 60_000, limit: global.global_max_calls_per_minute, hits: [] };
    }
    if (global?.global_max_calls_per_hour != null) {
      this.globalHour = { windowMs: 3_600_000, limit: global.global_max_calls_per_hour, hits: [] };
    }
  }

  registerToolLimit(tool: string, maxPerMinute: number): void {
    if (!this.perTool.has(tool)) {
      this.perTool.set(tool, { windowMs: 60_000, limit: maxPerMinute, hits: [] });
    }
  }

  check(tool: string, now: number): ConstraintCheckResult {
    const windows: Array<[Window | undefined, string]> = [
      [this.perTool.get(tool), `tool "${tool}"`],
      [this.globalMinute, "global per-minute"],
      [this.globalHour, "global per-hour"],
    ];
    for (const [w, label] of windows) {
      if (!w) continue;
      const count = countWithin(w, now);
      if (count >= w.limit) {
        return {
          pass: false,
          reasonCode: "RATE_LIMIT",
          details: `${label} rate limit of ${w.limit} per ${Math.round(w.windowMs / 1000)}s exceeded`,
        };
      }
    }
    return { pass: true, reasonCode: "RATE_OK", details: "" };
  }

  record(tool: string, now: number): void {
    this.perTool.get(tool)?.hits.push(now);
    this.globalMinute?.hits.push(now);
    this.globalHour?.hits.push(now);
  }

  /** Snapshot of counters, for committing to verifiable memory (Part 3). */
  snapshot(now: number): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [tool, w] of this.perTool) out[`tool:${tool}`] = countWithin(w, now);
    if (this.globalMinute) out["global:minute"] = countWithin(this.globalMinute, now);
    if (this.globalHour) out["global:hour"] = countWithin(this.globalHour, now);
    return out;
  }
}

function countWithin(w: Window, now: number): number {
  const cutoff = now - w.windowMs;
  // prune in place so memory does not grow unbounded
  while (w.hits.length && w.hits[0]! < cutoff) w.hits.shift();
  return w.hits.length;
}
