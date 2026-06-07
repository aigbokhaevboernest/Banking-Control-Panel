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

export default function Deposits() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const { dialog, confirm } = useConfirmAction();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("deposit_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) { setError(error.message); setLoading(false); return; }
      const userIds = [...new Set((data ?? []).map((d) => d.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length
        ? await supabase
            .from("profiles")
            .select("id, first_name, last_name, email, account_number")
            .in("id", userIds)
        : { data: [] };
      const map = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      setItems((data ?? []).map((d) => ({ ...d, profiles: map[d.user_id] ?? null })));
      setLoading(false);
    })();
  }, []);

  const applyAction = async (
    d: any,
    status: "approved" | "declined",
    sendMail: boolean
  ) => {
    const dbStatus = status === "declined" ? "rejected" : status;
    const { error } = await supabase.from("deposit_requests").update({ status: dbStatus }).eq("id", d.id);
    if (error) return toast.error(error.message);

    if (status === "approved") {
      const { data: profile } = await supabase
        .from("profiles").select("total_balance").eq("id", d.user_id).single();
      await supabase
        .from("profiles")
        .update({ total_balance: (profile?.total_balance ?? 0) + Number(d.amount || 0) })
        .eq("id", d.user_id);
    }

    setItems((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: dbStatus } : x)));

    if (!sendMail) { toast.success(`Deposit ${status}`); return; }
    const email = d.profiles?.email || (await getUserEmail(d.user_id));
    if (!email) { toast.success(`Deposit ${status}`); return; }
    const tpl = depositEmail(status, d.currency, d.amount);
    const res = await sendEmail({ email, ...tpl });
    if (!res.success) toast.error("Status updated. Email notification could not be sent.");
    else toast.success(`Deposit ${status} · Email sent`);
  };

  const requestAction = (d: any, status: "approved" | "declined") =>
    confirm({
      title: status === "approved" ? "Approve Deposit" : "Decline Deposit",
      description: `Do you want to ${status === "approved" ? "approve" : "decline"} this deposit?`,
      onConfirm: (sm) => applyAction(d, status, sm),
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
          const isApproved = d.status === "approved";
          const isDeclined = d.status === "rejected" || d.status === "declined";
          return (
          <Card key={d.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{fullName(d.profiles)}</p>
                <p className="text-xs text-muted-foreground">{d.profiles?.email}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(d.created_at)}</p>
                <p className="text-xs text-muted-foreground">{d.crypto ?? "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold">{fmtMoney(d.amount)}</p>
                <Badge variant="outline" className={`capitalize ${statusBadgeClasses(d.status)}`}>{d.status}</Badge>
              </div>
            </div>
            <div className="flex gap-2 mt-2 justify-end">
              <button
                disabled={isApproved}
                onClick={() => requestAction(d, "approved")}
                className={`text-xs bg-success text-success-foreground px-3 py-1 rounded-lg hover:bg-success/90 ${isApproved ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                Approve
              </button>
              <button
                disabled={isDeclined}
                onClick={() => requestAction(d, "declined")}
                className={`text-xs bg-destructive text-destructive-foreground px-3 py-1 rounded-lg hover:bg-destructive/90 ${isDeclined ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                Decline
              </button>
            </div>
          </Card>
        );})
      )}
    </div>
  );
}
