import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmtDate, fmtMoney, fullName } from "@/lib/format";
import { toast } from "sonner";
import { statusBadgeClasses } from "@/lib/statusColors";

type Kind = "wire" | "local" | "digital";

// Wire & Local live in the `transactions` table (filtered by type).
// Digital lives in the `digital_payments` table.
const TABLE_FOR: Record<Kind, string> = {
  wire: "transactions",
  local: "transactions",
  digital: "digital_payments",
};

const STATUS_OPTIONS = ["pending", "processing"] as const;

export function StatusManager({ kind, title }: { kind: Kind; title: string }) {
  const qc = useQueryClient();
  const table = TABLE_FOR[kind];
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["status-manager", kind],
    queryFn: async () => {
  let query = supabase.from(table).select("*").order("created_at", { ascending: false });

  if (kind === "wire") {
    query = query.eq("type", "wire_transfer");
  } else if (kind === "local") {
    query = query.eq("type", "transfer_out").ilike("description", "Local transfer%");
  }

  const { data, error } = await query;
  if (error) {
    toast.error(error.message);
    return [];
  }
  const userIds = [...new Set((data || []).map((t: any) => t.user_id).filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, account_number")
        .in("id", userIds)
    : { data: [] };
  const map = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  return (data || []).map((t: any) => ({ ...t, profiles: map[t.user_id] ?? null }));
},

  });

  const items = data ?? [];

  const filtered = useMemo(
    () =>
      items.filter((t: any) => {
        if (status !== "all" && t.status !== status) return false;
        if (!q) return true;
        const s = q.toLowerCase();
        return (
          fullName(t.profiles).toLowerCase().includes(s) ||
          t.profiles?.email?.toLowerCase().includes(s) ||
          t.recipient_name?.toLowerCase().includes(s) ||
          t.recipient?.toLowerCase().includes(s) ||
          t.platform?.toLowerCase().includes(s)
        );
      }),
    [items, q, status]
  );

  const setStatusFor = async (row: any, s: string) => {
    const { error } = await supabase.from(table).update({ status: s }).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${s}`);
    qc.setQueryData<any[]>(["status-manager", kind], (prev) =>
      (prev ?? []).map((x) => (x.id === row.id ? { ...x, status: s } : x))
    );
  };

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-3">
        <Input placeholder="Search user or recipient" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "pending", "processing", "completed", "failed"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No requests</Card>
      ) : (
        filtered.map((t: any) => (
          <Card key={t.id} className="space-y-2 p-4 overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{fullName(t.profiles)}</p>
                <p className="truncate text-xs text-muted-foreground">{t.profiles?.email}</p>
                <p className="truncate text-xs text-muted-foreground">{fmtDate(t.created_at)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-bold whitespace-nowrap">{fmtMoney(t.amount, t.currency)}</p>
                <Badge variant="outline" className={`capitalize ${statusBadgeClasses(t.status)}`}>{t.status}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-3 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
              {kind === "wire" && (
                <>
                  <I label="Recipient" value={t.recipient_name} />
                  <I label="Recipient acct" value={t.recipient_account} />
                  <I label="Bank" value={t.recipient_bank} />
                  <I label="SWIFT/IBAN" value={t.swift_iban || t.iban} />
                  <I label="SWIFT BIC" value={t.swift_bic} />
                  <I label="Routing" value={t.routing_number} />
                  <I label="Country" value={t.recipient_country || t.country} />
                  <I label="Reference" value={t.reference} />
                </>
              )}
              {kind === "local" && (
                <>
                  <I label="Recipient" value={t.recipient_name} />
                  <I label="Recipient acct" value={t.recipient_account} />
                  <I label="Bank" value={t.recipient_bank} />
                  <I label="Routing" value={t.routing_number} />
                  <I label="ZIP" value={t.zip_code || t.bank_zip_code} />
                  <I label="Reference" value={t.reference} />
                </>
              )}
              {kind === "digital" && (
                <>
                  <I label="Platform" value={t.platform} />
                  <I label="Note" value={t.note} />
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => setStatusFor(t, "completed")}>Approve</Button>
              <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => setStatusFor(t, "failed")}>Failed</Button>
              <Select
                value={STATUS_OPTIONS.includes(t.status) ? t.status : ""}
                onValueChange={(v) => setStatusFor(t, v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function I({ label, value }: { label: string; value: any }) {
  return <p className="truncate"><span className="font-medium">{label}:</span> {value ?? "—"}</p>;
}

export const WireTransfers = () => <StatusManager kind="wire" title="Wire Transfer" />;
export const DigitalPayments = () => <StatusManager kind="digital" title="Digital Payment" />;
export const LocalTransfers = () => <StatusManager kind="local" title="Local Transfer" />;
