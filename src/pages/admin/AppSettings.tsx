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
import { toast } from "sonner";

type Asset = "BTC" | "ETH" | "USDT";

const ASSET_FIELD: Record<Asset, string> = {
  BTC: "btc_address",
  ETH: "eth_address",
  USDT: "usdt_address",
};

type Settings = {
  id?: string;
  wallet_address?: string | null;
  btc_address?: string | null;
  eth_address?: string | null;
  usdt_address?: string | null;
  receive_enabled: boolean;
};

const DEFAULTS: Settings = {
  wallet_address: "",
  btc_address: "",
  eth_address: "",
  usdt_address: "",
  receive_enabled: true,
};

export default function AppSettings() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [asset, setAsset] = useState<Asset>("BTC");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (data) setS({ ...DEFAULTS, ...(data as any) });
      setLoading(false);
    })();
  }, []);

  const field = ASSET_FIELD[asset];
  const currentAddress = useMemo(() => (s as any)[field] ?? "", [s, field]);

  const setAddress = (v: string) => setS({ ...s, [field]: v } as any);

  const save = async () => {
    setSaving(true);
    const payload: any = {
      btc_address: s.btc_address ?? null,
      eth_address: s.eth_address ?? null,
      usdt_address: s.usdt_address ?? null,
      receive_enabled: s.receive_enabled,
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
            <SelectItem value="USDT">USDT</SelectItem>
          </SelectContent>
        </Select>

        <Label>{asset} wallet address</Label>
        <Input
          value={currentAddress}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={asset === "BTC" ? "bc1q..." : asset === "ETH" ? "0x..." : "T... / 0x..."}
        />
        <p className="text-xs text-muted-foreground">
          Each asset has its own wallet address. Switch the dropdown to edit a different one.
        </p>
      </Card>

      <Card className="flex items-center justify-between gap-3 p-4">
        <div>
          <Label>Deposits mode</Label>
          <p className="text-xs text-muted-foreground">
            When OFF, the user's Receive button shows "feature unavailable".
          </p>
        </div>
        <Switch
          checked={s.receive_enabled}
          onCheckedChange={(v) => setS({ ...s, receive_enabled: v })}
        />
      </Card>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
