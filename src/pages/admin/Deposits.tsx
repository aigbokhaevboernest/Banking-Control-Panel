import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtMoney, fullName } from "@/lib/format";
import { statusBadgeClasses } from "@/lib/statusColors";

export default function Deposits() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    supabase
      .from("deposit_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (error) { setError(error.message); return; }
        const withProfiles = await Promise.all(
          (data ?? []).map(async (d) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name, email, account_number")
              .eq("id", d.user_id)
              .single();
            return { ...d, profiles: profile };
          })
        );
        setItems(withProfiles);
      });
  }, []);

  const handleAction = async (id: string, userId: string, amount: number, status: string) => {
    await supabase
      .from("deposit_requests")
      .update({ status })
      .eq("id", id);

    if (status === "approved") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("total_balance")
        .eq("id", userId)
        .single();

      await supabase
        .from("profiles")
        .update({ total_balance: (profile?.total_balance ?? 0) + amount })
        .eq("id", userId);
    }

    setItems(prev => prev.map(d => d.id === id ? { ...d, status } : d));
  };

  return (
    <div className="space-y-3">
      {error && <p className="text-red-500 text-sm p-4">{error}</p>}
      {items.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">No deposits</Card>
      )}
      {items.map((d) => (
        <Card key={d.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{fullName(d.profiles)}</p>
              <p className="text-xs text-muted-foreground">{d.profiles?.email}</p>
              <p className="text-xs text-muted-foreground">{fmtDate(d.created_at)}</p>
              <p className="text-xs text-muted-foreground">{d.crypto ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-base font-bold">{fmtMoney(d.amount)}</p>
              <Badge variant="outline" className={`capitalize ${statusBadgeClasses(d.status)}`}>{d.status}</Badge>
            </div>
          </div>
          <div className="flex gap-2 mt-2 justify-end">
            <button
              onClick={() => handleAction(d.id, d.user_id, d.amount, "approved")}
              className="text-xs bg-success text-success-foreground px-3 py-1 rounded-lg hover:bg-success/90"
            >
              Approve
            </button>
            <button
              onClick={() => handleAction(d.id, d.user_id, d.amount, "rejected")}
              className="text-xs bg-destructive text-destructive-foreground px-3 py-1 rounded-lg hover:bg-destructive/90"
            >
              Decline
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
