import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmtDate, fmtMoney, fullName } from "@/lib/format";
import { sendEmail } from "@/lib/notify";
import { toast } from "sonner";

type Kind = "wire" | "international" | "digital";

const TABLES: Record<Kind, string> = {
  wire: "wire_transfers",
  international: "international_transfers",
  digital: "digital_payments",
};

export function StatusManager({ kind, title }: { kind: Kind; title: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [action, setAction] = useState<{ row: any; kind: "approved" | "rejected" | "pending" } | null>(null);
  const [note, setNote] = useState("");

  const table = TABLES[kind];

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select("*, profiles(first_name,last_name,email,account_number)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const filtered = useMemo(
    () =>
      items.filter((t) => {
        if (status !== "all" && t.status !== status) return false;
        if (!q) return true;
        const s = q.toLowerCase();
        return (
          fullName(t.profiles).toLowerCase().includes(s) ||
          t.profiles?.email?.toLowerCase().includes(s) ||
          t.recipient_name?.toLowerCase().includes(s) ||
          t.recipient?.toLowerCase().includes(s)
        );
      }),
    [items, q, status]
  );

  const submit = async () => {
    if (!action) return;
    const { row, kind: newStatus } = action;
    const patch: any = { status: newStatus, admin_note: note || null };
    const { error } = await supabase.from(table).update(patch).eq("id", row.id);
    if (error) return toast.error(error.message);
    await sendEmail({
      to: row.profiles?.email,
      user_id: row.user_id,
      subject: `Your ${title.toLowerCase()} request is ${newStatus}`,
      text: `Hello ${fullName(row.profiles)},\n\nYour ${title.toLowerCase()} of ${fmtMoney(
        row.amount,
        row.currency
      )} has been marked ${newStatus}.${note ? `\n\nNote: ${note}` : ""}\n\n— Nova Bank`,
    });
    toast.success(`Marked ${newStatus}`);
    setAction(null);
    setNote("");
    load();
  };

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-3">
        <Input placeholder="Search user or recipient" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "pending", "approved", "rejected", "completed"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No requests</Card>
      ) : (
        filtered.map((t) => (
          <Card key={t.id} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{fullName(t.profiles)}</p>
                <p className="text-xs text-muted-foreground">{t.profiles?.email}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold">{fmtMoney(t.amount, t.currency)}</p>
                <Badge variant="outline" className="capitalize">{t.status}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {kind === "wire" && (
                <>
                  <I label="Sender" value={t.sender_name || fullName(t.profiles)} />
                  <I label="Sender acct" value={t.sender_account || t.profiles?.account_number} />
                  <I label="Recipient" value={t.recipient_name} />
                  <I label="Recipient acct" value={t.recipient_account} />
                  <I label="Bank" value={t.bank_name} />
                  <I label="Routing" value={t.routing_number} />
                </>
              )}
              {kind === "international" && (
                <>
                  <I label="Recipient" value={t.recipient_name} />
                  <I label="Account type" value={t.account_type} />
                  <I label="Address" value={t.address} />
                  <I label="ZIP" value={t.zip_code} />
                  <I label="Bank" value={t.bank_name} />
                  <I label="Account #" value={t.bank_account_number} />
                  <I label="SWIFT/IBAN" value={t.swift_iban || t.iban || t.swift} />
                </>
              )}
              {kind === "digital" && (
                <>
                  <I label="Platform" value={t.platform} />
                  <I label="Sender" value={t.sender || fullName(t.profiles)} />
                  <I label="Recipient" value={t.recipient || t.recipient_name} />
                </>
              )}
            </div>

            {t.admin_note && (
              <p className="rounded bg-muted p-2 text-xs">
                <span className="font-medium">Note:</span> {t.admin_note}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button size="sm" onClick={() => setAction({ row: t, kind: "approved" })}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => setAction({ row: t, kind: "rejected" })}>Reject</Button>
              <Button size="sm" variant="outline" onClick={() => setAction({ row: t, kind: "pending" })}>Pending</Button>
            </div>
          </Card>
        ))
      )}

      <Dialog open={!!action} onOpenChange={(o) => !o && (setAction(null), setNote(""))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as {action?.kind}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Note (optional, included in email)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAction(null); setNote(""); }}>Cancel</Button>
            <Button onClick={submit}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function I({ label, value }: { label: string; value: any }) {
  return <p className="truncate"><span className="font-medium">{label}:</span> {value ?? "—"}</p>;
}

export const WireTransfers = () => <StatusManager kind="wire" title="Wire Transfer" />;
export const InternationalTransfers = () => <StatusManager kind="international" title="International Transfer" />;
export const DigitalPayments = () => <StatusManager kind="digital" title="Digital Payment" />;
