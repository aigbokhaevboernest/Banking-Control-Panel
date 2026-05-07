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

export default function Loans() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("loans")
      .select("*, profiles(first_name,last_name,email,account_number)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
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
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No loan applications</Card>
      ) : (
        filtered.map((l) => (
          <Card key={l.id} className="p-4">
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
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" onClick={() => setStatusFor(l.id, "approved")}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => setStatusFor(l.id, "rejected")}>Reject</Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
