import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeForexData } from "@/lib/forexCache";
import { isCommoditySymbol, isForexSymbol } from "@/lib/marketSymbols";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Layers, Search, X, Trash2, Edit, Plus } from "lucide-react";

interface Profile { id: string; full_name: string | null; email: string | null; }
interface Pos {
  id: string; user_id: string; symbol: string; position_type: "long" | "short";
  amount: number; entry_price: number; current_price: number; margin: number;
  leverage: number; pnl: number | null; price_mode: string | null;
}

async function fetchLivePrice(symbol: string): Promise<number> {
  const s = symbol.toUpperCase().trim();
  if (isForexSymbol(s)) {
    const { data, error } = await invokeForexData();
    if (error) throw error;
    const hit = (data as any)?.forexData?.find((f: any) =>
      f.name?.toUpperCase() === s || f.symbol?.toUpperCase() === s);
    if (!hit?.price) throw new Error(`Price for ${s} not found`);
    return parseFloat(hit.price);
  }
  const fn = isCommoditySymbol(s) ? "fetch-commodities-data" : "fetch-crypto-data";
  const key = isCommoditySymbol(s) ? "commoditiesData" : "cryptoData";
  const { data, error } = await supabase.functions.invoke(fn);
  if (error) throw error;
  const hit = (data as any)?.[key]?.find((c: any) => c.symbol?.toUpperCase() === s);
  if (!hit?.price) throw new Error(`Price for ${s} not found`);
  return parseFloat(hit.price);
}

export function AdminBulkTrades() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [positions, setPositions] = useState<Pos[]>([]);
  const [busy, setBusy] = useState(false);

  // Bulk open form
  const [userSearch, setUserSearch] = useState("");
  const [selUsers, setSelUsers] = useState<Set<string>>(new Set());
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"long" | "short">("long");
  const [margin, setMargin] = useState("");
  const [leverage, setLeverage] = useState("10");
  const [priceMode, setPriceMode] = useState<"live" | "manual">("live");
  const [manualPrice, setManualPrice] = useState("");

  // Manage
  const [posSearch, setPosSearch] = useState("");
  const [selPos, setSelPos] = useState<Set<string>>(new Set());
  const [newPrice, setNewPrice] = useState("");
  const [confirm, setConfirm] = useState<null | "close" | "delete">(null);

  const nameOf = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u?.full_name || u?.email || id.slice(0, 8);
  };

  const load = async () => {
    const [{ data: p }, { data: pos }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").eq("is_approved", true).order("full_name"),
      supabase.from("positions").select("*").eq("status", "open").order("opened_at", { ascending: false }),
    ]);
    setUsers((p as Profile[]) || []);
    setPositions((pos as Pos[]) || []);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("bulk-trades-positions")
      .on("postgres_changes", { event: "*", schema: "public", table: "positions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return users.filter((u) => (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q));
  }, [users, userSearch]);

  const filteredPos = useMemo(() => {
    const q = posSearch.toLowerCase();
    return positions.filter((p) => p.symbol.toLowerCase().includes(q) || nameOf(p.user_id).toLowerCase().includes(q));
  }, [positions, posSearch, users]);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n);
  };

  const handleBulkOpen = async () => {
    const m = parseFloat(margin); const lev = parseInt(leverage);
    if (!selUsers.size || !symbol.trim()) return toast.error("Users aur symbol select kijiye");
    if (!(m > 0) || !(lev >= 1 && lev <= 100)) return toast.error("Valid amount aur leverage (1–100) daaliye");
    setBusy(true);
    try {
      const price = priceMode === "live" ? await fetchLivePrice(symbol) : parseFloat(manualPrice);
      if (!(price > 0)) throw new Error("Valid entry price daaliye");
      let ok = 0; const fails: string[] = [];
      for (const uid of selUsers) {
        const { error } = await supabase.rpc("admin_open_trade" as any, {
          p_user_id: uid, p_symbol: symbol.trim(), p_position_type: side,
          p_margin: m, p_leverage: lev, p_price: price, p_price_mode: priceMode,
        });
        if (error) fails.push(`${nameOf(uid)}: ${error.message}`); else ok++;
      }
      if (ok) toast.success(`${ok} trade(s) opened @ $${price.toFixed(4)}`);
      fails.forEach((f) => toast.error(f));
      setSelUsers(new Set());
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  const handleBulkEdit = async () => {
    const price = parseFloat(newPrice);
    if (!selPos.size || !(price > 0)) return toast.error("Trades select karke valid price daaliye");
    setBusy(true);
    let ok = 0;
    for (const id of selPos) {
      const p = positions.find((x) => x.id === id); if (!p) continue;
      const pnl = (p.position_type === "long" ? price - p.entry_price : p.entry_price - price) * p.amount;
      const drift = Math.random() * 0.9 + 0.1;
      const dir = Math.random() < 0.5 ? "up" : "down";
      const pct = p.margin > 0 ? (pnl / p.margin) * 100 : 0;
      const { error } = await supabase.from("positions").update({
        current_price: price, pnl, price_mode: "edited", momentum_active: true,
        momentum_direction: dir, edited_pnl_anchor: pnl,
        momentum_target_pnl_percent: pct + (dir === "up" ? drift : -drift),
        momentum_target_price: null, updated_at: new Date().toISOString(),
      } as any).eq("id", id).eq("status", "open");
      if (error) toast.error(`${p.symbol}: ${error.message}`); else ok++;
    }
    setBusy(false);
    if (ok) toast.success(`${ok} trade(s) updated`);
    setSelPos(new Set()); setNewPrice(""); load();
  };

  const runConfirmed = async () => {
    const action = confirm; setConfirm(null);
    setBusy(true);
    let ok = 0;
    for (const id of selPos) {
      const p = positions.find((x) => x.id === id);
      const { error } = action === "close"
        ? await supabase.rpc("user_close_trade" as any, {
            p_position_id: id, p_close_price: p?.current_price ?? null, p_close_brokerage: 0, p_force_loss: false,
          })
        : await supabase.rpc("admin_cancel_trade" as any, { p_position_id: id });
      if (error) toast.error(`${p?.symbol ?? ""}: ${error.message}`); else ok++;
    }
    setBusy(false);
    if (ok) toast.success(action === "close" ? `${ok} trade(s) closed` : `${ok} trade(s) deleted, margin refunded`);
    setSelPos(new Set()); load();
  };

  const allSelected = filteredPos.length > 0 && filteredPos.every((p) => selPos.has(p.id));

  return (
    <Card className="p-4 sm:p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold">Bulk Trades</h2>
      </div>
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open"><Plus className="h-4 w-4 mr-1" />Bulk Open</TabsTrigger>
          <TabsTrigger value="manage">Manage ({positions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="grid gap-4 md:grid-cols-2 mt-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Users ({selUsers.size} selected)</Label>
              <Button variant="ghost" size="sm" onClick={() =>
                setSelUsers(selUsers.size === filteredUsers.length ? new Set() : new Set(filteredUsers.map((u) => u.id)))}>
                {selUsers.size === filteredUsers.length && filteredUsers.length ? "Clear" : "Select all"}
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search users" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
            </div>
            <ScrollArea className="h-64 rounded-md border">
              {filteredUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer">
                  <Checkbox checked={selUsers.has(u.id)} onCheckedChange={() => toggle(selUsers, u.id, setSelUsers)} />
                  <span className="text-sm font-medium">{u.full_name || "—"}</span>
                  <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                </label>
              ))}
            </ScrollArea>
          </div>
          <div className="space-y-3">
            <div><Label>Symbol</Label><Input placeholder="BTC, XAU, EUR/USD" value={symbol} onChange={(e) => setSymbol(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={side === "long" ? "default" : "outline"} onClick={() => setSide("long")}>Buy</Button>
              <Button variant={side === "short" ? "destructive" : "outline"} onClick={() => setSide("short")}>Sell</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Amount per user ($)</Label><Input type="number" value={margin} onChange={(e) => setMargin(e.target.value)} /></div>
              <div><Label>Leverage</Label><Input type="number" min={1} max={100} value={leverage} onChange={(e) => setLeverage(e.target.value)} /></div>
            </div>
            <div>
              <Label>Price</Label>
              <Select value={priceMode} onValueChange={(v) => setPriceMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live market price</SelectItem>
                  <SelectItem value="manual">Manual price</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {priceMode === "manual" && (
              <div><Label>Entry price</Label><Input type="number" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} /></div>
            )}
            <Button className="w-full" disabled={busy} onClick={handleBulkOpen}>
              {busy ? "Working..." : `Open trade for ${selUsers.size} user(s)`}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="manage" className="space-y-3 mt-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search symbol or user" value={posSearch} onChange={(e) => setPosSearch(e.target.value)} />
            </div>
            <Input className="w-36" type="number" placeholder="New price" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
            <Button variant="outline" disabled={busy || !selPos.size} onClick={handleBulkEdit}><Edit className="h-4 w-4 mr-1" />Edit price</Button>
            <Button variant="outline" disabled={busy || !selPos.size} onClick={() => setConfirm("close")}><X className="h-4 w-4 mr-1" />Close</Button>
            <Button variant="destructive" disabled={busy || !selPos.size} onClick={() => setConfirm("delete")}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
          </div>
          <ScrollArea className="h-80 rounded-md border">
            <label className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50 text-xs font-medium cursor-pointer">
              <Checkbox checked={allSelected} onCheckedChange={() =>
                setSelPos(allSelected ? new Set() : new Set(filteredPos.map((p) => p.id)))} />
              Select all ({selPos.size} selected)
            </label>
            {filteredPos.map((p) => (
              <label key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 border-b hover:bg-muted cursor-pointer text-sm">
                <Checkbox checked={selPos.has(p.id)} onCheckedChange={() => toggle(selPos, p.id, setSelPos)} />
                <span className="font-medium w-32 truncate">{nameOf(p.user_id)}</span>
                <span className="font-semibold">{p.symbol}</span>
                <Badge variant={p.position_type === "long" ? "default" : "destructive"}>{p.position_type === "long" ? "BUY" : "SELL"}</Badge>
                <span className="text-muted-foreground">Entry ${Number(p.entry_price).toFixed(4)}</span>
                <span className="text-muted-foreground">Now ${Number(p.current_price).toFixed(4)}</span>
                <span className="text-muted-foreground">Margin ${Number(p.margin).toFixed(2)}</span>
                <span className={Number(p.pnl ?? 0) >= 0 ? "text-success font-medium" : "text-destructive font-medium"}>
                  {Number(p.pnl ?? 0) >= 0 ? "+" : ""}${Number(p.pnl ?? 0).toFixed(2)}
                </span>
                {p.price_mode === "edited" && <Badge variant="outline">Edited</Badge>}
              </label>
            ))}
            {!filteredPos.length && <p className="p-6 text-center text-sm text-muted-foreground">No open trades</p>}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "close" ? "Close" : "Delete"} {selPos.size} trade(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "close"
                ? "Trades current price par close honge aur margin + PnL user ke wallet me jayega."
                : "Trades hamesha ke liye delete honge aur sirf margin user ko wapas milega (koi PnL nahi)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirmed}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
