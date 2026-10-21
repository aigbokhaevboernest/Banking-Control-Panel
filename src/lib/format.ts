/**
 * Money formatting — keep identical to formatMoney in the user app
 * (src/hooks/useAccount.tsx) so balances read the same everywhere.
 * Fixed "en-US" locale so amounts always read 11,000.00.
 * USD / EUR / GBP / JPY get a clean symbol ($, €, £, ¥).
 * Every other currency (CHF, CAD, AUD, ...) shows CODE + amount so
 * different dollar currencies are never confused with each other.
 */
const SYMBOL_CURRENCIES = new Set(["USD", "EUR", "GBP", "JPY"]);

export const fmtMoney = (n: number | null | undefined, currency = "USD") => {
  const code = (currency || "USD").toUpperCase();
  const value = Number(n ?? 0) || 0;
  const digits = code === "JPY" ? 0 : 2;

  if (SYMBOL_CURRENCIES.has(code)) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
    } catch {
      // fall through to code + number
    }
  }

  const num = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${value < 0 ? "-" : ""}${code} ${num}`;
};

export const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const fullName = (
  u: { first_name?: string | null; last_name?: string | null; full_name?: string | null; email?: string | null } | null | undefined
) => {
  if (!u) return "Unnamed";
  const fn = `${u.first_name || ""} ${u.last_name || ""}`.trim();
  return fn || u.full_name || u.email || "Unnamed";
};
