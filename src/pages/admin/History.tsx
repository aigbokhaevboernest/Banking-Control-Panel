import { useEffect, useMemo, useState } from "react";
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
import { toast } from "sonner";

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

const SOURCES: { table: string; label: string; type: string; recipientFields: string[]; amountField?: string }[] = [
  { table: "transactions", label: "Transaction", type: "transaction", recipientFields: ["recipient"] },
  { table: "loans", label: "Loan", type: "loan", recipientFields: ["purpose"], amountField: "loan_amount" },
  { table: "wire_transfers", label: "Wire Transfer", type: "wire", recipientFields: ["recipient_name", "recipient_account"] },
  { table: "local_transfers", label: "Local Transfer", type: "local", recipientFields: ["recipient_name", "recipient_account"] },
  { table: "digital_payments", label: "Digital Payment", type: "digital", recipientFields: ["recipient", "recipient_name", "platform"] },
];

export default function History() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const all: Row[] = [];

      for (const src of SOURCES) {
        const { data, error } = await supabase
          .from(src.table)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300);
        if (error) {
          // Skip tables that don't exist — keep going
          continue;
        }
        for (const r of (data || []) as any[]) {
          const recipient =
            src.recipientFields
              .map((f) => r[f])
              .filter(Boolean)
              .join(" · ") || null;
          all.push({
            id: `${src.table}:${r.id}`,
            user_id: r.user_id ?? null,
            source: src.label,
            type: r.type || src.type,
            amount: src.amountField ? (r[src.amountField] ?? r.amount ?? null) : (r.amount ?? null),
            currency: r.currency ?? null,
            status: r.status ?? null,
            recipient,
            reference: r.reference ?? null,
            created_at: r.created_at,
          });
        }
      }

      const userIds = [...new Set(all.map((r) => r.user_id).filter(Boolean) as string[])];
      const { data: profiles } = userIds.length
        ? await supabase
            .from("profiles")
            .select("id, first_name, last_name, email, account_number")
            .in("id", userIds)
        : { data: [] };
      const map = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

      all.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      setRows(all.map((r) => ({ ...r, profiles: r.user_id ? map[r.user_id] : null })));
      setLoading(false);
    })().catch((e) => {
      toast.error(e?.message ?? "Failed to load");
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
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
              {["all", "pending", "approved", "completed", "rejected", "failed", "processing"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">all</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No activity</Card>
      ) : (
        filtered.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{fullName(r.profiles)}</p>
                <p className="text-xs text-muted-foreground">{r.profiles?.email}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">
                  {r.source}{r.recipient ? ` · ${r.recipient}` : ""}{r.reference ? ` · ${r.reference}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold">{fmtMoney(r.amount, r.currency || "USD")}</p>
                <Badge variant="outline" className="mt-1 capitalize">{r.status ?? "—"}</Badge>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
