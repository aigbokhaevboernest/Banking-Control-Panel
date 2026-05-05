import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtMoney } from "@/lib/format";

export default function Transfers() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase
      .from("transfers")
      .select("*, profiles!transfers_user_id_fkey(email,full_name)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems(data ?? []));
  }, []);

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">No transfers</Card>
      )}
      {items.map((t) => (
        <Card key={t.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {t.profiles?.full_name || t.profiles?.email}
              </p>
              <p className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</p>
              <p className="text-xs text-muted-foreground">
                → {t.recipient_name} · {t.bank_name} · {t.recipient_account}
              </p>
            </div>
            <div className="text-right">
              <p className="text-base font-bold">{fmtMoney(t.amount)}</p>
              <Badge variant="outline" className="capitalize">{t.status}</Badge>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
