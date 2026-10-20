import { useMemo } from "react";
import { useAccount } from "@/hooks/useAccount";

/**
 * One place that defines "the user's balance".
 *
 * Total = primary balance + every OPENED secondary account
 * (checking, savings, retirement). This is the same number the dashboard
 * hero card shows, so Cards, Wire and Local transfers now agree with it.
 */

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

export function getBalanceBreakdown(profile: any) {
  const own = num(profile?.balance);
  const checking = profile?.checking_opened === true ? num(profile?.checking_balance) : 0;
  const savings = profile?.savings_opened === true ? num(profile?.savings_balance) : 0;
  const retirement = profile?.retirement_opened === true ? num(profile?.retirement_balance) : 0;
  return {
    own,
    checking,
    savings,
    retirement,
    total: round2(own + checking + savings + retirement),
  };
}

/**
 * Works out how to take `amount` out of the total so the total drops by
 * exactly `amount`. Order: primary, then checking, savings, retirement.
 * Returns the profile columns to update, or ok:false if funds are short.
 */
export function planDeduction(profile: any, amount: number) {
  const b = getBalanceBreakdown(profile);
  if (!(amount > 0) || amount > b.total + 0.000001) {
    return { ok: false as const, patch: {} as Record<string, number> };
  }

  const buckets: Array<{ column: string; available: number }> = [
    { column: "balance", available: Math.max(b.own, 0) },
    { column: "checking_balance", available: b.checking },
    { column: "savings_balance", available: b.savings },
    { column: "retirement_balance", available: b.retirement },
  ];

  let remaining = amount;
  const patch: Record<string, number> = {};
  for (const bucket of buckets) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, bucket.available);
    if (take <= 0) continue;
    const current = num(profile?.[bucket.column]);
    patch[bucket.column] = round2(current - take);
    remaining = round2(remaining - take);
  }

  if (remaining > 0.005) return { ok: false as const, patch: {} as Record<string, number> };
  return { ok: true as const, patch };
}

export function useTotalBalance() {
  const { data: account } = useAccount();
  return useMemo(() => ({ account: account as any, ...getBalanceBreakdown(account) }), [account]);
}
