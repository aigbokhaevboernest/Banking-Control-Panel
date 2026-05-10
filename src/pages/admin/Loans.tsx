import { useEffect, useMemo, useState } from "react";
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
import { fmtDate, fmtMoney, fullName } from "@/lib/format";
import { toast } from "sonner";

// Generate a random 8-character alphanumeric code
const genCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

export default function Loans() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [generatedCodes, setGeneratedCodes] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("loans")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const userIds = [...new Set((data || []).map((l) => l.user_id))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, account_number")
      .in("id", userIds);

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

  const setStatusFor = async (id: string, s: string) => {
    const { error } = await supabase.from("loans").update({ status: s }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(s);
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: s } : x)));
  };

  const generateCode = async (loan: any) => {
    setGenerating(loan.id);
    const code = genCode();

    // Set expiry to 48 hours from now
    const expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 48);

    // Delete any existing unused codes for this loan
    await supabase
      .from("loan_codes")
      .delete()
      .eq("loan_id", loan.id)
      .eq("used", false);

    // Insert new code
    const { error } = await supabase.from("loan_codes").insert({
      loan_id: loan.id,
      user_id: loan.user_id,
      code,
      used: false,
      expires_at: expires_at.toISOString(),
    });

    if (error) {
      toast.error(error.message);
      setGenerating(null);
      return;
    }

    // Store generated code to display
    setGeneratedCodes((prev) => ({ ...prev, [loan.id]: code }));
    setGenerating(null);
    toast.success("Loan authorization code generated!");
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard!");
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
      <Card className="space-y-3 p-3">
        <Input
          placeholder="Search by user"
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
                <p className="text-base font-bold">{fmtMoney(l.amount)}</p>
                <Badge variant="outline" className="capitalize">{l.status}</Badge>
              </div>
            </div>

            {/* Loan details */}
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

            {/* Generated code display */}
            {generatedCodes[l.id] && (
              <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Loan Authorization Code</p>
                  <p className="font-mono text-lg font-bold tracking-widest">
                    {generatedCodes[l.id]}
                  </p>
                  <p className="text-xs text-muted-foreground">Expires in 48 hours</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyCode(generatedCodes[l.id])}
                >
                  Copy
                </Button>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" onClick={() => setStatusFor(l.id, "approved")}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatusFor(l.id, "rejected")}
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateCode(l)}
                disabled={generating === l.id}
              >
                {generating === l.id ? "Generating…" : "Gen Code"}
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
