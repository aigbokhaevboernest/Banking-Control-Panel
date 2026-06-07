// Centralized transaction type → display label
const TX_LABELS: Record<string, string> = {
  wire_transfer: "Wire Transfer",
  wire: "Wire Transfer",
  transfer_out: "Local Transfer",
  local: "Local Transfer",
  fx: "FX Transfer",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  loan: "Loan",
  digital: "Digital Payment",
  digital_payment: "Digital Payment",
  transaction: "Transaction",
  transfer: "Transfer",
  transfer_in: "Incoming Transfer",
};

export function getTransactionLabel(type?: string | null): string {
  const key = String(type || "").toLowerCase();
  if (TX_LABELS[key]) return TX_LABELS[key];
  if (!type) return "Transaction";
  return String(type)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatTxDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
