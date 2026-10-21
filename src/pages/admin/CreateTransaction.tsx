import { useEffect, useMemo, useState } from "react";
import { supabase, supabaseAdmin } from "@/lib/supabase"; 
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { fullName, fmtMoney } from "@/lib/format";
import { toast } from "sonner";
import type { Profile } from "@/types/db";

const TX_TYPES = [
  { label: "Credit (transfer_in)",     value: "transfer_in",       sign: 1  },
  { label: "Debit (transfer_out)",      value: "transfer_out",      sign: -1 },
  { label: "Deposit",                   value: "deposit",           sign: 1  },
  { label: "FX",                        value: "fx",                sign: 1  },
  { label: "Loan Disbursement",         value: "loan_disbursement", sign: 1  },
  { label: "Bill Payment",              value: "bill_payment",      sign: -1 },
  { label: "Refund",                    value: "refund",            sign: 1  },
] as const;

type TxTypeValue = typeof TX_TYPES[number]["value"];

const STATUSES = ["completed", "pending", "processing", "failed"];

function generateReference() {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TXN-${Date.now()}-${rand}`;
}

export default function CreateTransaction() {
  const [users, setUsers]           = useState<Profile[]>([]);
  const [transactions, setTxs]      = useState<any[]>([]);
  const [userId, setUserId]         = useState("");
  const [amount, setAmount]         = useState("");
  const [txType, setTxType]         = useState<TxTypeValue>("transfer_in");
  const [status, setStatus]         = useState("completed");
  const [description, setDescription] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [date, setDate]             = useState(() => new Date().toISOString().slice(0, 10));
  const [open, setOpen]             = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQ, setSearchQ]       = useState("");

  // Load users
  useEffect(() => {
  supabase
    .from("profiles")
    .select("id,first_name,last_name,email,account_number,balance,currency")
    .order("created_at", { ascending: false })
    .then(({ data, error }) => {
      if (error) console.error("profiles error:", error);
      setUsers((data as Profile[]) ?? []);
    });
}, []);


  // Load transactions for selected user
  useEffect(() => {
    if (!userId) { setTxs([]); return; }
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setTxs(data ?? []));
  }, [userId]);


  const selected    = useMemo(() => users.find((u) => u.id === userId), [users, userId]);
  const typeConfig  = useMemo(() => TX_TYPES.find((t) => t.value === txType)!, [txType]);

  const filteredTxs = useMemo(() => {
    if (!searchQ) return transactions;
    const q = searchQ.toLowerCase();
    return transactions.filter((t) =>
      (t.description || "").toLowerCase().includes(q) ||
      (t.reference || "").toLowerCase().includes(q) ||
      (t.recipient_name || "").toLowerCase().includes(q)
    );
  }, [transactions, searchQ]);

  const submit = async () => {
    if (!userId) return toast.error("Select a user");
    const rawAmt = parseFloat(amount);
    if (!rawAmt || isNaN(rawAmt) || rawAmt <= 0) return toast.error("Enter a positive amount");

    const signedAmount = typeConfig.sign * Math.abs(rawAmt);
    const reference    = generateReference();
    const currency     = selected?.currency || "USD";

    setSubmitting(true);

    const { error } = await supabase.from("transactions").insert({
      user_id:        userId,
      amount:         signedAmount,
      type:           txType,
      status,
      description:    description || null,
      recipient_name: recipientName || null,
      reference,
      currency,
      created_at:     new Date(date).toISOString(),
    });

    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }

    // Update balance only when completed
    if (status === "completed" && selected) {
      const next = Number(selected.balance ?? 0) + signedAmount;
      await supabase.from("profiles").update({ balance: next }).eq("id", selected.id);
      setUsers((prev) => prev.map((u) => u.id === selected.id ? { ...u, balance: next } : u));
    }

    // Refresh transaction list
    const { data: fresh } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setTxs(fresh ?? []);

    toast.success(`Transaction created · ${reference}`);
    setAmount("");
    setDescription("");
    setRecipientName("");
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">

      {/* ── CREATE FORM ── */}
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold text-base">Create Transaction</h2>

        {/* User picker */}
        <div className="space-y-1.5">
          <Label>User</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between">
                {selected ? `${fullName(selected)} · ${selected.email}` : "Select user…"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search users…" />
                <CommandList>
                  <CommandEmpty>No users found</CommandEmpty>
                  <CommandGroup>
                    {users.map((u) => (
                      <CommandItem
                        key={u.id}
                        value={`${fullName(u)} ${u.email} ${u.account_number}`}
                        onSelect={() => { setUserId(u.id); setOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", userId === u.id ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{fullName(u)} · {u.email}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selected && (
            <p className="text-xs text-muted-foreground">
              Balance: <strong>{fmtMoney(Number(selected.balance ?? 0), selected.currency)}</strong>
              &nbsp;·&nbsp;Acc: {selected.account_number}
            </p>
          )}
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <Label>Amount</Label>
          <Input
            type="number" step="0.01" min="0" placeholder="0.00"
            value={amount} onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* Type + Status */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={txType} onValueChange={(v) => setTxType(v as TxTypeValue)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TX_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description + Recipient */}
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input
            placeholder="e.g. International wire transfer received"
            value={description} onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Recipient / Sender Name <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            placeholder="e.g. John Smith"
            value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
          />
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Sign applied automatically · balance updates only on <strong>completed</strong>
        </p>

        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting ? "Creating…" : "Create Transaction"}
        </Button>
      </Card>

      {/* ── TRANSACTION HISTORY ── */}
      {userId && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold text-base">
              Transaction History
              {selected && <span className="ml-2 text-sm font-normal text-muted-foreground">— {fullName(selected)}</span>}
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search transactions…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 font-medium">Transaction</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredTxs.map((t) => {
                  const positive = Number(t.amount) > 0;
                  return (
                    <tr key={t.id}>
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
                            positive ? "bg-success/15 text-success" : "bg-muted text-foreground/70"
                          )}>
                            {positive
                              ? <ArrowDownLeft className="h-4 w-4" />
                              : <ArrowUpRight className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {t.description || t.recipient_name || t.type.replace(/_/g, " ")}
                            </p>
                            <p className="text-xs text-muted-foreground">{t.reference}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 capitalize text-muted-foreground">
                        {t.type.replace(/_/g, " ")}
                      </td>
                      <td className="py-4 text-muted-foreground whitespace-nowrap">
                        {new Date(t.created_at).toLocaleDateString(undefined, {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </td>
                      <td className="py-4">
                        <Badge variant="outline" className={cn(
                          "capitalize",
                          t.status === "completed"
                            ? "border-success/30 bg-success/10 text-success"
                            : t.status === "pending" || t.status === "processing"
                            ? "border-warning/30 bg-warning/10 text-warning"
                            : "border-destructive/30 bg-destructive/10 text-destructive"
                        )}>
                          {t.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className={cn(
                        "py-4 text-right font-bold tabular-nums",
                        positive ? "text-success" : ""
                      )}>
                        {positive ? "+" : "−"}
                        {fmtMoney(Math.abs(Number(t.amount)), t.currency)}
                      </td>
                    </tr>
                  );
                })}
                {filteredTxs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
