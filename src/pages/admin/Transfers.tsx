import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default function Transfers() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("type", "transfer")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      // Fetch profiles separately
      const userIds = [...new Set((data || []).map((t) => t.user_id).filter(Boolean))];

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
        (data || []).map((t) => ({
          ...t,
          profiles: profileMap[t.user_id] ?? null,
        }))
      );

      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((t) => {
        if (status !== "all" && t.status !== status) return false;
        if (!q) return true;
        const s = q.toLowerCase();
        return (
          fullName(t.profiles).toLowerCase().includes(s) ||
          t.profiles?.email?.toLowerCase().includes(s) ||
          t.recipient?.toLowerCase().includes(s)
        );
      }),
    [items, q, status]
  );

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-3">
        <Input
          placeholder="Search user or recipient"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "pending", "completed", "failed"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No transfers
        </Card>
      ) : (
        filtered.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{fullName(t.profiles)}</p>
                <p className="text-xs text-muted-foreground">{t.profiles?.email}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</p>
                <p className="text-xs text-muted-foreground">→ {t.recipient ?? "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold">{fmtMoney(t.amount, t.currency)}</p>
                <Badge variant="outline" className="capitalize">{t.status}</Badge>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
