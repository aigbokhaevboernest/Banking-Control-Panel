import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, fullName } from "@/lib/format";
import { getTransactionLabel, formatTxDate } from "@/lib/txLabel";
import { statusBadgeClasses } from "@/lib/statusColors";
import { sendEmail, getUserEmail } from "@/lib/sendEmail";
import { RowSkeletonList } from "@/components/admin/RowSkeleton";

type Row = {
  id: string;
  user_id: string | null;
  source: string;
  type: string;
  amount: number | null;
  currency: string | null;
  status: string | null;
  recipient: string | null;
  reference: string | null;
  created_at: string;
  profiles?: any;
  meta?: any; // raw login_events row for login alerts
};

const TERMINAL = new Set(["completed", "approved", "failed", "rejected", "alert"]);

const loginReason = (m: any) =>
  [m?.new_device && "New device", m?.new_location && "New location"].filter(Boolean).join(" + ");

const loginPlace = (m: any) =>
  [m?.city, m?.region, m?.country].filter(Boolean).join(", ") || "Unknown location";

export default function History() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewing, setViewing] = useState<Row | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-history"],
    queryFn: async (): Promise<Row[]> => {
      const [txRes, lnRes, dpRes, lgRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .in("status", ["completed", "failed", "rejected"])
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("loans")
          .select("*")
          .in("status", ["approved", "rejected"])
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("digital_payments")
          .select("*")
          .in("status", ["completed", "failed", "rejected", "approved"])
          .order("created_at", { ascending: false })
          .limit(500),
        // Only logins flagged as a new device and/or new location
        (supabase as any)
          .from("login_events")
          .select("*")
          .or("new_device.eq.true,new_location.eq.true")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      const rows: Row[] = [];

      // Transactions — read type directly from column
      for (const r of (txRes.data || []) as any[]) {
        rows.push({
          id: `transactions:${r.id}`,
          user_id: r.user_id,
          source: getTransactionLabel(r.type),
          type: r.type || "transaction",
          amount: r.amount,
          currency: r.currency,
          status: r.status,
          recipient: r.recipient_name || r.recipient || null,
          reference: r.reference || null,
          created_at: r.created_at,
        });
      }

      // Loans
      for (const r of (lnRes.data || []) as any[]) {
        rows.push({
          id: `loans:${r.id}`,
          user_id: r.user_id,
          source: "Loan",
          type: "loan",
          amount: r.amount,
          currency: r.currency,
          status: r.status,
          recipient: r.purpose || null,
          reference: null,
          created_at: r.created_at || r.reviewed_at,
        });
      }

      // Digital payments — no currency column, use platform as recipient
      for (const r of (dpRes.data || []) as any[]) {
        rows.push({
          id: `digital_payments:${r.id}`,
          user_id: r.user_id,
          source: "Digital Payment",
          type: "digital_payment",
          amount: r.amount,
          currency: null,
          status: r.status,
          recipient: r.platform || null,
          reference: null,
          created_at: r.created_at,
        });
      }

      // New device / new location logins
      for (const r of (lgRes.data || []) as any[]) {
        rows.push({
          id: `login_events:${r.id}`,
          user_id: r.user_id,
          source: "New Login",
          type: "login_alert",
          amount: null,
          currency: null,
          status: "alert",
          recipient: loginPlace(r),
          reference: null,
          created_at: r.created_at,
          meta: r,
        });
      }

      // Fetch profiles
      const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])];
      const { data: profiles } = userIds.length
        ? await supabase
            .from("profiles")
            .select("id, first_name, last_name, email, account_number")
            .in("id", userIds)
        : { data: [] };

      const map = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      return rows.map((r) => ({ ...r, profiles: r.user_id ? map[r.user_id] : null }));
    },
    refetchInterval: 15000, // new login alerts appear on their own
    refetchOnWindowFocus: true,
  });

  const rows = data ?? [];

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (!TERMINAL.has(String(r.status))) return false;
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (typeFilter !== "all" && r.type !== typeFilter) return false;
        if (q) {
          const s = q.toLowerCase();
          const name = fullName(r.profiles).toLowerCase();
          if (
            !name.includes(s) &&
            !r.profiles?.email?.toLowerCase().includes(s) &&
            !r.recipient?.toLowerCase().includes(s) &&
            !r.reference?.toLowerCase().includes(s)
          )
            return false;
        }
        return true;
      }),
    [rows, q, statusFilter, typeFilter]
  );

  // Emails the user the details of the flagged login and stamps email_sent_at.
  const sendLoginEmail = async (r: Row) => {
    const m = r.meta;
    if (!m) return;
    setSendingId(r.id);
    try {
      const email = r.profiles?.email || (r.user_id ? await getUserEmail(r.user_id) : null);
      if (!email) {
        toast.error("User has no email on file.");
        return;
      }

      const when = new Date(m.created_at).toLocaleString();
      const res = await sendEmail({
        email,
        first_name: r.profiles?.first_name ?? "",
        user_id: r.user_id,
        subject: "New Login to Your Account — Flexiq Verve",
        message:
`We noticed a new sign-in to your Flexiq Verve account.<br/><br/>
<strong>Time:</strong> ${when}<br/>
<strong>Device:</strong> ${m.browser || "Unknown"} on ${m.os || "Unknown"}<br/>
<strong>Location:</strong> ${loginPlace(m)}<br/>
<strong>IP address:</strong> ${m.ip || "Unknown"}<br/><br/>
If this was you, no action is needed. If you do not recognize this activity, please contact <a href="mailto:support@flexiqverve.com" style="color:#2563eb;">support@flexiqverve.com</a> immediately or use the Live Chat on your dashboard, and change your password.`,
      });

      if (!res.success) {
        toast.error("Email could not be sent.");
        return;
      }

      await (supabase as any)
        .from("login_events")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", m.id);

      toast.success("Email sent");
      qc.invalidateQueries({ queryKey: ["admin-history"] });
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-3">
        <Input
          placeholder="Search user, recipient, reference"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {["all", "completed", "approved", "failed", "rejected", "alert"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              {[
                { value: "all", label: "All Types" },
                { value: "login_alert", label: "New Login" },
                { value: "wire_transfer", label: "Wire Transfer" },
                { value: "transfer_out", label: "Local Transfer" },
                { value: "fx", label: "FX Transfer" },
                { value: "deposit", label: "Deposit" },
                { value: "withdrawal", label: "Withdrawal" },
                { value: "loan", label: "Loan" },
                { value: "digital_payment", label: "Digital Payment" },
                { value: "transfer", label: "Transfer" },
                { value: "transfer_in", label: "Incoming Transfer" },
              ].map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <RowSkeletonList rows={6} actions={1} />
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No activity</Card>
      ) : (
        filtered.map((r) => {
          const isLogin = r.type === "login_alert";
          return (
            <Card key={r.id} className="p-4 overflow-hidden">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fullName(r.profiles)}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.profiles?.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatTxDate(r.created_at)}
                  </p>
                  <p className="mt-1 break-words text-xs capitalize text-muted-foreground">
                    {r.source}
                    {r.recipient ? ` · ${r.recipient}` : ""}
                    {r.reference ? ` · ${r.reference}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {isLogin ? (
                    <p className="text-sm font-semibold whitespace-nowrap">{loginReason(r.meta)}</p>
                  ) : (
                    <p className="text-base font-bold whitespace-nowrap">
                      {fmtMoney(r.amount, r.currency || "USD")}
                    </p>
                  )}
                  <Badge
                    variant="outline"
                    className={`mt-1 capitalize ${statusBadgeClasses(r.status)}`}
                  >
                    {r.status ?? "—"}
                  </Badge>
                </div>
              </div>

              {isLogin && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setViewing(r)}>
                    <Eye className="mr-1 h-4 w-4" /> View
                  </Button>
                  <Button
                    size="sm"
                    disabled={sendingId === r.id}
                    onClick={() => sendLoginEmail(r)}
                  >
                    {sendingId === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Mail className="mr-1 h-4 w-4" />
                        {r.meta?.email_sent_at ? "Resend email" : "Send email"}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </Card>
          );
        })
      )}

      {/* View login details */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>New login details</DialogTitle>
          </DialogHeader>
          {viewing?.meta && (
            <div className="space-y-1 text-sm">
              {[
                ["User", fullName(viewing.profiles)],
                ["Email", viewing.profiles?.email],
                ["Reason", loginReason(viewing.meta)],
                ["Time", new Date(viewing.meta.created_at).toLocaleString()],
                ["Browser", viewing.meta.browser],
                ["Operating system", viewing.meta.os],
                ["IP address", viewing.meta.ip],
                ["City", viewing.meta.city],
                ["Region", viewing.meta.region],
                ["Country", viewing.meta.country],
                ["Device ID", viewing.meta.device_id ? String(viewing.meta.device_id).slice(0, 8) : null],
                [
                  "Email sent",
                  viewing.meta.email_sent_at
                    ? new Date(viewing.meta.email_sent_at).toLocaleString()
                    : "Not sent",
                ],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="flex justify-between gap-3 border-b border-border/50 py-2 last:border-0"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <span className="break-all text-right font-medium">{(value as string) || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
