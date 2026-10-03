import PageShell from "@/components/PageShell";
import { Zap } from "lucide-react";
import { LiveSignals } from "@/components/home/LiveSignals";
import { Seo } from "@/components/Seo";

const Signals = () => {
  return (
    <PageShell
      title="Premium Signals"
      subtitle="Broker-curated trade ideas with entry, take profit & stop loss"
      icon={Zap}
      maxWidth="6xl"
    >
      <Seo title="Premium Trading Signals — Grow FX Trade" description="Broker-curated buy and sell signals with entry, take profit and stop loss across crypto, forex and commodities." path="/signals" />
      <div className="-mx-3 sm:-mx-4">
        <LiveSignals authenticated />
      </div>
    </PageShell>
  );
};

export default Signals;
