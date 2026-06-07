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
import { sendEmail, getUserEmail, getUserFirstName } from "@/lib/sendEmail";
import { transactionEmail, digitalPaymentEmail } from "@/lib/emailTemplates";
import { cn } from "@/lib/utils";

type Row = any;

const STATUS_LABEL: Record<string, string> = {
  completed: "Approve",
  failed: "Mark Failed",
  pending: "Mark Pending",
  processing: "Mark Processing",
};

export default function Transactions() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { dialog, confirm } = useConfirmAction();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: async (): Promise<Row[]> => {
      const [txRes, dpRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("digital_payments")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      const results: any[] = [];

      for (const r of (txRes.data || []) as any[]) {
        results.push({
          ...r,
          _uid: `transactions:${r.id}`,
          _table: "transactions",
          _raw_id: r.id,
          type: r.type || "transaction",
          recipient: r.recipient_name || r.recipient || null,
          displayAmount: r.amount,
          displayCurrency: r.currency,
        });
      }

      for (const r of (dpRes.data || []) as any[]) {
        results.push({
          ...r,
          _uid: `digital_payments:${r.id}`,
          _table: "digital_payments",
          _raw_id: r.id,
          type: "digital_payment",
          recipient: r.platform || null,
          description: r.note || r.platform || "Digital Payment",
          displayAmount: r.amount,
          displayCurrency: null,
        });
      }

      const userIds = [...new Set(results.map((r) => r.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length
        ? await supabase
            .from("profiles")
            .select("id, first_name, last_name, email, account_number")
            .in("id", userIds)
        : { data: [] };

      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      results.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      return results.map((r) => ({ ...r, profiles: profileMap[r.user_id] ?? null }));
    },
  });

  const items = data ?? [];

  const applyStatus = async (row: any, s: string, sendMail: boolean) => {
    const { error } = await supabase
      .from(row._table)
      .update({ status: s })
      .eq("id", row._raw_id);
    if (error) return toast.error(error.message);

    qc.setQueryData<Row[]>(["admin-transactions"], (prev) =>
      (prev ?? []).map((x) => (x._uid === row._uid ? { ...x, status: s } : x))
    );

    if (!sendMail) { toast.success(`Marked ${s}`); return; }

    const email = row.profiles?.email || (await getUserEmail(row.user_id));
    const first_name = row.profiles?.first_name || (await getUserFirstName(row.user_id)) || "";
    if (!email) { toast.success(`Marked ${s}`); return; }

    const tpl = row._table === "digital_payments"
      ? digitalPaymentEmail(s, row.platform, row.displayCurrency, row.displayAmount)
      : transactionEmail(s, {
          type: row.type,
          description: row.description,
          currency: row.displayCurrency,
          amount: row.displayAmount,
          recipient: row.recipient,
          recipient_name: row.recipient_name,
        });

    const res = await sendEmail({ email, first_name, ...tpl });
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
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (q) {
        const s = q.toLowerCase();
        const name = fullName(t.profiles).toLowerCase();
        if (
          !name.includes(s) &&
          !t.profiles?.email?.toLowerCase().includes(s) &&
          !t.profiles?.account_number?.toLowerCase().includes(s) &&
          !t.reference?.toLowerCase().includes(s) &&
          !t.recipient?.toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [items, q, statusFilter, typeFilter]);

  return (
    <div className="space-y-3">
      {dialog}
      <Card className="space-y-3 p-3">
        <Input
          placeholder="Search user, email, account, reference"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {["all", "pending", "processing", "completed", "failed"].map((s) => (
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
        <RowSkeletonList rows={5} actions={3} />
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No transactions</Card>
      ) : (
        filtered.map((t) => {
          const isCompleted = t.status === "completed";
          const isFailed = t.status === "failed";
          const isPending = t.status === "pending";
          const isProcessing = t.status === "processing";
          const dropdownValue = isPending ? "pending" : isProcessing ? "processing" : "";

          return (
            <Card key={t._uid} className="p-4 overflow-hidden">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fullName(t.profiles)}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.profiles?.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{formatTxDate(t.created_at)}</p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {getTransactionLabel(t.type)}
                    {t.recipient ? ` · ${t.recipient}` : ""}
                    {t.reference ? ` · ${t.reference}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold whitespace-nowrap">
                    {fmtMoney(t.displayAmount, t.displayCurrency || "USD")}
                  </p>
                  <Badge variant="outline" className={`mt-1 capitalize ${statusBadgeClasses(t.status)}`}>
                    {t.status}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  disabled={isCompleted}
                  className={cn("bg-success text-success-foreground hover:bg-success/90", isCompleted && "opacity-40 cursor-not-allowed")}
                  onClick={() => requestStatus(t, "completed")}
                >Approve</Button>
                <Button
                  size="sm"
                  disabled={isFailed}
                  className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90", isFailed && "opacity-40 cursor-not-allowed")}
                  onClick={() => requestStatus(t, "failed")}
                >Failed</Button>
                <Select value={dropdownValue} onValueChange={(v) => requestStatus(t, v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending" disabled={isPending} className={cn("capitalize", isPending && "opacity-40")}>Pending</SelectItem>
                    <SelectItem value="processing" disabled={isProcessing} className={cn("capitalize", isProcessing && "opacity-40")}>Processing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
