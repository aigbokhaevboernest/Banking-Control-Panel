import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { KpiCard } from "@/components/KpiCard";
import {
  Users,
  CheckCircle2,
  Ban,
  Wallet,
  TrendingUp,
  Landmark,
  AlertTriangle,
} from "lucide-react";
import { fmtMoney } from "@/lib/format";

export default function Overview() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    active: 0,
    suspended: 0,
    totalBalance: 0,
    dailyVolume: 0,
    pendingLoans: 0,
    flagged: 0,
  });

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);

      const [{ data: profiles }, { data: loans }, { data: txDay }, { data: flagged }] =
        await Promise.all([
          supabase.from("profiles").select("status,balance"),
          supabase.from("loans").select("id").eq("status", "pending"),
          supabase.from("transactions").select("amount").gte("created_at", since.toISOString()),
          supabase.from("transactions").select("id").eq("flagged", true),
        ]);

      setStats({
        totalUsers: profiles?.length ?? 0,
        active: profiles?.filter((p: any) => p.status === "active").length ?? 0,
        suspended:
          profiles?.filter((p: any) => ["suspended", "blocked"].includes(p.status)).length ?? 0,
        totalBalance: profiles?.reduce((s: number, p: any) => s + Number(p.balance || 0), 0) ?? 0,
        dailyVolume: txDay?.reduce((s: number, t: any) => s + Number(t.amount || 0), 0) ?? 0,
        pendingLoans: loans?.length ?? 0,
        flagged: flagged?.length ?? 0,
      });
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Total Users" value={stats.totalUsers} icon={Users} />
        <KpiCard label="Active Accounts" value={stats.active} icon={CheckCircle2} tone="success" />
        <KpiCard label="Suspended" value={stats.suspended} icon={Ban} tone="destructive" />
        <KpiCard label="Platform Balance" value={fmtMoney(stats.totalBalance)} icon={Wallet} />
        <KpiCard label="Daily Volume" value={fmtMoney(stats.dailyVolume)} icon={TrendingUp} tone="success" />
        <KpiCard label="Pending Loans" value={stats.pendingLoans} icon={Landmark} tone="warning" />
        <KpiCard label="Flagged Tx" value={stats.flagged} icon={AlertTriangle} tone="destructive" />
      </div>
    </div>
  );
}
