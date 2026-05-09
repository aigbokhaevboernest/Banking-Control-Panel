import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtMoney, fullName } from "@/lib/format";

const [items, setItems] = useState<any[]>([]);
const [error, setError] = useState<string>("");

useEffect(() => {
  supabase
    .from("deposit_requests")
    .select("*, profiles(first_name,last_name,email,account_number)")
    .order("created_at", { ascending: false })
    .then(({ data, error }) => {
      if (error) setError(error.message);
      setItems(data ?? []);
    });
}, []);


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
              <Badge variant="outline" className="capitalize">{d.status}</Badge>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
