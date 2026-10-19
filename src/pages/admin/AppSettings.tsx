import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Asset = "BTC" | "ETH" | "USDT";

const ASSET_FIELD: Record<Asset, string> = {
  BTC: "btc_wallet_address",
  ETH: "eth_wallet_address",
  USDT: "usdt_wallet_address",
};

// Wallet addresses stay global. Deposit access is now per user
// (profiles.receive_enabled, default false).
type Settings = {
  id?: string;
  btc_wallet_address?: string | null;
  eth_wallet_address?: string | null;
  usdt_wallet_address?: string | null;
};

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  receive_enabled: boolean;
};

const DEFAULTS: Settings = {
  btc_wallet_address: "",
  eth_wallet_address: "",
  usdt_wallet_address: "",
};

const userLabel = (u: UserRow) => u.full_name || u.email || u.id.slice(0, 8);

export default function AppSettings() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [asset, setAsset] = useState<Asset>("BTC");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Users + per-user deposit access
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [onlyEnabled, setOnlyEnabled] = useState(false);

  // Confirmation modal for the per-user switch
  const [target, setTarget] = useState<UserRow | null>(null);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    (async () => {
      const [settingsRes, usersRes] = await Promise.all([
        supabase.from("app_settings").select("*").limit(1).maybeSingle(),
        supabase
          .from("profiles")
          .select("id, email, full_name, receive_enabled")
          .order("created_at", { ascending: false }),
      ]);

      if (settingsRes.data) setS({ ...DEFAULTS, ...(settingsRes.data as any) });

      if (usersRes.error) toast.error(usersRes.error.message);
      else
        setUsers(
          ((usersRes.data as any[]) ?? []).map((u) => ({
            ...u,
            receive_enabled: !!u.receive_enabled, // null -> off
          }))
        );

      setLoading(false);
    })();
  }, []);

  const field = ASSET_FIELD[asset];
  const currentAddress = useMemo(() => (s as any)[field] ?? "", [s, field]);
  const setAddress = (v: string) => setS({ ...s, [field]: v } as any);

  const enabledCount = useMemo(
    () => users.filter((u) => u.receive_enabled).length,
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (onlyEnabled && !u.receive_enabled) return false;
      if (!q) return true;
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, query, onlyEnabled]);

  // Saves wallet addresses only.
  const save = async () => {
    setSaving(true);
    const payload: any = {
      btc_wallet_address: s.btc_wallet_address ?? null,
      eth_wallet_address: s.eth_wallet_address ?? null,
      usdt_wallet_address: s.usdt_wallet_address ?? null,
    };
    let error;
    if (s.id) {
      ({ error } = await supabase.from("app_settings").update(payload).eq("id", s.id));
    } else {
      const res = await supabase.from("app_settings").insert(payload).select().maybeSingle();
      error = res.error;
      if (res.data) setS({ ...s, id: (res.data as any).id });
    }
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  };

  // The switch doesn't flip by itself: it only asks. The change is applied
  // (and saved) when the admin answers Yes.
  const askToggle = (user: UserRow, value: boolean) => {
    setTarget(user);
    setPendingValue(value);
  };

  const closeConfirm = () => {
    setTarget(null);
    setPendingValue(null);
  };

  const confirmToggle = async () => {
    if (!target || pendingValue === null) return;
    const next = pendingValue;
    const userId = target.id;
    setToggling(true);

    const { error } = await supabase
      .from("profiles")
      .update({ receive_enabled: next })
      .eq("id", userId);

    setToggling(false);

    if (error) {
      toast.error(error.message);
      closeConfirm();
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, receive_enabled: next } : u))
    );
    toast.success(`Deposits turned ${next ? "on" : "off"} for ${userLabel(target)}`);
    closeConfirm();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-4">
        <Label>Crypto deposit asset</Label>
        <Select value={asset} onValueChange={(v) => setAsset(v as Asset)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
            <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
            <SelectItem value="USDT">USDT (TRON)</SelectItem>
          </SelectContent>
        </Select>

        <Label>{asset === "USDT" ? "USDT (TRON)" : asset} wallet address</Label>
        <Input
          value={currentAddress}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={asset === "BTC" ? "bc1q..." : asset === "ETH" ? "0x..." : "T..."}
        />
        <p className="text-xs text-muted-foreground">
          Each asset has its own wallet address. Switch the dropdown to edit a different one.
          Users with deposits turned on see all three addresses in their notifications and on the Receive page.
        </p>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Saving…" : "Save wallet addresses"}
        </Button>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <Label>Deposit access per user</Label>
          <p className="text-xs text-muted-foreground">
            Deposits are off for everyone by default. Turn on only the users who should be able to deposit.
            Users with deposits off see "feature unavailable" on Receive.
          </p>
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {enabledCount} of {users.length} users enabled
          </p>
          <div className="flex items-center gap-2">
            <Label htmlFor="only-enabled" className="text-xs font-normal">
              Enabled only
            </Label>
            <Switch id="only-enabled" checked={onlyEnabled} onCheckedChange={setOnlyEnabled} />
          </div>
        </div>

        <div className="max-h-80 divide-y overflow-y-auto rounded-md border">
          {filteredUsers.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              {users.length === 0 ? "No users yet." : "No users match your search."}
            </p>
          ) : (
            filteredUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{userLabel(u)}</p>
                  {u.full_name && u.email && (
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  )}
                </div>
                <Switch
                  checked={u.receive_enabled}
                  onCheckedChange={(v) => askToggle(u, v)}
                  aria-label={`Deposits for ${userLabel(u)}`}
                />
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Confirmation modal for the per-user switch */}
      <Dialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open && !toggling) closeConfirm();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Turn deposits {pendingValue ? "on" : "off"}?
            </DialogTitle>
            <DialogDescription>
              {target
                ? pendingValue
                  ? `${userLabel(target)} will be able to use the Receive page to make deposits.`
                  : `${userLabel(target)} will see "feature unavailable" when they open Receive.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={closeConfirm} disabled={toggling}>
              No
            </Button>
            <Button onClick={confirmToggle} disabled={toggling}>
              {toggling ? "Saving…" : "Yes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
