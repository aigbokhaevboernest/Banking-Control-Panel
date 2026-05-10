import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtDate, fmtMoney, fullName } from "@/lib/format";
import { sendEmail } from "@/lib/notify";
import { toast } from "sonner";

export default function LoanApplications() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [action, setAction] = useState<{ row: any; kind: "approved" | "rejected" } | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("loan_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Fetch profiles separately
    const userIds = [...new Set((data || []).map((l) => l.user_id).filter(Boolean))];

    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, account_number")
          .in("id", userIds)
      : { data: [] };

    const profileMap = Object.fromEntries(
      (profiles || []).map((p) => [p.id, p])
    );

    setItems(
      (data || []).map((l) => ({
        ...l,
        profiles: profileMap[l.user_id] ?? null,
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((l) => {
        if (status !== "all" && l.status !== status) return false;
        if (!q) return true;
        const s = q.toLowerCase();
        return (
          (l.full_name || fullName(l.profiles)).toLowerCase().includes(s) ||
          l.email?.toLowerCase().includes(s) ||
          l.profiles?.email?.toLowerCase().includes(s)
        );
      }),
    [items, q, status]
  );

  const submitAction = async () => {
    if (!action) return;
    if (!reason.trim()) return toast.error("Please enter a reason");
    const { row, kind } = action;
    const { error } = await supabase
      .from("loan_applications")
      .update({
        status: kind,
        admin_reason: reason,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return toast.error(error.message);

    const emailTo = row.email || row.profiles?.email;
    await sendEmail({
      to: emailTo,
      user_id: row.user_id,
      subject: `Your loan application has been ${kind}`,
      text: `Hello ${row.full_name || fullName(row.profiles)},\n\nYour loan application for ${fmtMoney(
        row.loan_amount, row.currency
      )} has been ${kind}.\n\nReason: ${reason}\n\n— Flexiq Verve`,
    });

    toast.success(`Loan ${kind}`);
    setAction(null);
    setReason("");
    load();
  };

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-3">
        <Input
          placeholder="Search by name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "pending", "approved", "rejected"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No loan applications
        </Card>
      ) : (
        filtered.map((l) => (
          <Card key={l.id} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {l.full_name || fullName(l.profiles)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {l.email || l.profiles?.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(l.created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold">
                  {fmtMoney(l.loan_amount, l.currency)}
                </p>
                <Badge variant="outline" className="capitalize">
                  {l.status}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <Info label="SSN/ID" value={l.ssn_id} />
              <Info label="Phone" value={l.phone} />
              <Info label="DOB" value={l.date_of_birth} />
              <Info label="Mother's maiden" value={l.mothers_maiden_name} />
              <Info label="Address" value={l.address} />
              <Info label="State" value={l.state} />
              <Info label="Country" value={l.country} />
              <Info label="Billing addr" value={l.billing_address} />
              <Info label="Home" value={l.home_ownership_status} />
              <Info label="Term" value={l.term_months ? `${l.term_months} mo` : l.term} />
            </div>

            {l.admin_reason && (
              <p className="rounded bg-muted p-2 text-xs">
                <span className="font-medium">Admin note:</span> {l.admin_reason}
              </p>
            )}

            {l.status === "pending" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button size="sm" onClick={() => setAction({ row: l, kind: "approved" })}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAction({ row: l, kind: "rejected" })}
                >
                  Reject
                </Button>
              </div>
            )}
          </Card>
        ))
      )}

      <Dialog
        open={!!action}
        onOpenChange={(o) => !o && (setAction(null), setReason(""))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action?.kind === "approved" ? "Approve" : "Reject"} loan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (sent to applicant)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setAction(null); setReason(""); }}
            >
              Cancel
            </Button>
            <Button onClick={submitAction}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <p className="truncate">
      <span className="font-medium">{label}:</span> {value ?? "—"}
    </p>
  );
}
