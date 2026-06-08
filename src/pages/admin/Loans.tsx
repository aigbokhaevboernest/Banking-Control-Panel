import { useEffect, useMemo, useState } from "react";
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
import { useConfirmAction } from "@/components/admin/ConfirmActionDialog";
import { RowSkeletonList } from "@/components/admin/RowSkeleton";
import { sendEmail, getUserEmail } from "@/lib/sendEmail";
import { loanStatusEmail, loanCodeEmail } from "@/lib/emailTemplates";

const genCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

export default function Loans() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [generatedCodes, setGeneratedCodes] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const { dialog, confirm } = useConfirmAction();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("loans").select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const userIds = [...new Set((data || []).map((l) => l.user_id))];
    const { data: profiles } = await supabase
      .from("profiles").select("id, first_name, last_name, email, account_number").in("id", userIds);
    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    setItems((data || []).map((l) => ({ ...l, profiles: profileMap[l.user_id] ?? null })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const applyStatus = async (loan: any, s: "approved" | "rejected", sendMail: boolean) => {
    const { error } = await supabase.from("loans").update({ status: s }).eq("id", loan.id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.map((x) => (x.id === loan.id ? { ...x, status: s } : x)));

    if (!sendMail) { toast.success(s); return; }
    const email = loan.profiles?.email || (await getUserEmail(loan.user_id));
    if (!email) { toast.success(s); return; }
    const tpl = loanStatusEmail(s, loan.currency, loan.loan_amount ?? loan.amount);
    const res = await sendEmail({ email, first_name: loan.profiles?.first_name ?? "", ...tpl });
    if (!res.success) toast.error("Status updated. Email notification could not be sent.");
    else toast.success(`${s} · Email sent`);
  };

  const requestStatus = (loan: any, s: "approved" | "rejected") =>
    confirm({
      title: s === "approved" ? "Approve Loan" : "Reject Loan",
      description: `Do you want to ${s === "approved" ? "approve" : "reject"} this loan application?`,
      onConfirm: (sm) => applyStatus(loan, s, sm),
    });

  const requestGenerateCode = (loan: any) =>
    confirm({
      title: "Generate Loan Code",
      description: "Do you want to generate an authorization code and send it to this user?",
      onConfirm: (sendMail) => generateCode(loan, sendMail),
    });

  const generateCode = async (loan: any, sendMail: boolean) => {
    setGenerating(loan.id);
    const code = genCode();
    const { error } = await supabase
      .from("loans")
      .update({ disbursement_code: code, code_used: false })
      .eq("id", loan.id);
    if (error) { toast.error(error.message); setGenerating(null); return; }

    setGeneratedCodes((prev) => ({ ...prev, [loan.id]: code }));
    setItems((prev) =>
      prev.map((x) =>
        x.id === loan.id ? { ...x, disbursement_code: code, code_used: false } : x
      )
    );

    if (!sendMail) { toast.success("Code generated."); setGenerating(null); return; }

    const email = loan.profiles?.email || (await getUserEmail(loan.user_id));
    if (email) {
      const tpl = loanCodeEmail(code);
      const res = await sendEmail({ email, first_name: loan.profiles?.first_name ?? "", ...tpl });
      if (!res.success) toast.error("Code saved. Email could not be sent.");
      else toast.success("Code generated & emailed to user!");
    } else {
      toast.success("Code generated (no user email on file).");
    }
    setGenerating(null);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied!");
  };

  const filtered = useMemo(
    () =>
      items.filter((l) => {
        if (status !== "all" && l.status !== status) return false;
        if (!q) return true;
        const s = q.toLowerCase();
        return (
          fullName(l.profiles).toLowerCase().includes(s) ||
          l.profiles?.email?.toLowerCase().includes(s)
        );
      }),
    [items, q, status]
  );

  return (
    <div className="space-y-3">
      {dialog}
      <Card className="space-y-3 p-3">
        <Input placeholder="Search by user" value={q} onChange={(e) => setQ(e.target.value)} />
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
        <RowSkeletonList rows={5} actions={3} />
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No loan applications</Card>
      ) : (
        filtered.map((l) => (
          <Card key={l.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{fullName(l.profiles)}</p>
                <p className="text-xs text-muted-foreground">{l.profiles?.email}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(l.created_at)}</p>
                <p className="text-xs text-muted-foreground">
                  {l.purpose ?? "—"} · {l.term_months ?? "—"} mo
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold">{fmtMoney(l.loan_amount ?? l.amount, l.currency)}</p>
                <Badge variant="outline" className={`capitalize ${statusBadgeClasses(l.status)}`}>{l.status}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {l.full_name && <p><span className="font-medium">Name:</span> {l.full_name}</p>}
              {l.phone && <p><span className="font-medium">Phone:</span> {l.phone}</p>}
              {l.ssn_id && <p><span className="font-medium">SSN/ID:</span> {l.ssn_id}</p>}
              {l.date_of_birth && <p><span className="font-medium">DOB:</span> {l.date_of_birth}</p>}
              {l.address && <p><span className="font-medium">Address:</span> {l.address}</p>}
              {l.state && <p><span className="font-medium">State:</span> {l.state}</p>}
              {l.country && <p><span className="font-medium">Country:</span> {l.country}</p>}
              {l.home_ownership_status && <p><span className="font-medium">Home:</span> {l.home_ownership_status}</p>}
            </div>

            {(generatedCodes[l.id] || l.disbursement_code) && (
              <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Loan Authorization Code</p>
                  <p className="font-mono text-lg font-bold tracking-widest">
                    {generatedCodes[l.id] || l.disbursement_code}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.code_used ? "✓ Code already used by user" : "Not yet used by user"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => copyCode(generatedCodes[l.id] || l.disbursement_code)}>
                  Copy
                </Button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                className={`bg-success text-success-foreground hover:bg-success/90 ${l.status === "approved" ? "opacity-40 cursor-not-allowed" : ""}`}
                onClick={() => requestStatus(l, "approved")}
                disabled={l.status === "approved"}
              >
                Approve
              </Button>
              <Button
                size="sm"
                className={`bg-destructive text-destructive-foreground hover:bg-destructive/90 ${l.status === "rejected" ? "opacity-40 cursor-not-allowed" : ""}`}
                onClick={() => requestStatus(l, "rejected")}
                disabled={l.status === "rejected"}
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => requestGenerateCode(l)}
                disabled={generating === l.id || l.code_used}
              >
                {generating === l.id ? "Generating…" : "Gen Code"}
              </Button>
            </div>

            {l.code_used && (
              <p className="text-center text-xs text-success font-medium">
                ✓ User has entered the code — funds released
              </p>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
