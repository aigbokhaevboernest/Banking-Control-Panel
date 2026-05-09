import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Settings = {
  id?: string;
  wallet_address: string | null;
  deposits_enabled: boolean;
};

const DEFAULTS: Settings = { wallet_address: "", deposits_enabled: true };

export default function AppSettings() {
  const [s, setS] = useState<Settings>(DEFAULTS);
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

  const save = async () => {
    setSaving(true);
    const payload: any = {
      wallet_address: s.wallet_address,
      deposits_enabled: s.deposits_enabled,
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
        <Label>Crypto wallet address</Label>
        <Input
          value={s.wallet_address ?? ""}
          onChange={(e) => setS({ ...s, wallet_address: e.target.value })}
          placeholder="bc1q..."
        />
        <p className="text-xs text-muted-foreground">
          Shown to users on the deposit screen so they can send crypto to fund their account.
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
          checked={s.deposits_enabled}
          onCheckedChange={(v) => setS({ ...s, deposits_enabled: v })}
        />
      </Card>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
