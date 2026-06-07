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
import { fmtMoney, fullName } from "@/lib/format";
import { getTransactionLabel, formatTxDate } from "@/lib/txLabel";
import { statusBadgeClasses } from "@/lib/statusColors";
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
};

const TERMINAL = new Set(["completed", "approved", "failed", "rejected"]);

export default function History() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-history"],
    queryFn: async (): Promise<Row[]> => {
      const [txRes, lnRes, dpRes] = await Promise.all([
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
              {["all", "completed", "approved", "failed", "rejected"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              {[
                { value: "all", label: "All Types" },
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
        filtered.map((r) => (
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
                <p className="text-base font-bold whitespace-nowrap">
                  {fmtMoney(r.amount, r.currency || "USD")}
                </p>
                <Badge
                  variant="outline"
                  className={`mt-1 capitalize ${statusBadgeClasses(r.status)}`}
                >
                  {r.status ?? "—"}
                </Badge>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
