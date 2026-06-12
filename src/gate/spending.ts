import type { ConstraintCheckResult, SpendingLimits } from "./types.js";

interface Spend {
  amount: number;
  at: number; // unix ms
}

/**
 * Tracks cumulative spend across sliding/whole windows: per-session (lifetime of
 * this gate instance) and per-day. Like the rate limiter, `check()` is read-only
 * and `record()` runs only after an ALLOW, so denied transfers never count.
 *
 * The spend log is serializable (`exportState`/`importState`) so it can be
 * committed to verifiable memory and restored on TEE restart — closing the
 * "restart to reset the spending counter" attack from the threat model.
 */
export class SpendingTracker {
  private session = 0;
  private day: Spend[] = [];

  constructor(private limits?: SpendingLimits) {}

  check(args: Record<string, unknown>, now: number): ConstraintCheckResult {
    if (!this.limits) return ok();
    const amount = Number(args.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return ok();

    if (this.limits.per_session != null && this.session + amount > this.limits.per_session) {
      return deny(
        `session spend ${this.session + amount} ${this.limits.currency} would exceed per_session cap ${this.limits.per_session}`,
      );
    }
    if (this.limits.per_day != null) {
      const today = this.sumDay(now) + amount;
      if (today > this.limits.per_day) {
        return deny(
          `24h spend ${today} ${this.limits.currency} would exceed per_day cap ${this.limits.per_day}`,
        );
      }
    }
    return ok();
  }

  record(args: Record<string, unknown>, now: number): void {
    const amount = Number(args.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.session += amount;
    this.day.push({ amount, at: now });
  }

  private sumDay(now: number): number {
    const cutoff = now - 86_400_000;
    while (this.day.length && this.day[0]!.at < cutoff) this.day.shift();
    return this.day.reduce((s, e) => s + e.amount, 0);
  }

  exportState(): { session: number; day: Spend[] } {
    return { session: this.session, day: [...this.day] };
  }

  importState(state: { session: number; day: Spend[] }): void {
    this.session = state.session;
    this.day = [...state.day];
  }
}

function ok(): ConstraintCheckResult {
  return { pass: true, reasonCode: "SPEND_OK", details: "" };
}
function deny(details: string): ConstraintCheckResult {
  return { pass: false, reasonCode: "SPENDING_LIMIT", details };
}
