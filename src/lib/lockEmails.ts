// Email templates for every locked-savings action. Each returns { subject, message }
// so it can be spread straight into sendEmail({ email, first_name, ...tpl }).

const money = (n: number, cur: string) =>
  `${cur} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const date = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const FOOTER = `For more information or complaints, please contact support@flexiqverve.com or make use of the Live Chat on your dashboard for assistance.

Kind Regards,
Flexiq Verve Support Team`;

export const lockCreatedEmail = (p: {
  name?: string | null; amount: number; currency: string; days: number;
  rate: number; interest: number; maturityAt: string; ref: string;
}) => ({
  subject: "Funds Locked Successfully — Flexiq Verve",
  message:
`Your funds have been locked successfully.

${p.name ? `Goal: ${p.name}\n` : ""}Amount locked: ${money(p.amount, p.currency)}
Period: ${p.days} days at ${p.rate}% p.a.
Interest at maturity: ${money(p.interest, p.currency)}
Unlock date: ${date(p.maturityAt)}
${p.ref ? `Reference: ${p.ref}\n` : ""}
Your principal and interest will be returned to your account automatically on the unlock date. Breaking the lock early forfeits the interest and requires an unlock code from our support team.

${FOOTER}`,
});

export const lockCodeEmail = (p: { code: string; ref: string; amount: number; currency: string }) => ({
  subject: "Your Lock Unlock Code — Flexiq Verve",
  message:
`Your unlock code for the locked funds of ${money(p.amount, p.currency)} (reference ${p.ref}) is:

${p.code}

To break the lock early, open Lock funds on your dashboard, select the lock, choose "Break early" and enter this code. Please note that breaking a lock early forfeits the interest. Do not share this code with anyone.

${FOOTER}`,
});

export const lockBrokenEmail = (p: { amount: number; currency: string; interest: number; ref: string }) => ({
  subject: "Lock Broken — Funds Returned — Flexiq Verve",
  message:
`Your lock (reference ${p.ref}) has been broken early.

${money(p.amount, p.currency)} has been returned to your balance. The interest of ${money(p.interest, p.currency)} has been forfeited.

You can log in to your dashboard to view your updated balance.

${FOOTER}`,
});

export const lockMaturedEmail = (p: { amount: number; currency: string; interest: number; ref: string }) => ({
  subject: "Locked Funds Matured — Flexiq Verve",
  message:
`Great news! Your lock (reference ${p.ref}) has matured.

${money(p.amount + p.interest, p.currency)} (principal ${money(p.amount, p.currency)} plus ${money(p.interest, p.currency)} interest) has been paid into your account.

You can log in to your dashboard to view your updated balance.

${FOOTER}`,
});
