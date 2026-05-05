import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Cards() {
  const [users, setUsers] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id,email,full_name")
      .order("full_name")
      .then(({ data }) => setUsers(data ?? []));
  }, []);

  const loadCards = async (uid: string) => {
    const { data } = await supabase.from("cards").select("*").eq("user_id", uid);
    setCards(data ?? []);
  };

  useEffect(() => {
    if (selected) loadCards(selected);
  }, [selected]);

  const save = async (c: any) => {
    const { id, ...rest } = c;
    const { error } = await supabase.from("cards").update(rest).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Card updated");
  };

  const addCard = async () => {
    if (!selected) return;
    await supabase.from("cards").insert({ user_id: selected, card_holder: "", card_number: "" });
    loadCards(selected);
  };

  const del = async (id: string) => {
    await supabase.from("cards").delete().eq("id", id);
    loadCards(selected);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <Label>Select user</Label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="Pick a user…" />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {selected && (
        <>
          <Button onClick={addCard} className="w-full">+ Add new card</Button>
          {cards.map((c, idx) => (
            <Card key={c.id} className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Card #{idx + 1}</p>
                <Button size="icon" variant="ghost" onClick={() => del(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {(["card_holder", "card_number", "expiry", "cvv", "card_type", "status"] as const).map((k) => (
                <div key={k} className="space-y-1">
                  <Label className="capitalize">{k.replace("_", " ")}</Label>
                  <Input
                    value={c[k] ?? ""}
                    onChange={(e) => {
                      const next = [...cards];
                      next[idx] = { ...c, [k]: e.target.value };
                      setCards(next);
                    }}
                  />
                </div>
              ))}
              <Button onClick={() => save(c)} className="w-full">Save card</Button>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
