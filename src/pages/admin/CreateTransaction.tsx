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
import {
 Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import type { Profile } from "@/types/db";
import { fullName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TYPES = ["credit", "debit", "refund"] as const;
type TxType = typeof TYPES[number];

const STATUS_OPTIONS: Record<TxType, string[]> = {
 credit: ["pending", "completed", "failed", "processing", "rejected"],
 debit:  ["pending", "completed", "failed", "processing", "rejected"],
 refund: ["refund"],
};

const TYPE_MAP: Record<TxType, string> = {
 credit: "transfer_in",
 debit:  "transfer_out",
 refund: "refund",
};

function generateReference(): string {
 const ts = Date.now();
 const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
 return `TXN-${ts}-${rand}`;
}

export default function CreateTransaction() {
 const [users, setUsers] = useState<Profile[]>([]);
 const [userId, setUserId] = useState<string>("");
 const [amount, setAmount] = useState("");
 const [type, setType] = useState<TxType>("credit");
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

 const handleTypeChange = (val: TxType) => {
   setType(val);
   setStatus(STATUS_OPTIONS[val][0]);
 };

 const selected = useMemo(() => users.find((u) => u.id === userId), [users, userId]);

 const submit = async () => {
   if (!userId) return toast.error("Select a user");

   const rawAmt = Number(amount);
   if (!rawAmt || isNaN(rawAmt) || rawAmt <= 0)
     return toast.error("Enter a positive amount");

   const signedAmount = type === "debit" ? -Math.abs(rawAmt) : Math.abs(rawAmt);
   const dbType = TYPE_MAP[type];
   const reference = generateReference();

   setSubmitting(true);

   const { error } = await supabase.from("transactions").insert({
     user_id: userId,
     amount: signedAmount,
     type: dbType,
     status,
     description: description || null,
     reference,
     currency: selected?.currency || "USD",
     created_at: new Date(date).toISOString(),
   });

   if (error) {
     setSubmitting(false);
     return toast.error(error.message);
   }

   const isSettled = status === "completed" || status === "refund";
   if (isSettled && selected) {
     const next = Number(selected.balance ?? 0) + signedAmount;
     await supabase.from("profiles").update({ balance: next }).eq("id", selected.id);
     setUsers((prev) =>
       prev.map((u) => u.id === selected.id ? { ...u, balance: next } : u)
     );
   }

   toast.success(`Transaction created · ${reference}`);
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
         {selected && (
           <p className="text-xs text-muted-foreground">
             Balance: {selected.currency} {Number(selected.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
             &nbsp;·&nbsp;Acc: {selected.account_number}
           </p>
         )}
       </div>

       <div className="space-y-1.5">
         <Label>Amount</Label>
         <Input
           type="number"
           step="0.01"
           min="0"
           placeholder="0.00"
           value={amount}
           onChange={(e) => setAmount(e.target.value)}
         />
         <p className="text-xs text-muted-foreground">
           Always enter a positive number — sign is applied automatically based on type.
         </p>
       </div>

       <div className="grid grid-cols-2 gap-2">
         <div className="space-y-1.5">
           <Label>Type</Label>
           <Select value={type} onValueChange={(v) => handleTypeChange(v as TxType)}>
             <SelectTrigger><SelectValue /></SelectTrigger>
             <SelectContent>
               {TYPES.map((t) => (
                 <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
               ))}
             </SelectContent>
           </Select>
         </div>
         <div className="space-y-1.5">
           <Label>Status</Label>
           <Select value={status} onValueChange={setStatus}>
             <SelectTrigger><SelectValue /></SelectTrigger>
             <SelectContent>
               {STATUS_OPTIONS[type].map((s) => (
                 <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
               ))}
             </SelectContent>
           </Select>
         </div>
       </div>

       <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
         {type === "credit" && "➕ Positive amount · stored as transfer_in · balance updated on completed"}
         {type === "debit"  && "➖ Negative amount · stored as transfer_out · balance updated on completed"}
         {type === "refund" && "↩️ Positive amount · stored as refund · balance updated immediately"}
       </p>

       <div className="space-y-1.5">
         <Label>Description</Label>
         <Input
           value={description}
           onChange={(e) => setDescription(e.target.value)}
           placeholder="e.g. International wire transfer received"
         />
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
