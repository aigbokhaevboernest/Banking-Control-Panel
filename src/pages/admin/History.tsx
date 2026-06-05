import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtDate, fmtMoney, fullName } from "@/lib/format";
import { statusBadgeClasses } from "@/lib/statusColors";

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
};

// Completed/terminal statuses only
const COMPLETED_STATUSES = new Set([
  "completed",
  "approved",
  "failed",
  "rejected",
]);

export default function History() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-history"],
    queryFn: async (): Promise<Row[]> => {
      const [tx, ln, dp] = await Promise.all([
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
      ]);

      const rows: Row[] = [];

      for (const r of (tx.data || []) as any[]) {
        rows.push({
          id: `transactions:${r.id}`,
          user_id: r.user_id,
          source:
            r.type === "wire"
              ? "Wire Transfer"
              : r.type === "local"
              ? "Local Transfer"
              : r.type === "fx"
              ? "FX Transfer"
              : "Transaction",
          type: r.type,
          amount: r.amount,
          currency: r.currency,
          status: r.status,
          recipient: r.recipient_name || r.recipient || null,
          reference: r.reference,
          created_at: r.created_at,
        });
      }
      for (const r of (ln.data || []) as any[]) {
        rows.push({
          id: `loans:${r.id}`,
          user_id: r.user_id,
          source: "Loan",
          type: "loan",
          amount: r.amount,
          currency: r.currency,
          status: r.status,
          recipient: r.purpose,
          reference: null,
          created_at: r.created_at ?? r.reviewed_at,
        });
      }
      for (const r of (dp.data || []) as any[]) {
        rows.push({
          id: `digital_payments:${r.id}`,
          user_id: r.user_id,
          source: "Digital Payment",
          type: "digital",
          amount: r.amount,
          currency: null,
          status: r.status,
          recipient: r.platform,
          reference: null,
          created_at: r.created_at,
        });
      }

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
  });

  const rows = data ?? [];

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (!COMPLETED_STATUSES.has(String(r.status))) return false;
        if (status !== "all" && r.status !== status) return false;
        if (type !== "all" && r.source !== type) return false;
        if (from && new Date(r.created_at) < new Date(from)) return false;
        if (to && new Date(r.created_at) > new Date(to + "T23:59:59")) return false;
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
    [rows, q, status, type, from, to]
  );

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-3">
        <Input placeholder="Search user, recipient, reference" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {["all", "completed", "approved", "failed", "rejected"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              {["all", "Transaction", "Wire Transfer", "Local Transfer", "FX Transfer", "Digital Payment", "Loan"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No activity</Card>
      ) : (
        filtered.map((r) => (
          <Card key={r.id} className="p-4 overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{fullName(r.profiles)}</p>
                <p className="truncate text-xs text-muted-foreground">{r.profiles?.email}</p>
                <p className="truncate text-xs text-muted-foreground">{fmtDate(r.created_at)}</p>
                <p className="mt-1 break-words text-xs capitalize text-muted-foreground">
                  {r.source}{r.recipient ? ` · ${r.recipient}` : ""}{r.reference ? ` · ${r.reference}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-bold whitespace-nowrap">{fmtMoney(r.amount, r.currency || "USD")}</p>
                <Badge variant="outline" className={`mt-1 capitalize ${statusBadgeClasses(r.status)}`}>{r.status ?? "—"}</Badge>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
