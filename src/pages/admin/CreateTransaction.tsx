import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import type { Profile } from "@/types/db";
import { fullName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TYPES = ["deposit", "withdrawal", "transfer", "refund"];
const STATUSES = ["completed", "pending", "failed", "processing"];

export default function CreateTransaction() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("deposit");
  const [status, setStatus] = useState("completed");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id,first_name,last_name,email,account_number,balance,currency")
      .order("created_at", { ascending: false })
      .then(({ data }) => setUsers((data as Profile[]) ?? []));
  }, []);

  const selected = useMemo(() => users.find((u) => u.id === userId), [users, userId]);

  const submit = async () => {
    if (!userId) return toast.error("Select a user");
    const amt = Number(amount);
    if (!amt || isNaN(amt)) return toast.error("Enter an amount");
    setSubmitting(true);

    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      amount: amt,
      type,
      status,
      description: description || null,
      currency: selected?.currency || "USD",
      created_at: new Date(date).toISOString(),
    });

    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }

    // Update balance if completed
    if (status === "completed" && selected) {
      const next = Number(selected.balance ?? 0) + amt;
      await supabase.from("profiles").update({ balance: next }).eq("id", selected.id);
    }

    toast.success("Transaction created");
    setAmount("");
    setDescription("");
    setSubmitting(false);
  };

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-4">
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
        </div>

        <div className="space-y-1.5">
          <Label>Amount (negative for debit)</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Wire transfer received" />
        </div>

        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting ? "Creating…" : "Create transaction"}
        </Button>
      </Card>
    </div>
  );
}
