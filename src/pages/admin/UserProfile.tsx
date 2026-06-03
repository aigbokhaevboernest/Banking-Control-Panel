import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Profile, WithdrawalCode } from "@/types/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Trash2,
  ShieldCheck,
  ShieldX,
  Flag,
} from "lucide-react";
import { fmtMoney, fullName } from "@/lib/format";
import { toast } from "sonner";

const CODE_TYPES = ["COT", "IMF", "TAX", "ITC"] as const;

const statusBadge = (s: string) =>
  s === "active"
    ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30"
    : s === "blocked"
    ? "bg-destructive/15 text-destructive border-destructive/30"
    : "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30";

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [p, setP] = useState<Profile | null>(null);
  const [codes, setCodes] = useState<WithdrawalCode[]>([]);
  const [showPwd, setShowPwd] = useState(false);
  const [delta, setDelta] = useState("");
  const [newCode, setNewCode] = useState({ type: "COT" as (typeof CODE_TYPES)[number], code: "" });
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async () => {
    if (!id) return;
    const [{ data: prof }, { data: cs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("withdrawal_codes").select("*").eq("user_id", id),
    ]);
    setP(prof as Profile | null);
    setCodes((cs as WithdrawalCode[]) ?? []);
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!p) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const update = async (patch: Partial<Profile>) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      setP({ ...p, ...patch });
      toast.success("Saved");
    }
  };

  const adjustBalance = async (sign: 1 | -1) => {
    const v = Number(delta);
    if (!v || isNaN(v)) return toast.error("Enter an amount");
    const next = Number(p.balance ?? p.balance ?? 0) + sign * v;
    await update({ balance: next } as any);
    setDelta("");
  };

  const setKyc = (kyc_status: string) => update({ kyc_status });

  const addCode = async () => {
    if (!newCode.code) return toast.error("Enter a code");
    const { error } = await supabase.from("withdrawal_codes").upsert(
      {
        user_id: p.id,
        code_type: newCode.type,
        code: newCode.code.toUpperCase(),
        enabled: true,
      },
      { onConflict: "user_id,code_type" }
    );
    if (error) toast.error(error.message);
    else {
      toast.success("Code saved");
      setNewCode({ type: "COT", code: "" });
      load();
    }
  };

  const toggleCode = async (c: WithdrawalCode, enabled: boolean) => {
    if (c.code_type === "COT") return toast.error("COT cannot be disabled");
    await supabase.from("withdrawal_codes").update({ enabled }).eq("id", c.id);
    load();
  };

  const updateCodeValue = async (c: WithdrawalCode, code: string) => {
    await supabase.from("withdrawal_codes").update({ code: code.toUpperCase() }).eq("id", c.id);
    load();
    toast.success("Code updated");
  };

  const deleteCode = async (c: WithdrawalCode) => {
    if (c.code_type === "COT") return toast.error("COT cannot be deleted");
    await supabase.from("withdrawal_codes").delete().eq("id", c.id);
    load();
  };

  const balance = p.balance ?? p.balance ?? 0;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/users">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to users
        </Link>
      </Button>

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{fullName(p)}</h2>
            <p className="text-xs text-muted-foreground">{p.email}</p>
            <p className="text-xs text-muted-foreground">#{p.account_number}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{fmtMoney(balance, p.currency || "USD")}</p>
            <div className="mt-1 flex flex-wrap justify-end gap-1">
              <Badge variant="outline" className={statusBadge(p.status)}>{p.status}</Badge>
              <Badge variant="outline">KYC: {p.kyc_status}</Badge>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="profile">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
          <TabsTrigger value="balance" className="flex-1">Balance</TabsTrigger>
          <TabsTrigger value="kyc" className="flex-1">KYC</TabsTrigger>
          <TabsTrigger value="codes" className="flex-1">Codes</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-3">
          <Card className="space-y-3 p-4">
            <Field label="First name" value={p.first_name ?? ""} onSave={(v) => update({ first_name: v })} />
            <Field label="Last name" value={p.last_name ?? ""} onSave={(v) => update({ last_name: v })} />
            <Field label="Email" value={p.email ?? ""} onSave={(v) => update({ email: v })} />
            <Field label="Phone" value={p.phone ?? ""} onSave={(v) => update({ phone: v })} />
            <Field label="Address" value={p.address ?? ""} onSave={(v) => update({ address: v })} />
            <Field label="Country" value={p.country ?? ""} onSave={(v) => update({ country: v })} />
            <Field label="Currency" value={p.currency ?? ""} onSave={(v) => update({ currency: v })} />

            <PinDisplay pin={(p as any).pin ?? (p as any).account_pin ?? ""} />

            <CreatedAtEditor
              value={p.created_at}
              onSave={(iso) => update({ created_at: iso } as any)}
            />

            <PasswordEditor
              current={p.plain_password ?? ""}
              show={showPwd}
              onToggle={() => setShowPwd((s) => !s)}
              onUpdate={async (next) => {
                if (!next) { toast.error("Enter a new password"); return; }
                if (next.length < 6) { toast.error("Password must be at least 6 characters"); return; }
                await update({ plain_password: next } as any);
              }}
            />
          </Card>

          <Card className="space-y-2 p-4">
            <Label>Account status</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={p.status === "active" ? "default" : "outline"}
                size="sm"
                className={p.status === "active" ? "bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90" : ""}
                onClick={() => setPendingStatus("active")}
              >
                Activate
              </Button>
              <Button
                variant={p.status === "frozen" ? "default" : "outline"}
                size="sm"
                onClick={() => setPendingStatus("frozen")}
              >
                Freeze
              </Button>
              <Button
                variant={p.status === "suspended" ? "default" : "outline"}
                size="sm"
                onClick={() => setPendingStatus("suspended")}
              >
                Suspend
              </Button>
              <Button
                variant={p.status === "blocked" ? "destructive" : "outline"}
                size="sm"
                onClick={() => setPendingStatus("blocked")}
              >
                Block
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete account
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="balance">
          <Card className="space-y-3 p-4">
            <Label>Adjust balance ({fmtMoney(balance, p.currency || "USD")})</Label>
            <Input
              type="number"
              placeholder="Amount"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => adjustBalance(1)}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
              <Button variant="outline" onClick={() => adjustBalance(-1)}>
                <Minus className="mr-1 h-4 w-4" /> Subtract
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="kyc">
          <Card className="space-y-3 p-4">
            <Label>KYC status</Label>
            <p className="text-xs text-muted-foreground">Current: {p.kyc_status}</p>
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" onClick={() => setKyc("approved")}>
                <ShieldCheck className="mr-1 h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setKyc("rejected")}>
                <ShieldX className="mr-1 h-4 w-4" /> Reject
              </Button>
              <Button size="sm" variant="outline" onClick={() => setKyc("flagged")}>
                <Flag className="mr-1 h-4 w-4" /> Flag
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="codes" className="space-y-3">
          <Card className="space-y-3 p-4">
            <Label>Default verification code (COT fallback)</Label>
            <Field
              label=""
              value={p.default_verification_code ?? ""}
              onSave={(v) => update({ default_verification_code: v.toUpperCase() })}
            />
          </Card>

          <Card className="space-y-3 p-4">
            <Label>Add / update code</Label>
            <div className="flex gap-2">
              <Select value={newCode.type} onValueChange={(v) => setNewCode({ ...newCode, type: v as any })}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CODE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Code"
                value={newCode.code}
                onChange={(e) => setNewCode({ ...newCode, code: e.target.value })}
              />
              <Button onClick={addCode}>Save</Button>
            </div>
          </Card>

          <div className="space-y-2">
            {codes.map((c) => (
              <Card key={c.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge>{c.code_type}</Badge>
                    <Input
                      defaultValue={c.code}
                      className="h-8 w-32"
                      onBlur={(e) => e.target.value !== c.code && updateCodeValue(c, e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={c.enabled}
                      disabled={c.code_type === "COT"}
                      onCheckedChange={(v) => toggleCode(c, v)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={c.code_type === "COT"}
                      onClick={() => deleteCode(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {c.code_type === "COT" && (
                  <p className="mt-1 text-xs text-muted-foreground">COT is always enabled.</p>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!pendingStatus} onOpenChange={(o) => !o && setPendingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change status to "{pendingStatus}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately affect {p.email}'s account access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pendingStatus) await update({ status: pendingStatus });
                setPendingStatus(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const { error } = await supabase.from("profiles").delete().eq("id", p.id);
                if (error) return toast.error(error.message);
                toast.success("Deleted");
                navigate("/admin/users");
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value)} />
        <Button size="sm" onClick={() => onSave(v)} disabled={v === value}>
          Save
        </Button>
      </div>
    </div>
  );
}

function PasswordEditor({
  current,
  show,
  onToggle,
  onUpdate,
}: {
  current: string;
  show: boolean;
  onToggle: () => void;
  onUpdate: (next: string) => void | Promise<void>;
}) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const submit = async () => {
    if (next !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    await onUpdate(next);
    setNext("");
    setConfirm("");
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <Label>User password</Label>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Current</p>
        <div className="flex gap-2">
          <Input type={show ? "text" : "password"} value={current} readOnly />
          <Button type="button" variant="outline" size="icon" onClick={onToggle}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {!current && (
          <p className="text-xs text-muted-foreground">No password stored yet.</p>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">New password</p>
        <Input
          type={show ? "text" : "password"}
          value={next}
          placeholder="At least 6 characters"
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Confirm new password</p>
        <Input
          type={show ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button size="sm" className="w-full" onClick={submit} disabled={!next || !confirm}>
        Update password
      </Button>
    </div>
  );
}
