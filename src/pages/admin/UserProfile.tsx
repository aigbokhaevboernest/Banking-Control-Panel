import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Save,
} from "lucide-react";
import { fmtMoney, fullName } from "@/lib/format";
import { toast } from "sonner";

const CODE_TYPES = ["COT", "TAX", "ITC", "IMF"] as const;

import { statusBadgeClasses } from "@/lib/statusColors";
const statusBadge = (s: string) => statusBadgeClasses(s);

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-2 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-medium text-sm text-right break-all">{value || "—"}</span>
    </div>
  );
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [p, setP] = useState<Profile | null>(null);
  const [verification, setVerification] = useState<any>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [delta, setDelta] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Code state — reads directly from profiles columns
  const [codes, setCodes] = useState({
    cot_enabled: false,
    tax_enabled: false,
    imf_enabled: false,
    cot_code: "",
    tax_code: "",
    itc_code: "",
    imf_code: "",
    default_verification_code: "",
  });

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    country: "",
    currency: "",
    username: "",
    created_at: "",
  });
  const [formDirty, setFormDirty] = useState(false);

  const load = async () => {
    if (!id) return;
    const [{ data: prof }, { data: verif }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("id_verifications").select("*").eq("user_id", id).maybeSingle(),
    ]);
    const profile = prof as Profile | null;
    setP(profile);
    setVerification(verif);
    if (profile) {
      setForm({
        first_name: profile.first_name ?? "",
        last_name: profile.last_name ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        address: profile.address ?? "",
        country: profile.country ?? "",
        currency: profile.currency ?? "",
        username: (profile as any).username ?? "",
        created_at: profile.created_at ?? "",
      });
      setCodes({
        cot_enabled: (profile as any).cot_enabled ?? false,
        tax_enabled: (profile as any).tax_enabled ?? false,
        imf_enabled: (profile as any).imf_enabled ?? false,
        cot_code: (profile as any).default_verification_code ?? "",
        tax_code: (profile as any).tax_code ?? "",
        itc_code: (profile as any).itc_code ?? "",
        imf_code: (profile as any).imf_code ?? "",
        default_verification_code: (profile as any).default_verification_code ?? "",
      });
      setFormDirty(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (!p) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const update = async (patch: Partial<Profile>) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      setP({ ...p, ...patch });
      toast.success("Saved");
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormDirty(true);
  };

  const saveAllProfileFields = async () => {
    const patch: any = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone,
      address: form.address,
      country: form.country,
      currency: form.currency,
      username: form.username,
      created_at: form.created_at
        ? new Date(form.created_at).toISOString()
        : p.created_at,
    };
    const { error } = await supabase.from("profiles").update(patch).eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      setP({ ...p, ...patch });
      setFormDirty(false);
      toast.success("Profile saved");
    }
  };

  const adjustBalance = async (sign: 1 | -1) => {
    const v = Number(delta);
    if (!v || isNaN(v)) return toast.error("Enter an amount");
    const next = Number(p.balance ?? 0) + sign * v;
    await update({ balance: next } as any);
    setDelta("");
  };

  const setKyc = async (kyc_status: string) => update({ kyc_status });

  const saveCodes = async () => {
    const patch: any = {
      cot_enabled: codes.cot_enabled,
      tax_enabled: codes.tax_enabled,
      imf_enabled: codes.imf_enabled,
      default_verification_code: codes.default_verification_code.toUpperCase(),
    };
    const { error } = await supabase.from("profiles").update(patch).eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Codes saved");
      load();
    }
  };

  const toDatetimeLocal = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const balance = p.balance ?? 0;

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

        {/* ── PROFILE TAB ── */}
        <TabsContent value="profile" className="space-y-3">
          <Card className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input value={form.first_name} onChange={(e) => handleFormChange("first_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input value={form.last_name} onChange={(e) => handleFormChange("last_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => handleFormChange("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => handleFormChange("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => handleFormChange("address", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => handleFormChange("country", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input value={form.currency} onChange={(e) => handleFormChange("currency", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input value={form.username} onChange={(e) => handleFormChange("username", e.target.value)} />
            </div>
            <PinDisplay pin={(p as any).pin ?? ""} />
            <div className="space-y-1.5 min-w-0">
              <Label>Account created at</Label>
              <Input
                type="datetime-local"
                className="w-full min-w-0 truncate"
                value={toDatetimeLocal(form.created_at)}
                onChange={(e) => handleFormChange("created_at", e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={!formDirty}
              onClick={saveAllProfileFields}
            >
              <Save className="mr-2 h-4 w-4" /> Save all changes
            </Button>
          </Card>

          {/* Account status — colored active state, white/outlined inactive */}
<Card className="space-y-2 p-4">
  <Label>Account status</Label>
  <div className="grid grid-cols-2 gap-2">
    {/* Activate — green when active */}
    <Button
      size="sm"
      className={
        p.status === "active" && !(p as any).frozen
          ? "bg-green-600 text-white hover:bg-green-700 border-transparent"
          : "bg-white border border-border text-muted-foreground hover:bg-muted"
      }
      onClick={() => setPendingStatus("active")}
    >
      Activate
    </Button>

    {/* Freeze — blue when frozen */}
    <Button
      size="sm"
      className={
        (p as any).frozen === true
          ? "bg-blue-600 text-white hover:bg-blue-700 border-transparent"
          : "bg-white border border-border text-muted-foreground hover:bg-muted"
      }
      onClick={() => setPendingStatus("frozen")}
    >
      Freeze
    </Button>

    {/* Block — amber when blocked */}
    <Button
      size="sm"
      className={
        p.status === "blocked"
          ? "bg-amber-500 text-white hover:bg-amber-600 border-transparent"
          : "bg-white border border-border text-muted-foreground hover:bg-muted"
      }
      onClick={() => setPendingStatus("blocked")}
    >
      Block
    </Button>

    {/* Delete — always red filled */}
    <Button
      size="sm"
      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      onClick={() => setConfirmDelete(true)}
    >
      <Trash2 className="mr-2 h-4 w-4" /> Delete
    </Button>
  </div>
</Card>


          <Card className="p-4">
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
        </TabsContent>

        {/* ── BALANCE TAB ── */}
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

        {/* ── KYC TAB ── */}
        <TabsContent value="kyc" className="space-y-3">
          {verification ? (
            <Card className="space-y-3 p-4">
              <Label>Submitted Identity Document</Label>
              <div className="space-y-1">
                <Row label="Status" value={verification.status} />
                <Row
                  label="Legal name"
                  value={[
                    verification.legal_first_name,
                    verification.legal_middle_name,
                    verification.legal_last_name,
                  ].filter(Boolean).join(" ")}
                />
                <Row label="Date of birth" value={verification.date_of_birth} />
                <Row label="Document type" value={verification.document_type} />
                <Row label="Document number" value={verification.document_number} />
                <Row label="Document country" value={verification.document_country} />
                <Row
                  label="Submitted"
                  value={verification.submitted_at
                    ? new Date(verification.submitted_at).toLocaleString()
                    : null}
                />
                <Row
                  label="Reviewed"
                  value={verification.reviewed_at
                    ? new Date(verification.reviewed_at).toLocaleString()
                    : null}
                />
                {verification.rejection_reason && (
                  <Row label="Rejection reason" value={verification.rejection_reason} />
                )}
              </div>

              {verification.document_front_url && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Document front</Label>
                  <img
                    src={verification.document_front_url}
                    className="rounded-md border max-h-48 object-contain w-full"
                  />
                </div>
              )}
              {verification.document_back_url && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Document back</Label>
                  <img
                    src={verification.document_back_url}
                    className="rounded-md border max-h-48 object-contain w-full"
                  />
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-border">
                <Label>Rejection reason (optional)</Label>
                <Input
                  placeholder="e.g. Document unclear or expired"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 text-white hover:bg-green-700"
                    onClick={async () => {
                      const { error } = await supabase
                        .from("id_verifications")
                        .update({
                          status: "approved",
                          reviewed_at: new Date().toISOString(),
                          rejection_reason: null,
                        })
                        .eq("user_id", p.id);
                      if (error) return toast.error(error.message);
                      await setKyc("approved");
                      setRejectionReason("");
                      load();
                      toast.success("Verification approved");
                    }}
                  >
                    <ShieldCheck className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      const { error } = await supabase
                        .from("id_verifications")
                        .update({
                          status: "rejected",
                          reviewed_at: new Date().toISOString(),
                          rejection_reason: rejectionReason || null,
                        })
                        .eq("user_id", p.id);
                      if (error) return toast.error(error.message);
                      await setKyc("rejected");
                      setRejectionReason("");
                      load();
                      toast.success("Verification rejected");
                    }}
                  >
                    <ShieldX className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">
                No identity verification submitted yet.
              </p>
            </Card>
          )}
        </TabsContent>

        {/* ── CODES TAB ── */}
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
       <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
       <SelectContent>
         {CODE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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


            <Button className="w-full" onClick={saveCodes}>
              <Save className="mr-2 h-4 w-4" /> Save codes
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status change dialog */}
      <AlertDialog
        open={!!pendingStatus}
        onOpenChange={(o) => !o && setPendingStatus(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change status to "{pendingStatus}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately affect {p.email}'s account access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pendingStatus === "frozen") {
                  // Set both status and frozen boolean
                  await update({ status: "frozen", frozen: true } as any);
                } else if (pendingStatus === "active") {
                  // Clear frozen boolean when activating
                  await update({ status: "active", frozen: false } as any);
                } else if (pendingStatus === "blocked") {
                  // Clear frozen when blocking
                  await update({ status: "blocked", frozen: false } as any);
                }
                setPendingStatus(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const { error } = await supabase
                  .from("profiles")
                  .delete()
                  .eq("id", p.id);
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

function PinDisplay({ pin }: { pin: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label>Account PIN</Label>
      <div className="flex gap-2">
        <Input
          type={show ? "text" : "password"}
          value={pin || ""}
          readOnly
          placeholder="No PIN set"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
    if (next !== confirm) { toast.error("Passwords do not match"); return; }
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
      <Button
        size="sm"
        className="w-full"
        onClick={submit}
        disabled={!next || !confirm}
      >
        Update password
      </Button>
    </div>
  );
}
