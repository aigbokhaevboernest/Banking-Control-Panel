import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtMoney } from "@/lib/format";
import { toast } from "sonner";

export default function Loans() {
  const [items, setItems] = useState<any[]>([]);

  const load = () =>
    supabase
      .from("loans")
      .select("*, profiles!loans_user_id_fkey(email,full_name)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems(data ?? []));

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: string, status: string) => {
    await supabase.from("loans").update({ status }).eq("id", id);
    toast.success(status);
    load();
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">No loan applications</Card>
      )}
      {items.map((l) => (
        <Card key={l.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {l.profiles?.full_name || l.profiles?.email || l.user_id.slice(0, 8)}
              </p>
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
            <Button size="sm" onClick={() => setStatus(l.id, "approved")}>Approve</Button>
            <Button size="sm" variant="outline" onClick={() => setStatus(l.id, "rejected")}>Reject</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
