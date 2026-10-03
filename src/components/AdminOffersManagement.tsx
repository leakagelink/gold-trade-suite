import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Gift, Trash2, Search } from "lucide-react";

interface UserLite {
  id: string;
  email: string | null;
  full_name: string | null;
  client_id: string | null;
}

interface Offer {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  bonus_amount: number;
  currency: string;
  status: string;
  expires_at: string | null;
  claimed_at: string | null;
  created_at: string;
  offer_type?: string;
  bonus_percentage?: number | null;
  min_deposit_amount?: number | null;
  max_bonus_amount?: number | null;
}

export default function AdminOffersManagement() {
  const [users, setUsers] = useState<UserLite[]>([]);
  const [offers, setOffers] = useState<(Offer & { profile?: UserLite })[]>([]);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [offerType, setOfferType] = useState<"instant_bonus" | "deposit_bonus">("instant_bonus");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [bonusPct, setBonusPct] = useState("");
  const [minDeposit, setMinDeposit] = useState("");
  const [maxBonus, setMaxBonus] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,email,full_name,client_id")
        .order("created_at", { ascending: false });
      setUsers((data as UserLite[]) || []);
    })();
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    const { data, error } = await supabase
      .from("user_offers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    const offerRows = (data as Offer[]) || [];
    const ids = Array.from(new Set(offerRows.map((o) => o.user_id)));
    let profileMap = new Map<string, UserLite>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,email,full_name,client_id")
        .in("id", ids);
      profileMap = new Map((profs as UserLite[] || []).map((p) => [p.id, p]));
    }
    setOffers(offerRows.map((o) => ({ ...o, profile: profileMap.get(o.user_id) })));
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users.slice(0, 50);
    return users
      .filter(
        (u) =>
          (u.email || "").toLowerCase().includes(q) ||
          (u.full_name || "").toLowerCase().includes(q) ||
          (u.client_id || "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [users, search]);

  const handleCreate = async () => {
    if (!userId) return toast.error("Select a user");
    if (!title.trim()) return toast.error("Title is required");
    if (title.length > 120) return toast.error("Title must be 120 characters or less");

    let amt = 0;
    let pct: number | null = null;
    let minDep: number | null = null;
    let maxBon: number | null = null;

    if (offerType === "instant_bonus") {
      amt = parseFloat(amount);
      if (!Number.isFinite(amt) || amt <= 0)
        return toast.error("Bonus amount must be greater than 0");
      if (amt > 1_000_000) return toast.error("Bonus amount cannot exceed $1,000,000");
    } else {
      pct = parseFloat(bonusPct);
      if (!Number.isFinite(pct as number) || (pct as number) <= 0 || (pct as number) > 1000)
        return toast.error("Bonus % must be between 0 and 1000");
      if (minDeposit.trim() !== "") {
        minDep = parseFloat(minDeposit);
        if (!Number.isFinite(minDep) || minDep < 0)
          return toast.error("Min deposit must be 0 or greater");
      }
      if (maxBonus.trim() !== "") {
        maxBon = parseFloat(maxBonus);
        if (!Number.isFinite(maxBon) || maxBon <= 0)
          return toast.error("Max bonus cap must be greater than 0");
        if (maxBon > 1_000_000) return toast.error("Max bonus cap cannot exceed $1,000,000");
      }
      // deposit_bonus rows must not carry a fixed bonus_amount; backend constraint enforces this too.
      amt = 0;
    }

    let expiresIso: string | null = null;
    if (expiresAt) {
      const d = new Date(expiresAt);
      if (Number.isNaN(d.getTime())) return toast.error("Invalid expiry date");
      if (d.getTime() < Date.now()) return toast.error("Expiry must be in the future");
      expiresIso = d.toISOString();
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("user_offers").insert({
        user_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        bonus_amount: amt,
        currency: "USD",
        expires_at: expiresIso,
        created_by: auth.user?.id,
        offer_type: offerType,
        bonus_percentage: pct,
        min_deposit_amount: minDep,
        max_bonus_amount: maxBon,
      } as any);
      if (error) throw error;
      toast.success("Offer created");
      setTitle("");
      setDescription("");
      setAmount("");
      setBonusPct("");
      setMinDeposit("");
      setMaxBonus("");
      setExpiresAt("");
      setUserId("");
    } catch (e: any) {
      toast.error(e.message || "Failed to create offer");
    } finally {
      setSaving(false);
      fetchOffers();
    }
  };

  const cancelOffer = async (id: string) => {
    const { error } = await supabase
      .from("user_offers")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Offer cancelled");
    fetchOffers();
  };

  const deleteOffer = async (id: string) => {
    const { error } = await supabase.from("user_offers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Offer deleted");
    fetchOffers();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" /> Create User Offer / Bonus
          </CardTitle>
          <CardDescription>
            Send a one-time bonus to a specific user. They will see it in their profile and can claim it
            into their USD wallet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Find User</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name, email or client ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {filteredUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {(u.full_name || u.email || u.id)}
                      {u.client_id ? ` — ${u.client_id}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Offer Type</Label>
              <Select value={offerType} onValueChange={(v) => setOfferType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant_bonus">Instant Bonus (claim from profile)</SelectItem>
                  <SelectItem value="deposit_bonus">Deposit Bonus (auto on next deposit)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {offerType === "instant_bonus" ? (
              <div className="space-y-2">
                <Label>Bonus Amount (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 50"
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Bonus % on Deposit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bonusPct}
                    onChange={(e) => setBonusPct(e.target.value)}
                    placeholder="e.g. 20 (= 20% of deposit)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Deposit (USD, optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={minDeposit}
                    onChange={(e) => setMinDeposit(e.target.value)}
                    placeholder="e.g. 50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Bonus Cap (USD, optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={maxBonus}
                    onChange={(e) => setMaxBonus(e.target.value)}
                    placeholder="e.g. 500"
                  />
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Welcome Bonus"
                maxLength={120}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short message shown to the user"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Expires At (optional)</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Creating..." : "Create Offer"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Offers</CardTitle>
          <CardDescription>Pending offers are claimable by users; claimed offers credit the wallet.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount / %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                      No offers yet
                    </TableCell>
                  </TableRow>
                )}
                {offers.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {o.profile?.full_name || o.profile?.email || o.user_id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-muted-foreground">{o.profile?.client_id}</div>
                    </TableCell>
                    <TableCell>{o.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {o.offer_type === "deposit_bonus" ? "Deposit Bonus" : "Instant"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {o.offer_type === "deposit_bonus"
                        ? `${Number(o.bonus_percentage ?? 0)}%${o.max_bonus_amount ? ` (max $${Number(o.max_bonus_amount).toFixed(2)})` : ""}`
                        : `$${Number(o.bonus_amount).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          o.status === "claimed"
                            ? "default"
                            : o.status === "pending"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {o.expires_at ? new Date(o.expires_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(o.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {o.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => cancelOffer(o.id)}>
                          Cancel
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => deleteOffer(o.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
