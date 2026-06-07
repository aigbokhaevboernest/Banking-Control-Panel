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
import { fmtMoney, fullName } from "@/lib/format";
import { getTransactionLabel, formatTxDate } from "@/lib/txLabel";
import { toast } from "sonner";
import { statusBadgeClasses } from "@/lib/statusColors";
import { useConfirmAction } from "@/components/admin/ConfirmActionDialog";
import { RowSkeletonList } from "@/components/admin/RowSkeleton";
import { sendEmail, getUserEmail } from "@/lib/sendEmail";
import { transactionEmail, digitalPaymentEmail } from "@/lib/emailTemplates";
import { cn } from "@/lib/utils";

type Row = any;

const STATUS_OPTIONS = ["pending", "processing"] as const;
const STATUS_LABEL: Record<string, string> = {
  completed: "Approve",
  failed: "Mark Failed",
  pending: "Mark Pending",
  processing: "Mark Processing",
};

export default function Transactions() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const { dialog, confirm } = useConfirmAction();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: async (): Promise<Row[]> => {
      const tables = [{ name: "transactions" }, { name: "digital_payments" }];
      const results: any[] = [];
      for (const t of tables) {
        const { data, error } = await supabase
          .from(t.name).select("*").order("created_at", { ascending: false }).limit(500);
        if (error) continue;
        for (const r of (data || []) as any[]) {
          results.push({
            ...r,
            id: `${t.name}:${r.id}`,
            _table: t.name,
            _raw_id: r.id,
            type: t.name === "digital_payments" ? "digital" : (r.type || "transaction"),
            recipient: r.recipient_name || r.recipient || r.platform || null,
          });
        }
      }
      const userIds = [...new Set(results.map((r) => r.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("id, first_name, last_name, email, account_number").in("id", userIds)
        : { data: [] };
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      results.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      return results.map((t) => ({ ...t, profiles: profileMap[t.user_id] ?? null }));
    },
  });

  const items = data ?? [];

  const applyStatus = async (row: any, s: string, sendMail: boolean) => {
    const { error } = await supabase.from(row._table).update({ status: s }).eq("id", row._raw_id);
    if (error) return toast.error(error.message);
    qc.setQueryData<Row[]>(["admin-transactions"], (prev) =>
      (prev ?? []).map((x) => (x.id === row.id ? { ...x, status: s } : x))
    );
    if (!sendMail) { toast.success(`Marked ${s}`); return; }

    const email = row.profiles?.email || (await getUserEmail(row.user_id));
    if (!email) { console.warn("No email for user", row.user_id); toast.success(`Marked ${s}`); return; }

    const tpl = row._table === "digital_payments"
      ? digitalPaymentEmail(s, row.platform, row.currency, row.amount)
      : transactionEmail(s, {
          type: row.type,
          description: row.description,
          currency: row.currency,
          amount: row.amount,
          recipient: row.recipient,
          recipient_name: row.recipient_name,
        });

    const res = await sendEmail({ email, ...tpl });
    if (!res.success) toast.error("Status updated. Email notification could not be sent.");
    else toast.success(`Marked ${s} · Email sent`);
  };

  const requestStatus = (row: any, s: string) =>
    confirm({
      title: `${STATUS_LABEL[s] || "Update"} Transaction`,
      description: `Do you want to mark this transaction as "${s}"?`,
      onConfirm: (sm) => applyStatus(row, s, sm),
    });

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (type !== "all" && t.type !== type) return false;
      if (q) {
        const s = q.toLowerCase();
        const name = fullName(t.profiles).toLowerCase();
        if (
          !name.includes(s) &&
          !t.profiles?.email?.toLowerCase().includes(s) &&
          !t.profiles?.account_number?.toLowerCase().includes(s) &&
          !t.reference?.toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [items, q, status, type]);

  return (
    <div className="space-y-3">
      {dialog}
      <Card className="space-y-3 p-3">
        <Input placeholder="Search user, email, account, reference" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {["all", "pending", "processing", "completed", "failed"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              {["all", "deposit", "withdrawal", "transfer", "loan", "wire", "local", "fx", "digital"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <RowSkeletonList rows={5} actions={3} />
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No transactions</Card>
      ) : (
        filtered.map((t) => (
          <Card key={t.id} className="p-4 overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{fullName(t.profiles)}</p>
                <p className="truncate text-xs text-muted-foreground">{t.profiles?.email}</p>
                <p className="truncate text-xs text-muted-foreground">{fmtDate(t.created_at)}</p>
                <p className="mt-1 break-words text-xs capitalize text-muted-foreground">
                  {t.type} · {t.recipient ?? "—"} {t.reference ? `· ${t.reference}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-bold whitespace-nowrap">{fmtMoney(t.amount, t.currency)}</p>
                <Badge variant="outline" className={`mt-1 capitalize ${statusBadgeClasses(t.status)}`}>{t.status}</Badge>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => requestStatus(t, "completed")}>Approve</Button>
              <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => requestStatus(t, "failed")}>Failed</Button>
              <Select value={STATUS_OPTIONS.includes(t.status) ? t.status : ""} onValueChange={(v) => requestStatus(t, v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
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
