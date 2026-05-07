import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/db";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoreVertical, Eye, Ban, Trash2, Hash, Search } from "lucide-react";
import { fmtMoney, fullName } from "@/lib/format";
import { toast } from "sonner";

const statusColor = (s: string) =>
  s === "active"
    ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]"
    : s === "suspended" || s === "frozen"
    ? "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]"
    : "bg-destructive/15 text-destructive";

export default function Users() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "kyc" | "blocked">("all");
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ kind: "block" | "delete"; user: Profile } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setUsers((data as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        if (filter === "pending" && u.status !== "pending") return false;
        if (filter === "blocked" && u.status !== "blocked") return false;
        if (filter === "kyc" && u.kyc_status !== "pending") return false;
        if (!q) return true;
        const s = q.toLowerCase();
        return (
          u.email?.toLowerCase().includes(s) ||
          fullName(u).toLowerCase().includes(s) ||
          u.account_number?.toLowerCase().includes(s)
        );
      }),
    [users, q, filter]
  );

  const doBlock = async (u: Profile) => {
    const { error } = await supabase.from("profiles").update({ status: "blocked" }).eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success("User blocked");
    load();
  };

  const doDelete = async (u: Profile) => {
    const { error } = await supabase.from("profiles").delete().eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success("User deleted");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, account #"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="pending" className="flex-1">Pending</TabsTrigger>
            <TabsTrigger value="kyc" className="flex-1">KYC</TabsTrigger>
            <TabsTrigger value="blocked" className="flex-1">Blocked</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No users found</Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{fullName(u)}</p>
                    <Badge className={statusColor(u.status)} variant="outline">
                      {u.status}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  <p className="mt-2 text-lg font-bold">
                    {fmtMoney(u.balance ?? u.total_balance, u.currency || "USD")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    #{u.account_number} · KYC: {u.kyc_status}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/admin/users/${u.id}`}>
                        <Eye className="mr-2 h-4 w-4" /> View user
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setConfirm({ kind: "block", user: u })}>
                      <Ban className="mr-2 h-4 w-4" /> Block
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        navigator.clipboard.writeText(u.account_number || "");
                        toast.success("Copied");
                      }}
                    >
                      <Hash className="mr-2 h-4 w-4" /> Copy account #
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setConfirm({ kind: "delete", user: u })}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "delete" ? "Delete user?" : "Block user?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete"
                ? `This will permanently delete ${confirm?.user.email}.`
                : `${confirm?.user.email} will lose access until reactivated.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirm) return;
                if (confirm.kind === "delete") await doDelete(confirm.user);
                else await doBlock(confirm.user);
                setConfirm(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
