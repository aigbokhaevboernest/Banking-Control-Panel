import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  CheckCircle2,
  Ban,
  Landmark,
  ArrowLeftRight,
  MoreVertical,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Overview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [{ data: profiles }, { data: loans }, { count: txCount }, { count: digitalCount }] =
        await Promise.all([
          supabase.from("profiles").select("status"),
          supabase.from("loans").select("id").eq("status", "pending"),
          supabase.from("transactions").select("id", { count: "exact", head: true }),
          supabase.from("digital_payments").select("id", { count: "exact", head: true }),
        ]);

      const totalUsers = profiles?.length ?? 0;
      const active = profiles?.filter((p: any) => p.status === "active").length ?? 0;
      const suspended =
        profiles?.filter((p: any) =>
          ["suspended", "blocked", "frozen"].includes(p.status)
        ).length ?? 0;

      return {
        totalUsers,
        active,
        suspended,
        totalTransactions: (txCount ?? 0) + (digitalCount ?? 0),
        pendingLoans: loans?.length ?? 0,
      };
    },
  });

  return (
    <div className="grid grid-cols-1 gap-3">
      <StatCard label="Total Users" value={stats?.totalUsers} loading={isLoading} icon={Users} menuHref="/admin/users" />
      <StatCard label="Active Accounts" value={stats?.active} loading={isLoading} icon={CheckCircle2} tone="success" />
      <StatCard label="Suspended" value={stats?.suspended} loading={isLoading} icon={Ban} tone="destructive" />
      <StatCard label="Total Transactions" value={stats?.totalTransactions} loading={isLoading} icon={ArrowLeftRight} />
      <StatCard label="Pending Loans" value={stats?.pendingLoans} loading={isLoading} icon={Landmark} tone="warning" menuHref="/admin/loans" />
    </div>
  );
}

function StatCard({
  label, value, loading, icon: Icon, tone = "default", menuHref,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive";
  menuHref?: string;
}) {
  const toneClass = {
    default: "bg-primary/10 text-primary",
    success: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
    warning: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]",
    destructive: "bg-destructive/15 text-destructive",
  }[tone];

  return (
    <Card className="p-6 min-h-[120px]">
      <div className="flex items-start justify-between gap-3 h-full">
        <div className="min-w-0 flex-1 flex flex-col justify-center gap-2">
          <p className="text-sm font-medium text-muted-foreground truncate">{label}</p>
          {loading || value === undefined ? (
            <Skeleton className="h-9 w-24" />
          ) : (
            <p className="text-3xl font-bold tracking-tight truncate">
              {value.toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {menuHref && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={menuHref}>View all</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", toneClass)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Card>
  );
}
