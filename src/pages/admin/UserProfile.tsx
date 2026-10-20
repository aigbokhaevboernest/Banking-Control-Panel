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
  ChevronDown,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Trash2,
  ShieldCheck,
  ShieldX,
  Save,
  Lock,
  Unlock,
  Sparkles,
} from "lucide-react";
import { fmtMoney, fullName } from "@/lib/format";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { sendEmail, getUserEmail } from "@/lib/sendEmail";
import { accountStatusEmail, kycEmail, withdrawalCodeEmail, billingEmail } from "@/lib/emailTemplates";
import { Textarea } from "@/components/ui/textarea";
import { getBalanceBreakdown } from "@/hooks/useTotalBalance";

const CODE_TYPES = ["COT", "TAX", "ITC", "IMF"] as const;

const SECONDARY_ACCOUNT_TYPES = [
  { key: "checking", label: "Checking" },
  { key: "savings", label: "Savings" },
  { key: "retirement", label: "Retirement" },
] as const;

const CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "INR", name: "Indian Rupee" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "KRW", name: "South Korean Won" },
  { code: "THB", name: "Thai Baht" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "ZAR", name: "South African Rand" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "PLN", name: "Polish Zloty" },
];

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
  const [codes, setCodes] = useState<WithdrawalCode[]>([]);
  const [verification, setVerification] = useState<any>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [delta, setDelta] = useState("");
  const [newCode, setNewCode] = useState({ type: "COT" as (typeof CODE_TYPES)[number], code: "" });
  const [pendingStatus, setPendingStatus] = useState<"active" | "frozen" | "blocked" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmKyc, setConfirmKyc] = useState<"approved" | "rejected" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [pendingCode, setPendingCode] = useState<null | { type: (typeof CODE_TYPES)[number]; code: string }>(null);
  const [billing, setBilling] = useState({ type: "General", subject: "", body: "" });
  const [billingError, setBillingError] = useState("");
  const [confirmBilling, setConfirmBilling] = useState(false);

  // Collapsible sections — both collapsed by default
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);

  // Secondary account balance adjustment — amount + opened toggle per type
  const [secondaryDelta, setSecondaryDelta] = useState<Record<string, string>>({
    checking: "",
    savings: "",
    retirement: "",
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
    const [{ data: prof }, { data: cs }, { data: verif }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("withdrawal_codes").select("*").eq("user_id", id),
      supabase.from("id_verifications").select("*").eq("user_id", id).maybeSingle(),
    ]);
    const profile = prof as Profile | null;
    setP(profile);
    setCodes((cs as WithdrawalCode[]) ?? []);
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

  /**
   * Adjust a secondary account's balance (checking/savings/retirement).
   * Writes directly to the corresponding `{type}_balance` column on
   * profiles — the same column the dashboard aggregate reads from, so the
   * primary card's total updates automatically without any extra wiring.
   */
  const adjustSecondaryBalance = async (
    type: "checking" | "savings" | "retirement",
    sign: 1 | -1
  ) => {
    if ((p as any)[`${type}_opened`] !== true) return toast.error("Open this account first");
    const v = Number(secondaryDelta[type]);
    if (!v || isNaN(v)) return toast.error("Enter an amount");
    const balanceCol = `${type}_balance`;
    const current = Number((p as any)[balanceCol] ?? 0);
    const next = Math.max(0, current + sign * v);
    await update({ [balanceCol]: next } as any);
    setSecondaryDelta((prev) => ({ ...prev, [type]: "" }));
  };

  /** Toggle whether a secondary account is marked opened — lets admin open/close on the user's behalf. */
  const toggleSecondaryOpened = async (
    type: "checking" | "savings" | "retirement",
    opened: boolean
  ) => {
    const openedCol = `${type}_opened`;
    await update({ [openedCol]: opened } as any);
  };

  const setKyc = async (kyc_status: string) => update({ kyc_status });

  const addCode = () => {
    if (!newCode.code) return toast.error("Enter a code");
    setPendingCode({ type: newCode.type, code: newCode.code.toUpperCase() });
  };

  /** Fill the code field with a random 8-character code (no look-alike characters). */
  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint32Array(8);
    crypto.getRandomValues(bytes);
    const code = Array.from(bytes, (b) => chars[b % chars.length]).join("");
    setNewCode((prev) => ({ ...prev, code }));
  };

  const toggleCode = async (c: WithdrawalCode, enabled: boolean) => {
    if (c.code_type === "COT") return toast.error("COT cannot be disabled");
    await supabase.from("withdrawal_codes").update({ enabled }).eq("id", c.id);
    load();
  };

  const updateCodeValue = (c: WithdrawalCode, code: string) => {
    setPendingCode({ type: c.code_type as any, code: code.toUpperCase() });
  };

  const deleteCode = async (c: WithdrawalCode) => {
    if (c.code_type === "COT") return toast.error("COT cannot be deleted");
    await supabase.from("withdrawal_codes").delete().eq("id", c.id);
    load();
  };

  // Saves the code. The email is sent only when sendMail is true
  // (i.e. the admin ticked the send email option in the confirm modal).
  const saveCodeWithEmail = async (sendMail: boolean) => {
    if (!pendingCode) return;
    const { type, code } = pendingCode;
    const { error } = await supabase.from("withdrawal_codes").upsert(
      { user_id: p!.id, code_type: type, code, enabled: true },
      { onConflict: "user_id,code_type" }
    );
    if (error) { toast.error(error.message); return; }
    setNewCode({ type: "COT", code: "" });
    await load();

    if (!sendMail) { toast.success(`${type} code saved`); return; }
    const email = p?.email || (await getUserEmail(p!.id));
    if (!email) { toast.success(`${type} code saved`); return; }
    const tpl = withdrawalCodeEmail(type, code);
    const res = await sendEmail({ email, first_name: p?.first_name ?? "", subject: tpl.subject, message: tpl.message });
    if (!res.success) toast.error("Code saved. Email notification could not be sent.");
    else toast.success(`${type} code saved · Email sent`);
  };

  const BILLING_SUBJECTS: Record<string, string> = {
    COT: "Cost of Transfer (COT) — Flexiq Verve",
    TAX: "Tax Clearance — Flexiq Verve",
    ITC: "International Transfer Code (ITC) — Flexiq Verve",
    IMF: "IMF Code — Flexiq Verve",
    General: "Message from Flexiq Verve Support",
  };

  const handleBillingType = (t: string) => {
    setBilling({ ...billing, type: t, subject: BILLING_SUBJECTS[t] || billing.subject });
    setBillingError("");
  };

  const openBillingConfirm = () => {
    if (!billing.subject.trim() || !billing.body.trim()) {
      setBillingError("Subject and message are required before sending.");
      return;
    }
    setBillingError("");
    setConfirmBilling(true);
  };

  const sendBillingEmail = async () => {
    const email = p?.email || (await getUserEmail(p!.id));
    if (!email) { toast.error("User has no email on file."); return; }
    const tpl = billingEmail(billing.body, billing.subject);
    const res = await sendEmail({ email, first_name: p?.first_name ?? "", subject: tpl.subject, message: tpl.message });
    if (!res.success) toast.error("Email could not be sent. Please try again.");
    else {
      toast.success("Billing email sent successfully.");
      setBilling({ type: "General", subject: BILLING_SUBJECTS.General, body: "" });
    }
  };

  const toDatetimeLocal = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Same rule as the user's dashboard: total = primary + every OPENED secondary account.
  const bd = getBalanceBreakdown(p);
  const primaryBalance = bd.own;
  const secondaryTotal = bd.checking + bd.savings + bd.retirement; // opened accounts only
  const totalBalance = bd.total;
  const currencyCode = p.currency || "USD";

  // The account type chosen at signup is the user's primary account and is not
  // shown as a secondary card, so exactly 2 secondary cards are listed.
  // Business (or anything unknown) is treated as Checking-primary, so such
  // users still get exactly 2 secondary cards: Savings and Retirement.
  const signupType = String((p as any).account_type ?? "").toLowerCase();
  const primaryType = SECONDARY_ACCOUNT_TYPES.some((a) => a.key === signupType) ? signupType : "checking";
  const visibleSecondary = SECONDARY_ACCOUNT_TYPES.filter(({ key }) => key !== primaryType);

  // If a user already has a currency that isn't in the list, keep it selectable.
  const currencyOptions = CURRENCIES.some((c) => c.code === form.currency) || !form.currency
    ? CURRENCIES
    : [{ code: form.currency, name: "Current" }, ...CURRENCIES];

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
            <p className="text-2xl font-bold">{fmtMoney(totalBalance, currencyCode)}</p>
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
        <TabsContent value="profile" className="space-y-5">
          <Card className="space-y-4 p-4">
            <h3 className="text-lg font-bold">Personal details</h3>
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
              <Select
                value={form.currency || undefined}
                onValueChange={(v) => handleFormChange("currency", v)}
              >
                <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {currencyOptions.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button className="w-full" size="lg" disabled={!formDirty} onClick={saveAllProfileFields}>
              <Save className="mr-2 h-4 w-4" /> Save all changes
            </Button>
          </Card>

          <Card className="space-y-3 p-4">
            <h3 className="text-lg font-bold">Account status</h3>
            <div className="grid grid-cols-2 gap-2">
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
        <TabsContent value="balance" className="space-y-5">
          <Card className="space-y-3 p-4">
            <div>
              <Label>Total balance</Label>
              <p className="text-2xl font-bold">{fmtMoney(totalBalance, currencyCode)}</p>
              <p className="text-xs text-muted-foreground">
                Primary{signupType ? ` (${signupType})` : ""} {fmtMoney(primaryBalance, currencyCode)} + opened secondary accounts {fmtMoney(secondaryTotal, currencyCode)}
              </p>
            </div>

            <div className="space-y-3 border-t border-border pt-3">
              <Label>Adjust primary balance ({fmtMoney(primaryBalance, currencyCode)})</Label>
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
            </div>
          </Card>

          {/* Secondary accounts — checking / savings / retirement (collapsed by default) */}
          <Card className="p-4">
            <button
              type="button"
              onClick={() => setSecondaryOpen((o) => !o)}
              aria-expanded={secondaryOpen}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <h3 className="text-lg font-bold">Secondary accounts</h3>
                <p className="text-xs text-muted-foreground">
                  {fmtMoney(secondaryTotal, currencyCode)} counted from opened accounts
                </p>
              </div>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                  secondaryOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {secondaryOpen && (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Adjusting a secondary account's balance also updates the
                  user's total automatically, but only for accounts marked
                  Opened. A balance on a Not opened account is not counted.
                </p>

                {visibleSecondary.map(({ key, label }) => {
                  const balanceCol = `${key}_balance`;
                  const openedCol = `${key}_opened`;
                  const currentBalance = Number((p as any)[balanceCol] ?? 0);
                  const isOpened = (p as any)[openedCol] === true;

                  return (
                    <div key={key} className="space-y-2 rounded-md border border-border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{label} account</p>
                          <p className="text-xs text-muted-foreground">
                            {fmtMoney(currentBalance, currencyCode)}
                            {!isOpened && currentBalance > 0 && " · not counted until opened"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={isOpened ? "outline" : "default"}
                          onClick={() => toggleSecondaryOpened(key, !isOpened)}
                        >
                          {isOpened ? (
                            <>
                              <Unlock className="mr-1 h-4 w-4" /> Opened
                            </>
                          ) : (
                            <>
                              <Lock className="mr-1 h-4 w-4" /> Not opened
                            </>
                          )}
                        </Button>
                      </div>

                      {isOpened ? (
                        <>
                          <Input
                            type="number"
                            placeholder="Amount"
                            value={secondaryDelta[key]}
                            onChange={(e) =>
                              setSecondaryDelta((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Button size="sm" onClick={() => adjustSecondaryBalance(key, 1)}>
                              <Plus className="mr-1 h-4 w-4" /> Add
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => adjustSecondaryBalance(key, -1)}
                            >
                              <Minus className="mr-1 h-4 w-4" /> Subtract
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Mark this account as opened to add or subtract balance.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
                  value={verification.submitted_at ? new Date(verification.submitted_at).toLocaleString() : null}
                />
                <Row
                  label="Reviewed"
                  value={verification.reviewed_at ? new Date(verification.reviewed_at).toLocaleString() : null}
                />
                {verification.rejection_reason && (
                  <Row label="Rejection reason" value={verification.rejection_reason} />
                )}
              </div>
              {verification.document_front_url && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Document front</Label>
                  <img src={verification.document_front_url} className="rounded-md border max-h-48 object-contain w-full" />
                </div>
              )}
              {verification.document_back_url && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Document back</Label>
                  <img src={verification.document_back_url} className="rounded-md border max-h-48 object-contain w-full" />
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
                    onClick={() => setConfirmKyc("approved")}
                  >
                    <ShieldCheck className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmKyc("rejected")}
                  >
                    <ShieldX className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">No identity verification submitted yet.</p>
            </Card>
          )}
        </TabsContent>

        {/* ── CODES TAB ── */}
        <TabsContent value="codes" className="space-y-5">
          <Card className="space-y-3 p-4">
            <Label>Default verification code (COT fallback)</Label>
            <Field
              label=""
              value={p.default_verification_code ?? ""}
              onSave={(v) => update({ default_verification_code: v.toUpperCase() })}
            />
          </Card>

          <Card className="space-y-3 p-4">
            <h3 className="text-lg font-bold">Add / update code</h3>
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
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={generateCode}>
                <Sparkles className="mr-1 h-4 w-4" /> Auto generate
              </Button>
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

          {/* ── Send Billing Email (collapsed by default) ── */}
          <Card className="p-4 mt-4 border-t-4 border-t-[#5B6EF5]">
            <button
              type="button"
              onClick={() => setBillingOpen((o) => !o)}
              aria-expanded={billingOpen}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <h3 className="text-lg font-bold">Send Billing Email</h3>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                  billingOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {billingOpen && (
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label>Code Type</Label>
                  <Select value={billing.type} onValueChange={handleBillingType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["COT", "TAX", "ITC", "IMF", "General"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Input
                    value={billing.subject}
                    onChange={(e) => { setBilling({ ...billing, subject: e.target.value }); setBillingError(""); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email Body</Label>
                  <Textarea
                    rows={6}
                    placeholder="Write the full email message to send to this user..."
                    value={billing.body}
                    onChange={(e) => { setBilling({ ...billing, body: e.target.value }); setBillingError(""); }}
                  />
                </div>
                {billingError && <p className="text-xs text-destructive">{billingError}</p>}
                <Button
                  onClick={openBillingConfirm}
                  className="w-full text-white hover:opacity-90"
                  style={{ backgroundColor: "#5B6EF5" }}
                >
                  Send Email
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status change dialog with Send Mail */}
      <ConfirmActionDialog
        open={!!pendingStatus}
        onOpenChange={(o) => !o && setPendingStatus(null)}
        title={
          pendingStatus === "active"
            ? "Activate Account"
            : pendingStatus === "frozen"
            ? "Freeze Account"
            : "Block Account"
        }
        description={`Do you want to ${pendingStatus} ${p.email}'s account?`}
        onConfirm={async (sendMail) => {
          const patch: any =
            pendingStatus === "frozen"
              ? { status: "frozen", frozen: true }
              : pendingStatus === "active"
              ? { status: "active", frozen: false }
              : { status: "blocked", frozen: false };
          const { error } = await supabase.from("profiles").update(patch).eq("id", p.id);
          if (error) { toast.error(error.message); return; }
          setP({ ...p, ...patch });
          if (sendMail && pendingStatus && p.email) {
            const tpl = accountStatusEmail(pendingStatus);
            const res = await sendEmail({ email: p.email, first_name: p?.first_name ?? "", ...tpl });
            if (!res.success) toast.error("Status updated. Email notification could not be sent.");
            else toast.success("Status updated · Email sent");
          } else {
            toast.success("Status updated");
          }
          setPendingStatus(null);
        }}
      />

      {/* KYC confirm dialog with Send Mail */}
      <ConfirmActionDialog
        open={!!confirmKyc}
        onOpenChange={(o) => !o && setConfirmKyc(null)}
        title={confirmKyc === "approved" ? "Approve KYC" : "Reject KYC"}
        description={`Do you want to ${confirmKyc === "approved" ? "approve" : "reject"} this KYC submission?`}
        onConfirm={async (sendMail) => {
          if (!confirmKyc) return;
          const patch =
            confirmKyc === "approved"
              ? { status: "approved", reviewed_at: new Date().toISOString(), rejection_reason: null }
              : { status: "rejected", reviewed_at: new Date().toISOString(), rejection_reason: rejectionReason || null };
          const { error } = await supabase.from("id_verifications").update(patch).eq("user_id", p.id);
          if (error) { toast.error(error.message); return; }
          await update({ kyc_status: confirmKyc });
          if (sendMail && p.email) {
            const tpl = kycEmail(confirmKyc, rejectionReason);
            const res = await sendEmail({ email: p.email, first_name: p?.first_name ?? "", ...tpl });
            if (!res.success) toast.error("Status updated. Email notification could not be sent.");
            else toast.success("KYC updated · Email sent");
          } else {
            toast.success("KYC updated");
          }
          setRejectionReason("");
          setConfirmKyc(null);
          load();
        }}
      />

      {/* Code save confirm: Save / Cancel, email only sent if "send mail" is ticked */}
      <ConfirmActionDialog
        open={!!pendingCode}
        onOpenChange={(o) => !o && setPendingCode(null)}
        title={pendingCode ? `Save ${pendingCode.type} Code` : "Save Code"}
        description={
          pendingCode
            ? `Save the ${pendingCode.type} code ${pendingCode.code}? Tick the send mail option to also email it to the user.`
            : ""
        }
        confirmLabel="Save"
        onConfirm={async (sm) => { await saveCodeWithEmail(sm); setPendingCode(null); }}
      />

      {/* Billing email confirm */}
      <ConfirmActionDialog
        open={confirmBilling}
        onOpenChange={setConfirmBilling}
        title="Send Billing Email"
        description="Do you want to send this email to the user?"
        showSendMail={false}
        confirmLabel="Send"
        onConfirm={async () => { await sendBillingEmail(); }}
      />

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

function Field({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value)} />
        <Button size="sm" onClick={() => onSave(v)} disabled={v === value}>Save</Button>
      </div>
    </div>
  );
}

function PinDisplay({ pin }: { pin: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label>Account PIN</Label>
      <div className="flex gap-2">
        <Input type={show ? "text" : "password"} value={pin || ""} readOnly placeholder="No PIN set" />
        <Button type="button" variant="outline" size="icon" onClick={() => setShow((s) => !s)}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function PasswordEditor({
  current, show, onToggle, onUpdate,
}: {
  current: string; show: boolean; onToggle: () => void; onUpdate: (next: string) => void | Promise<void>;
}) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const submit = async () => {
    if (next !== confirm) { toast.error("Passwords do not match"); return; }
    await onUpdate(next);
    setNext(""); setConfirm("");
  };
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <h3 className="text-lg font-bold">User password</h3>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Current</p>
        <div className="flex gap-2">
          <Input type={show ? "text" : "password"} value={current} readOnly />
          <Button type="button" variant="outline" size="icon" onClick={onToggle}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {!current && <p className="text-xs text-muted-foreground">No password stored yet.</p>}
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">New password</p>
        <Input type={show ? "text" : "password"} value={next} placeholder="At least 6 characters" onChange={(e) => setNext(e.target.value)} />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Confirm new password</p>
        <Input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <Button size="sm" className="w-full" onClick={submit} disabled={!next || !confirm}>
        Update password
      </Button>
    </div>
  );
}
