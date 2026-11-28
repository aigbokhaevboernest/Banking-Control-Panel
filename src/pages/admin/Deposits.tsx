import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtMoney, fullName } from "@/lib/format";
import { statusBadgeClasses } from "@/lib/statusColors";
import { useConfirmAction } from "@/components/admin/ConfirmActionDialog";
import { RowSkeletonList } from "@/components/admin/RowSkeleton";
import { sendEmail, getUserEmail } from "@/lib/sendEmail";
import { depositEmail } from "@/lib/emailTemplates";
import { toast } from "sonner";

// "main" = deposit_requests (primary balance)
// "wallet" = wallet_deposit_requests (a specific currency wallet)
type Source = "main" | "wallet";

// Whether "Add funds to user balance" is ticked by default. Flip to true to credit by default.
const DEFAULT_ADD_FUNDS = false;

export default function Deposits() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [addFunds, setAddFunds] = useState<Record<string, boolean>>({});
  const { dialog, confirm } = useConfirmAction();

  const rowKey = (d: any) => `${d.source}-${d.id}`;
  const shouldAddFunds = (d: any) => addFunds[rowKey(d)] ?? DEFAULT_ADD_FUNDS;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [main, wallet] = await Promise.all([
        supabase.from("deposit_requests").select("*").order("created_at", { ascending: false }),
        (supabase as any).from("wallet_deposit_requests").select("*").order("created_at", { ascending: false }),
      ]);

      if (main.error) setError(main.error.message);
      else if (wallet.error) setError(wallet.error.message);

      const rows = [
        ...(main.data ?? []).map((d: any) => ({ ...d, source: "main" as Source })),
        ...(wallet.data ?? []).map((d: any) => ({ ...d, source: "wallet" as Source })),
      ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

      const userIds = [...new Set(rows.map((d) => d.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length
        ? await supabase
            .from("profiles")
            .select("id, first_name, last_name, email, account_number")
            .in("id", userIds)
        : { data: [] };
      const map = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
      setItems(rows.map((d) => ({ ...d, profiles: map[d.user_id] ?? null })));
      setLoading(false);
    })();
  }, []);

  const applyAction = async (
    d: any,
    status: "approved" | "declined",
    sendMail: boolean,
    credit: boolean
  ) => {
    const isWallet = d.source === "wallet";
    const table = isWallet ? "wallet_deposit_requests" : "deposit_requests";
    // deposit_requests stores declines as "rejected"; wallet_deposit_requests as "declined"
    const dbStatus = status === "declined" && !isWallet ? "rejected" : status;
    const amount = Number(d.amount || 0);
    const shouldCredit = status === "approved" && credit;

    if (shouldCredit && isWallet) {
      // Atomically credits the wallet AND marks the request approved
      const { error } = await (supabase as any).rpc("approve_wallet_deposit", {
        p_request_id: d.id,
        p_credit: amount,
      });
      if (error) return toast.error(`Could not credit wallet: ${error.message}`);
    } else {
      // Credit FIRST, so a request is never "approved" without the money landing.
      if (shouldCredit && !isWallet) {
        const { data: profile, error: readErr } = await supabase
          .from("profiles")
          .select("balance")
          .eq("id", d.user_id)
          .single();
        if (readErr) return toast.error(`Could not read balance: ${readErr.message}`);

        // The user app reads profiles.balance (not total_balance)
        const { error: balErr } = await supabase
          .from("profiles")
          .update({ balance: Number(profile?.balance ?? 0) + amount })
          .eq("id", d.user_id);
        if (balErr) return toast.error(`Could not credit balance: ${balErr.message}`);
      }

      const { error } = await (supabase as any).from(table).update({ status: dbStatus }).eq("id", d.id);
      if (error) return toast.error(error.message);
    }

    setItems((prev) =>
      prev.map((x) => (x.id === d.id && x.source === d.source ? { ...x, status: dbStatus } : x))
    );

    const label = shouldCredit ? "Deposit approved · funds added" : `Deposit ${status}`;
    if (!sendMail) { toast.success(label); return; }

    const email = d.profiles?.email || (await getUserEmail(d.user_id));
    if (!email) { toast.success(label); return; }

    const cur = (isWallet ? d.wallet_currency : d.currency) || "USD";
    const tpl = depositEmail(status, cur, amount, shouldCredit);
    const res = await sendEmail({ email, first_name: d.profiles?.first_name ?? "", ...tpl });
    if (!res.success) toast.error("Status updated. Email notification could not be sent.");
    else toast.success(`${label} · Email sent`);
  };

  const requestAction = (d: any, status: "approved" | "declined") =>
    confirm({
      title: status === "approved" ? "Approve Deposit" : "Decline Deposit",
      description:
        status === "approved"
          ? `Approve this deposit? ${
              shouldAddFunds(d)
                ? "Funds WILL be added to the user's balance."
                : "Funds will NOT be added to the user's balance."
            }`
          : "Do you want to decline this deposit?",
      onConfirm: (sm) => applyAction(d, status, sm, shouldAddFunds(d)),
    });

  return (
    <div className="space-y-3">
      {dialog}
      {error && <p className="text-red-500 text-sm p-4">{error}</p>}
      {loading ? (
        <RowSkeletonList rows={5} actions={2} />
      ) : items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No deposits</Card>
      ) : (
        items.map((d) => {
          const isWallet = d.source === "wallet";
          const isApproved = d.status === "approved";
          const isDeclined = d.status === "rejected" || d.status === "declined";
          return (
            <Card key={rowKey(d)} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{fullName(d.profiles)}</p>
                  <p className="text-xs text-muted-foreground">{d.profiles?.email}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(d.created_at)}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.crypto ?? "—"}
                    {isWallet && ` · ${d.wallet_currency} wallet`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold">
                    {isWallet
                      ? `${d.wallet_currency} ${Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : fmtMoney(d.amount)}
                  </p>
                  <Badge variant="outline" className={`capitalize ${statusBadgeClasses(d.status)}`}>
                    {d.status}
                  </Badge>
                </div>
              </div>

              {!isApproved && !isDeclined && (
                <label className="flex items-center justify-end gap-2 mt-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shouldAddFunds(d)}
                    onChange={(e) =>
                      setAddFunds((p) => ({ ...p, [rowKey(d)]: e.target.checked }))
                    }
                  />
                  Add funds to user balance
                </label>
              )}

              <div className="flex gap-2 mt-2 justify-end">
                <button
                  disabled={isApproved}
                  onClick={() => requestAction(d, "approved")}
                  className={`text-xs bg-success text-success-foreground px-3 py-1 rounded-lg hover:bg-success/90 ${isApproved ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  Approve
                </button>
                <button
                  disabled={isDeclined || isApproved}
                  onClick={() => requestAction(d, "declined")}
                  className={`text-xs bg-destructive text-destructive-foreground px-3 py-1 rounded-lg hover:bg-destructive/90 ${isDeclined || isApproved ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  Decline
                </button>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
