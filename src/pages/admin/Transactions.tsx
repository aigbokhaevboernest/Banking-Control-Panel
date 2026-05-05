import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/types/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtMoney } from "@/lib/format";
import { toast } from "sonner";

export default function Transactions() {
  const [items, setItems] = useState<(Transaction & { profiles?: { email: string; full_name: string } })[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("transactions")
      .select("*, profiles!transactions_user_id_fkey(email,full_name)")
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data as any) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: string, status: string) => {
    await supabase.from("transactions").update({ status }).eq("id", id);
    toast.success(`Marked ${status}`);
    load();
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">No transactions yet</Card>
      )}
      {items.map((t) => (
        <Card key={t.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t.profiles?.full_name || t.profiles?.email || t.user_id.slice(0, 8)}</p>
              <p className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</p>
              <p className="mt-1 text-xs capitalize text-muted-foreground">{t.type} · {t.recipient ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-base font-bold">{fmtMoney(t.amount, t.currency)}</p>
              <Badge variant="outline" className="mt-1 capitalize">{t.status}</Badge>
              {t.flagged && <Badge variant="destructive" className="ml-1">flagged</Badge>}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button size="sm" variant="outline" onClick={() => setStatus(t.id, "completed")}>Approve</Button>
            <Button size="sm" variant="outline" onClick={() => setStatus(t.id, "failed")}>Reject</Button>
            <Button size="sm" variant="outline" onClick={() => setStatus(t.id, "pending")}>Pending</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
