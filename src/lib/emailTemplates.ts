const FOOTER =
  "\n\nFor more information or complaints, please contact support@flexiqverve.com or make use of the Live Chat on your dashboard for assistance.\n\nKind Regards,\nFlexiq Verve Support Team";

const money = (currency: string | null | undefined, amount: number | null | undefined) =>
  `${currency || "USD"} ${Number(amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type EmailTemplate = { subject: string; message: string };

type Status = "approved" | "completed" | "failed" | "rejected" | "pending" | "processing" | string;

const normalize = (s: Status): "approved" | "failed" | "pending" | "processing" | "rejected" => {
  const v = String(s).toLowerCase();
  if (v === "completed" || v === "approved") return "approved";
  if (v === "failed") return "failed";
  if (v === "rejected") return "rejected";
  if (v === "processing") return "processing";
  return "pending";
};

export function wireTransferEmail(
  status: Status,
  currency: string | null | undefined,
  amount: number | null | undefined,
  recipient: string | null | undefined,
): EmailTemplate {
  const amt = money(currency, amount);
  const rec = recipient || "the recipient";
  switch (normalize(status)) {
    case "approved":
      return { subject: "Wire Transfer Approved", message: `Your international wire transfer of ${amt} to ${rec} has been approved and is currently being processed. Funds should reflect within 1–3 business days.${FOOTER}` };
    case "failed":
      return { subject: "Wire Transfer Failed", message: `Unfortunately, your international wire transfer of ${amt} to ${rec} has failed.${FOOTER}` };
    case "processing":
      return { subject: "Wire Transfer Processing", message: `Your international wire transfer of ${amt} to ${rec} is currently being processed. Please allow 1–3 business days for completion.${FOOTER}` };
    default:
      return { subject: "Wire Transfer Pending Review", message: `Your international wire transfer of ${amt} to ${rec} is currently pending review by our team. You will be notified once it is processed.${FOOTER}` };
  }
}

export function localTransferEmail(
  status: Status,
  currency: string | null | undefined,
  amount: number | null | undefined,
  recipient: string | null | undefined,
): EmailTemplate {
  const amt = money(currency, amount);
  const rec = recipient || "the recipient";
  switch (normalize(status)) {
    case "approved":
      return { subject: "Local Transfer Approved", message: `Your local transfer of ${amt} to ${rec} has been approved and is being processed.${FOOTER}` };
    case "failed":
      return { subject: "Local Transfer Failed", message: `Unfortunately, your local transfer of ${amt} to ${rec} has failed.${FOOTER}` };
    case "processing":
      return { subject: "Local Transfer Processing", message: `Your local transfer of ${amt} to ${rec} is currently being processed.${FOOTER}` };
    default:
      return { subject: "Local Transfer Pending Review", message: `Your local transfer of ${amt} to ${rec} is pending review by our team.${FOOTER}` };
  }
}

export function loanDisbursementEmail(
  status: Status,
  currency: string | null | undefined,
  amount: number | null | undefined,
): EmailTemplate {
  const amt = money(currency, amount);
  switch (normalize(status)) {
    case "approved":
      return { subject: "Loan Disbursement Approved", message: `Your loan disbursement of ${amt} has been approved and credited to your account.${FOOTER}` };
    case "failed":
      return { subject: "Loan Disbursement Failed", message: `Your loan disbursement of ${amt} has failed.${FOOTER}` };
    case "processing":
      return { subject: "Loan Disbursement Processing", message: `Your loan disbursement of ${amt} is currently being processed.${FOOTER}` };
    default:
      return { subject: "Loan Disbursement Pending", message: `Your loan disbursement of ${amt} is pending review by our team.${FOOTER}` };
  }
}

export function generalTransactionEmail(
  status: Status,
  currency: string | null | undefined,
  amount: number | null | undefined,
): EmailTemplate {
  const amt = money(currency, amount);
  switch (normalize(status)) {
    case "approved":
      return { subject: "Transaction Approved", message: `Your transaction of ${amt} has been approved and completed successfully.${FOOTER}` };
    case "failed":
      return { subject: "Transaction Failed", message: `Your transaction of ${amt} has failed.${FOOTER}` };
    case "processing":
      return { subject: "Transaction Processing", message: `Your transaction of ${amt} is currently being processed.${FOOTER}` };
    default:
      return { subject: "Transaction Pending Review", message: `Your transaction of ${amt} is pending review by our team.${FOOTER}` };
  }
}

export function transactionEmail(
  status: Status,
  tx: { type?: string | null; description?: string | null; currency?: string | null; amount?: number | null; recipient?: string | null; recipient_name?: string | null },
): EmailTemplate {
  const d = `${tx.description || ""} ${tx.type || ""}`.toLowerCase();
  const rec = tx.recipient_name || tx.recipient || null;
  const isLocal = d.includes("local");
  const isLoan = d.includes("loan");
  const isWire = d.includes("wire") || d.includes("international") || d.includes("fx");

  if (isLocal) return localTransferEmail(status, tx.currency, tx.amount, rec);
  if (isLoan) return loanDisbursementEmail(status, tx.currency, tx.amount);
  if (isWire) return wireTransferEmail(status, tx.currency, tx.amount, rec);
  return generalTransactionEmail(status, tx.currency, tx.amount);
}

export function digitalPaymentEmail(
  status: Status,
  platform: string | null | undefined,
  currency: string | null | undefined,
  amount: number | null | undefined,
): EmailTemplate {
  const amt = money(currency, amount);
  const plat = platform || "Digital";
  switch (normalize(status)) {
    case "approved":
      return { subject: "Payment Approved", message: `Your ${plat} payment of ${amt} has been approved and completed successfully.${FOOTER}` };
    case "failed":
      return { subject: "Payment Failed", message: `Your ${plat} payment of ${amt} has failed.${FOOTER}` };
    case "processing":
      return { subject: "Payment Processing", message: `Your ${plat} payment of ${amt} is currently being processed.${FOOTER}` };
    default:
      return { subject: "Payment Pending Review", message: `Your ${plat} payment of ${amt} is pending review.${FOOTER}` };
  }
}

export function accountStatusEmail(
  status: "active" | "frozen" | "blocked" | string,
): EmailTemplate {
  const s = String(status).toLowerCase();
  if (s === "active") {
    return { subject: "Account Activated", message: `Your Flexiq Verve account has been successfully activated. You now have full access to all features on your dashboard.${FOOTER}` };
  }
  if (s === "frozen") {
    return { subject: "Account Frozen", message: `Your Flexiq Verve account has been temporarily frozen. You will not be able to perform any transactions until your account is reactivated.${FOOTER}` };
  }
  return { subject: "Account Blocked", message: `Your Flexiq Verve account has been blocked.${FOOTER}` };
}

export function kycEmail(status: "approved" | "rejected" | string, reason?: string): EmailTemplate {
  if (String(status).toLowerCase() === "approved") {
    return { subject: "KYC Verification Approved", message: `Your identity verification (KYC) has been successfully approved. You now have full verified access to your Flexiq Verve account.${FOOTER}` };
  }
  return { subject: "KYC Verification Rejected", message: `Your identity verification (KYC) submission has been rejected. Reason: ${reason || "Not specified"}. Please resubmit with the correct documents to complete your verification.${FOOTER}` };
}

export function depositEmail(
  status: "approved" | "declined" | "rejected" | string,
  currency: string | null | undefined,
  amount: number | null | undefined,
): EmailTemplate {
  const amt = money(currency, amount);
  if (String(status).toLowerCase() === "approved") {
    return { subject: "Deposit Received", message: `Your deposit of ${amt} has been received and credited to your account.${FOOTER}` };
  }
  return { subject: "Deposit Declined", message: `Your deposit request of ${amt} has been declined. Please try again.${FOOTER}` };
}

export function loanStatusEmail(
  status: "approved" | "rejected" | string,
  currency: string | null | undefined,
  amount: number | null | undefined,
): EmailTemplate {
  const amt = money(currency, amount);
  if (String(status).toLowerCase() === "approved") {
    return { subject: "Loan Approved", message: `Congratulations! Your loan application of ${amt} has been approved. Please log in to your dashboard and enter your Loan Authorization Code to release your funds.${FOOTER}` };
  }
  return { subject: "Loan Application Rejected", message: `Unfortunately, your loan application of ${amt} has been rejected.${FOOTER}` };
}

export function loanCodeEmail(code: string): EmailTemplate {
  return {
    subject: "Your Loan Authorization Code — Flexiq Verve",
    message: `Your Loan Authorization Code:\n\n**${code}**\n\nEnter this code in your Flexiq Verve loan code gate to release your loan funds. Do not share this code with anyone for your security.${FOOTER}`,
  };
}

type CodeKind = "COT" | "TAX" | "ITC" | "IMF";

const CODE_META: Record<CodeKind, { subject: string; label: string }> = {
  COT: { subject: "Cost of Transfer (COT) Code — Flexiq Verve", label: "Cost of Transfer (COT) Code" },
  TAX: { subject: "Tax Clearance Code — Flexiq Verve", label: "Tax Clearance Code" },
  ITC: { subject: "International Transfer Code (ITC) — Flexiq Verve", label: "International Transfer Code (ITC)" },
  IMF: { subject: "International Monetary Fund (IMF) Code — Flexiq Verve", label: "International Monetary Fund (IMF) Code" },
};

export function withdrawalCodeEmail(type: CodeKind, code: string): EmailTemplate {
  const meta = CODE_META[type];
  const message = `You may use this ${meta.label} to continue your transaction.\n\nYour ${type} Code:\n\n**${code}**\n\nLogin to your account and enter this code to complete your withdrawal. Do not share this code with anyone for your security.${FOOTER}`;
  return { subject: meta.subject, message };
}

export function billingEmail(body: string, subject?: string): EmailTemplate {
  return {
    subject: subject || "Message from Flexiq Verve Support",
    message: `${String(body)}${FOOTER}`,
  };
}
