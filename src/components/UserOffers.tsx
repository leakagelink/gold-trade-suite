import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gift, Sparkles } from "lucide-react";

interface Offer {
  id: string;
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

export default function UserOffers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchOffers = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data, error } = await supabase
      .from("user_offers")
      .select("*")
      .eq("user_id", auth.user.id)
      .in("status", ["pending", "claimed"])
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load offers", error);
      return;
    }
    setOffers((data as Offer[]) || []);
  };

  useEffect(() => {
    fetchOffers();
    let channel: any;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      channel = supabase
        .channel(`user_offers_${auth.user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_offers", filter: `user_id=eq.${auth.user.id}` },
          () => fetchOffers(),
        )
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const claim = async (id: string) => {
    setClaimingId(id);
    try {
      const { error } = await supabase.rpc("claim_user_offer", { p_offer_id: id });
      if (error) throw error;
      toast.success("Bonus credited to your wallet!");
      fetchOffers();
    } catch (e: any) {
      toast.error(e.message || "Failed to claim offer");
    } finally {
      setClaimingId(null);
    }
  };

  if (offers.length === 0) return null;

  return (
    <div className="space-y-3 bg-muted/40 p-5 rounded-[28px] border border-border animate-fade-in">
      <div className="flex items-center gap-2">
        <Gift className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Your Offers</h3>
      </div>
      <div className="space-y-3">
        {offers.map((o) => {
          const expired =
            o.status === "pending" && o.expires_at && new Date(o.expires_at) < new Date();
          return (
            <div
              key={o.id}
              className="relative overflow-hidden p-4 rounded-2xl bg-card border border-border"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    <p className="font-semibold text-sm truncate">{o.title}</p>
                  </div>
                  {o.description && (
                    <p className="text-xs text-muted-foreground mb-2">{o.description}</p>
                  )}
                  {o.offer_type === "deposit_bonus" ? (
                    <p className="text-2xl font-bold text-primary">
                      +{Number(o.bonus_percentage ?? 0)}% on next deposit
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-primary">
                      +${Number(o.bonus_amount).toFixed(2)} {o.currency}
                    </p>
                  )}
                  {o.offer_type === "deposit_bonus" && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {o.min_deposit_amount ? `Min deposit $${Number(o.min_deposit_amount).toFixed(2)}. ` : ""}
                      {o.max_bonus_amount ? `Max bonus $${Number(o.max_bonus_amount).toFixed(2)}. ` : ""}
                      Auto-credited when your deposit is approved.
                    </p>
                  )}
                  {o.expires_at && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Expires: {new Date(o.expires_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {o.status === "claimed" ? (
                    <Badge variant="default">Claimed</Badge>
                  ) : expired ? (
                    <Badge variant="outline">Expired</Badge>
                  ) : o.offer_type === "deposit_bonus" ? (
                    <Badge variant="secondary">Auto on deposit</Badge>
                  ) : (
                    <Button size="sm" disabled={claimingId === o.id} onClick={() => claim(o.id)}>
                      {claimingId === o.id ? "Claiming..." : "Claim"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
