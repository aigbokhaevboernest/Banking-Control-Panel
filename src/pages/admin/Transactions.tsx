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

type Row = any;

export default function Transactions() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const load = async () => {
    setLoading(true);

    const tables = [
      { name: "transactions", type: null as string | null },
      { name: "wire_transfers", type: "wire" },
      { name: "local_transfers", type: "local" },
      { name: "digital_payments", type: "digital" },
    ];

    const results: any[] = [];
    for (const t of tables) {
      const { data, error } = await supabase
        .from(t.name)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) continue;
      for (const r of (data || []) as any[]) {
        results.push({
          ...r,
          id: `${t.name}:${r.id}`,
          _table: t.name,
          _raw_id: r.id,
          type: r.type || t.type,
          recipient: r.recipient || r.recipient_name || null,
        });
      }
    }

    // Fetch profiles separately to avoid foreign key relationship issues
    const userIds = [...new Set(results.map((r) => r.user_id).filter(Boolean))];

    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, account_number")
          .in("id", userIds)
      : { data: [] };

    const profileMap = Object.fromEntries(
      (profiles || []).map((p) => [p.id, p])
    );

    results.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    setItems(
      results.map((t) => ({
        ...t,
        profiles: profileMap[t.user_id] ?? null,
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setStatusFor = async (row: any, s: string) => {
    const { error } = await supabase
      .from(row._table)
      .update({ status: s })
      .eq("id", row._raw_id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${s}`);
    setItems((prev) =>
      prev.map((x) => (x.id === row.id ? { ...x, status: s } : x))
    );
  };

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (type !== "all" && t.type !== type) return false;
      if (from && new Date(t.created_at) < new Date(from)) return false;
      if (to && new Date(t.created_at) > new Date(to + "T23:59:59"))
        return false;
      if (q) {
        const s = q.toLowerCase();
        const name = fullName(t.profiles).toLowerCase();
        if (
          !name.includes(s) &&
          !t.profiles?.email?.toLowerCase().includes(s) &&
          !t.profiles?.account_number?.toLowerCase().includes(s) &&
          !t.reference?.toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [items, q, status, type, from, to]);

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-3">
        <Input
          placeholder="Search user, email, account, reference"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {["all", "pending", "completed", "failed", "processing"].map(
                (s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {["all", "deposit", "withdrawal", "transfer", "loan", "wire", "local", "digital"].map(
                (s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No transactions
        </Card>
      ) : (
        filtered.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {fullName(t.profiles)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.profiles?.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(t.created_at)}
                </p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">
                  {t.type} · {t.recipient ?? "—"}{" "}
                  {t.reference ? `· ${t.reference}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold">
                  {fmtMoney(t.amount, t.currency)}
                </p>
                <Badge variant="outline" className="mt-1 capitalize">
                  {t.status}
                </Badge>
                {t.flagged && (
                  <Badge variant="destructive" className="ml-1">
                    flagged
                  </Badge>
                )}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatusFor(t, "completed")}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatusFor(t, "failed")}
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatusFor(t, "pending")}
              >
                Pending
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
