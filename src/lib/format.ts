export const fmtMoney = (n: number | null | undefined, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(
      Number(n ?? 0)
    );
  } catch {
    return `${currency || ""} ${Number(n ?? 0).toLocaleString()}`;
  }
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
