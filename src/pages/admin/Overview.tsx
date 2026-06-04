import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { fmtMoney } from "@/lib/format";

const WITHDRAWAL_TYPES = ["wire", "local", "fx", "withdrawal", "transfer_out", "bill_payment"];

export default function Overview() {
  const { data: stats } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [{ data: profiles }, { data: loans }, { data: txs }, { data: digital }] =
        await Promise.all([
          supabase.from("profiles").select("status,balance"),
          supabase.from("loans").select("id").eq("status", "pending"),
          supabase.from("transactions").select("amount,type"),
          supabase.from("digital_payments").select("amount"),
        ]);

      const totalUsers = profiles?.length ?? 0;
      const active = profiles?.filter((p: any) => p.status === "active").length ?? 0;
      const suspended =
        profiles?.filter((p: any) =>
          ["suspended", "blocked", "frozen"].includes(p.status)
        ).length ?? 0;

      const txTotal =
        txs?.reduce((s: number, t: any) => {
          if (WITHDRAWAL_TYPES.includes(String(t.type)) || Number(t.amount) < 0) {
            return s + Math.abs(Number(t.amount || 0));
          }
          return s;
        }, 0) ?? 0;
      const digitalTotal =
        digital?.reduce((s: number, d: any) => s + Math.abs(Number(d.amount || 0)), 0) ?? 0;

      return {
        totalUsers,
        active,
        suspended,
        totalTransactions: txTotal + digitalTotal,
        pendingLoans: loans?.length ?? 0,
      };
    },
  });

  const s = stats ?? {
    totalUsers: 0,
    active: 0,
    suspended: 0,
    totalTransactions: 0,
    pendingLoans: 0,
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      <StatCard label="Total Users" value={s.totalUsers} icon={Users} menuHref="/admin/users" />
      <StatCard label="Active Accounts" value={s.active} icon={CheckCircle2} tone="success" />
      <StatCard label="Suspended" value={s.suspended} icon={Ban} tone="destructive" />
      <StatCard
        label="Total Transactions"
        value={fmtMoney(s.totalTransactions)}
        icon={ArrowLeftRight}
      />
      <StatCard
        label="Pending Loans"
        value={s.pendingLoans}
        icon={Landmark}
        tone="warning"
        menuHref="/admin/loans"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  menuHref,
}: {
  label: string;
  value: string | number;
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
          <p className="text-3xl font-bold tracking-tight truncate">{value}</p>
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
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl",
              toneClass
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Card>
  );
}
