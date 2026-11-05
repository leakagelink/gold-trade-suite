import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Shield,
  TrendingUp,
  Wallet,
  LineChart,
  Globe,
  Award,
  CheckCircle,
  Users,
  Star,
  Zap,
  Bell,
  ArrowUp,
  ArrowDown,
  Newspaper,
  Sparkles,
  BarChart3,
  Cpu,
  Clock3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MarketNewsFeed } from "@/components/MarketNewsFeed";
import { TopMoversStrip } from "@/components/home/TopMoversStrip";
import { EconomicCalendar } from "@/components/home/EconomicCalendar";
import { TradingCalculator } from "@/components/home/TradingCalculator";
import { LiveSignals } from "@/components/home/LiveSignals";
import { TrustSecurity } from "@/components/home/TrustSecurity";
import { ComparisonTable } from "@/components/home/ComparisonTable";

import logo from "@/assets/logo.png";

const Index = () => {
  const navigate = useNavigate();

  const [recentActivities, setRecentActivities] = useState<
    Array<{ id: number; type: string; user: string; amount: string; time: string }>
  >([]);

  const [cryptoPrices, setCryptoPrices] = useState<{
    [key: string]: { price: number; change: number; previousPrice: number };
  }>({
    BTCUSDT: { price: 0, change: 0, previousPrice: 0 },
    ETHUSDT: { price: 0, change: 0, previousPrice: 0 },
    BNBUSDT: { price: 0, change: 0, previousPrice: 0 },
  });

  // Fetch crypto + momentum drift (kept from previous logic)
  useEffect(() => {
    const basePricesRef = { current: {} as Record<string, number> };

    const fetchCryptoPrices = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("fetch-crypto-data");
        if (error) throw error;
        if (data?.cryptoData && Array.isArray(data.cryptoData)) {
          const targetCoins = ["BTC", "ETH", "BNB"];
          data.cryptoData
            .filter((coin: any) => targetCoins.includes(coin.symbol))
            .forEach((coin: any) => {
              const symbolKey = `${coin.symbol}USDT`;
              basePricesRef.current[symbolKey] = parseFloat(coin.price);
            });
        }
      } catch (error) {
        console.error("Error fetching crypto prices:", error);
      }
    };

    const applyMomentum = () => {
      setCryptoPrices((prev) => {
        const updated: typeof prev = {};
        for (const symbolKey of Object.keys(basePricesRef.current)) {
          const basePrice = basePricesRef.current[symbolKey];
          if (!basePrice) continue;
          const prevPrice = prev[symbolKey]?.price || basePrice;
          const driftPercent = 0;
          const direction = Math.random() > 0.5 ? 1 : -1;
          const newPrice = basePrice + basePrice * driftPercent * direction;
          updated[symbolKey] = {
            price: newPrice,
            change: newPrice - prevPrice,
            previousPrice: prevPrice,
          };
        }
        return Object.keys(updated).length > 0 ? updated : prev;
      });
    };

    fetchCryptoPrices().then(() => applyMomentum());
    const baseInterval = setInterval(fetchCryptoPrices, 60000);
    const momentumInterval = setInterval(applyMomentum, 2000);
    return () => {
      clearInterval(baseInterval);
      clearInterval(momentumInterval);
    };
  }, []);

  useEffect(() => {
    const activities = [
      { id: 1, type: "Deposit", user: "James Carter", amount: "$5,000", time: "2 mins ago" },
      { id: 2, type: "Withdrawal", user: "Olivia Bennett", amount: "$12,500", time: "5 mins ago" },
      { id: 3, type: "Deposit", user: "Ethan Walker", amount: "$8,200", time: "8 mins ago" },
      { id: 4, type: "Trade", user: "Sophia Reynolds", amount: "$15,000", time: "12 mins ago" },
      { id: 5, type: "Deposit", user: "Mason Cooper", amount: "$6,800", time: "15 mins ago" },
    ];
    setRecentActivities(activities);

    const interval = setInterval(() => {
      setRecentActivities((prev) => {
        const newActivity = {
          id: Date.now(),
          type: ["Deposit", "Withdrawal", "Trade"][Math.floor(Math.random() * 3)],
          user: [
            "Liam Foster",
            "Ava Mitchell",
            "Noah Sullivan",
            "Isabella Hayes",
            "Lucas Brennan",
            "Mia Donovan",
            "Henry Whitaker",
          ][Math.floor(Math.random() * 7)],
          amount: `$${(Math.random() * 20000 + 1000)
            .toFixed(0)
            .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`,
          time: "Just now",
        };
        return [newActivity, ...prev.slice(0, 4)];
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: TrendingUp,
      title: "Crypto Trading",
      description: "Trade BTC, ETH and 100+ coins with live order books and instant execution.",
    },
    {
      icon: Globe,
      title: "Forex Markets",
      description: "Major, minor and exotic pairs with institutional-grade spreads.",
    },
    {
      icon: BarChart3,
      title: "Commodities",
      description: "Gold, silver, oil and indices with pro charting tools and indicators.",
    },
    {
      icon: Cpu,
      title: "Smart Execution",
      description: "Low-latency routing engineered for MT5-class speed and precision.",
    },
    {
      icon: Wallet,
      title: "Unified Wallet",
      description: "One balance across all markets with instant deposits and withdrawals.",
    },
    {
      icon: Shield,
      title: "Bank-Grade Security",
      description: "KYC, SSL encryption, segregated funds and 24/7 risk monitoring.",
    },
  ];

  const coinIcons: { [key: string]: string } = { BTC: "₿", ETH: "Ξ", BNB: "B" };

  return (
    <div className="min-h-screen bg-background overflow-hidden font-sans">
      <Seo
        title="SkyFX Trade — Trade Crypto, Forex & Commodities"
        description="Trade Crypto, Forex and Commodities on SkyFX Trade — a professional, secure platform with real-time markets, advanced tools and instant execution."
        path="/"
      />
      {/* ───────────────── NAV ───────────────── */}
      <nav className="sticky top-0 z-50 border-b border-border/60 backdrop-blur-xl bg-background/85">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer">
            <img
              src={logo}
              alt="SkyFX Trade"
              className="h-14 w-auto sm:h-20 object-contain transition-transform duration-300 hover:scale-105"
            />
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a href="#markets" className="hover:text-foreground transition-colors">Markets</a>
            <a href="#features" className="hover:text-foreground transition-colors">Platform</a>
            <a href="#signals" className="hover:text-foreground transition-colors">Signals</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate("/auth")}
              className="hidden sm:flex hover:bg-primary/5"
            >
              Sign In
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 sm:px-5"
              onClick={() => navigate("/auth")}
            >
              Get Started
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ───────────────── HERO: TRADING TERMINAL ───────────────── */}
      <section className="relative overflow-hidden border-b border-border/60 bg-hero">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.05]" />
          <div className="absolute -top-40 right-0 w-[700px] h-[700px] bg-accent/10 rounded-full blur-[160px]" />
        </div>
        <div className="container mx-auto px-3 sm:px-6 pt-8 sm:pt-14 pb-12 sm:pb-20 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12">
            <Badge className="mb-4 bg-accent/10 text-accent border border-accent/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse mr-2" />
              Markets live · 24/7 execution
            </Badge>
            <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-foreground mb-4">
              The pro trading desk for <span className="gradient-text">Crypto, Forex & Gold</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mb-7">
              Live charts, one-tap Buy/Sell, up to 100x leverage and a unified wallet — in one fast, secure terminal.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="bg-brand text-primary-foreground px-8 py-6 text-base rounded-xl font-semibold shadow-[var(--shadow-glow)] group" onClick={() => navigate("/auth")}>
                Open Trading Account
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
              </Button>
              <Button size="lg" variant="outline" className="border-2 px-8 py-6 text-base rounded-xl font-semibold bg-card" onClick={() => navigate("/auth")}>
                <LineChart className="mr-2 h-5 w-5 text-accent" /> Explore Markets
              </Button>
            </div>
          </div>

          {/* Terminal mockup */}
          <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-elevated)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/60">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-accent/50" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                <span className="ml-3 text-xs font-semibold text-muted-foreground tracking-wide">SkyFX Terminal</span>
              </div>
              <div className="hidden sm:flex gap-1 text-[11px] font-semibold">
                {["1M", "5M", "15M", "1H", "4H", "1D"].map((t) => (
                  <span key={t} className={`px-2 py-0.5 rounded ${t === "15M" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</span>
                ))}
              </div>
            </div>
            <div className="grid lg:grid-cols-12">
              {/* Watchlist */}
              <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-border">
                <p className="px-4 pt-3 pb-2 text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Watchlist</p>
                {Object.entries(cryptoPrices).map(([symbol, data]) => {
                  const name = symbol.replace("USDT", "");
                  const up = data.change >= 0;
                  return (
                    <button key={symbol} onClick={() => navigate("/auth")} className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/70 transition-colors ${name === "BTC" ? "bg-accent/5 border-l-2 border-accent" : "border-l-2 border-transparent"}`}>
                      <div className="flex items-center gap-2.5">
                        <span className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">{coinIcons[name]}</span>
                        <div>
                          <p className="text-sm font-bold text-foreground">{name}/USDT</p>
                          <p className="text-[11px] text-muted-foreground">Crypto</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-foreground">{data.price > 0 ? data.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}</p>
                        <p className={`text-[11px] font-semibold tabular-nums ${up ? "text-success" : "text-destructive"}`}>{up ? "▲" : "▼"} {Math.abs(data.change).toFixed(2)}</p>
                      </div>
                    </button>
                  );
                })}
                {[{ s: "XAU/USD", t: "Gold" }, { s: "EUR/USD", t: "Forex" }].map((m) => (
                  <button key={m.s} onClick={() => navigate("/auth")} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/70 border-l-2 border-transparent">
                    <div className="flex items-center gap-2.5">
                      <span className="h-8 w-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><Globe className="h-4 w-4" /></span>
                      <div><p className="text-sm font-bold text-foreground">{m.s}</p><p className="text-[11px] text-muted-foreground">{m.t}</p></div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>

              {/* Chart */}
              <div className="lg:col-span-6 p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-border">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold">BTC / USDT · Perpetual</p>
                    <p className="font-display text-3xl font-bold tabular-nums text-foreground">
                      ${cryptoPrices.BTCUSDT.price > 0 ? cryptoPrices.BTCUSDT.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold px-2 py-1 rounded-md ${cryptoPrices.BTCUSDT.change >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {cryptoPrices.BTCUSDT.change >= 0 ? "+" : ""}{cryptoPrices.BTCUSDT.change.toFixed(2)}
                  </span>
                </div>
                <svg viewBox="0 0 300 140" className="w-full h-48 sm:h-60" preserveAspectRatio="none">
                  {[28, 56, 84, 112].map((y) => (<line key={y} x1="0" x2="300" y1={y} y2={y} className="stroke-border" strokeDasharray="3 4" />))}
                  {[38, 52, 46, 64, 58, 74, 66, 82, 72, 90, 84, 98, 92, 104, 96, 112, 106, 118, 110, 122].map((h, i, arr) => {
                    const x = 8 + i * 14.6;
                    const prev = i ? arr[i - 1] : h - 6;
                    const up = h >= prev;
                    const top = 140 - Math.max(h, prev) - 6;
                    const bot = 140 - Math.min(h, prev) + 2;
                    return (
                      <g key={i} className={up ? "text-success" : "text-destructive"}>
                        <line x1={x} x2={x} y1={top - 6} y2={bot + 6} stroke="currentColor" strokeWidth="1" />
                        <rect x={x - 4} y={top} width="8" height={Math.max(bot - top, 3)} fill="currentColor" rx="1" />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Order ticket */}
              <div className="lg:col-span-3 p-4 sm:p-5 flex flex-col gap-3">
                <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Order Ticket</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => navigate("/auth")} className="rounded-lg py-3 font-bold bg-success text-primary-foreground hover:opacity-90">BUY</button>
                  <button onClick={() => navigate("/auth")} className="rounded-lg py-3 font-bold bg-destructive text-destructive-foreground hover:opacity-90">SELL</button>
                </div>
                {[["Amount", "$1,000.00"], ["Leverage", "20x"], ["Margin", "$50.00"], ["Stop Loss", "Optional"], ["Take Profit", "Optional"]].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-semibold tabular-nums text-foreground">{v}</span>
                  </div>
                ))}
                <Button className="mt-auto bg-primary text-primary-foreground font-semibold" onClick={() => navigate("/auth")}>
                  Start trading <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            {[
              { icon: BarChart3, v: "$2.4B+", l: "Monthly volume" },
              { icon: Zap, v: "12ms", l: "Avg execution" },
              { icon: Users, v: "50K+", l: "Active traders" },
              { icon: Shield, v: "100x", l: "Max leverage" },
            ].map((s) => (
              <div key={s.l} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <span className="h-10 w-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><s.icon className="h-5 w-5" /></span>
                <div><p className="font-display text-xl font-bold text-foreground">{s.v}</p><p className="text-xs text-muted-foreground">{s.l}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── TOP MOVERS STRIP ───────────────── */}
      <div id="markets"><TopMoversStrip /></div>

      {/* ───────────────── LIVE SIGNALS ───────────────── */}
      <div id="signals">
        <LiveSignals />
      </div>

      {/* ───────────────── TRADING CALCULATOR ───────────────── */}
      <TradingCalculator />

      {/* ───────────────── WHY CHOOSE / FEATURES ───────────────── */}
      <section id="features" className="py-14 sm:py-24 bg-background">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <p className="text-xs uppercase tracking-[0.22em] text-primary font-semibold mb-3">
              Why SkyFX Trade
            </p>
            <h2 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold mb-4">
              Built like a desk, <br className="hidden sm:block" />
              <span className="text-primary">priced like a startup.</span>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Everything serious traders need — without the legacy bloat.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => {
              const isAccent = index === 1 || index === 4;
              return (
                <Card
                  key={index}
                  className={`group p-6 sm:p-7 rounded-2xl border transition-all hover:-translate-y-1 ${
                    isAccent
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border/60 hover:border-primary/40"
                  }`}
                >
                  <div
                    className={`h-12 w-12 rounded-xl flex items-center justify-center mb-5 ${
                      isAccent
                        ? "bg-[hsl(var(--gold))] text-[hsl(var(--gold-foreground))]"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-xl font-bold mb-2">{feature.title}</h3>
                  <p
                    className={`text-sm leading-relaxed ${
                      isAccent ? "text-primary-foreground/85" : "text-muted-foreground"
                    }`}
                  >
                    {feature.description}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────── LIVE ACTIVITY FEED ───────────────── */}
      <section className="py-14 sm:py-20 bg-secondary/40 border-y border-border/60">
        <div className="container mx-auto px-3 sm:px-4 max-w-5xl">
          <div className="text-center mb-8 sm:mb-12">
            <p className="text-xs uppercase tracking-[0.22em] text-primary font-semibold mb-3 flex items-center gap-2 justify-center">
              <Zap className="h-3.5 w-3.5" />
              Real-time activity
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-bold">
              Traders are <span className="text-primary">making moves</span>
            </h2>
          </div>

          <Card className="p-3 sm:p-6 border-border/60 rounded-2xl bg-card">
            <div className="space-y-2">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-background hover:bg-secondary/60 border border-border/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activity.user}`}
                        alt={activity.user}
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                        {activity.user.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">{activity.user}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {activity.type === "Deposit" && (
                          <TrendingUp className="h-3 w-3 text-success" />
                        )}
                        {activity.type === "Withdrawal" && (
                          <Wallet className="h-3 w-3 text-primary" />
                        )}
                        {activity.type === "Trade" && (
                          <LineChart className="h-3 w-3 text-[hsl(var(--gold-foreground))]" />
                        )}
                        {activity.type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-base sm:text-lg text-primary">
                      {activity.amount}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Updates every 5 seconds
            </div>
          </Card>
        </div>
      </section>

      {/* ───────────────── TESTIMONIALS ───────────────── */}
      <section className="py-14 sm:py-24 bg-background">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="text-center mb-10 sm:mb-14 max-w-2xl mx-auto">
            <p className="text-xs uppercase tracking-[0.22em] text-primary font-semibold mb-3">
              Testimonials
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-bold">
              Trusted by traders worldwide
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {[
              {
                name: "Michael Chen",
                role: "Day Trader",
                content:
                  "Best trading platform I've used. Real-time data and execution are unmatched. +$50K profits last quarter.",
              },
              {
                name: "Sarah Williams",
                role: "Crypto Investor",
                content:
                  "Security features give me peace of mind. Withdrawals are smooth and support is excellent.",
              },
              {
                name: "Ajay Singh",
                role: "Forex Trader",
                content:
                  "Professional-grade tools at my fingertips. Low spreads make this my go-to for forex.",
              },
            ].map((t, i) => (
              <Card
                key={i}
                className="p-6 sm:p-7 rounded-2xl border-border/60 bg-card hover:shadow-[var(--shadow-elevated)] transition-all"
              >
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, idx) => (
                    <Star
                      key={idx}
                      className="h-4 w-4 fill-[hsl(var(--gold))] text-[hsl(var(--gold))]"
                    />
                  ))}
                </div>
                <p className="text-sm sm:text-base text-foreground/80 mb-6 leading-relaxed">
                  "{t.content}"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                  <Avatar className="h-11 w-11">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${t.name}`}
                      alt={t.name}
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                      {t.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── ECONOMIC CALENDAR ───────────────── */}
      <EconomicCalendar />

      {/* ───────────────── MARKET NEWS ───────────────── */}
      <section className="py-14 sm:py-20 bg-secondary/40 border-y border-border/60">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="text-center mb-8 sm:mb-12 max-w-2xl mx-auto">
            <p className="text-xs uppercase tracking-[0.22em] text-primary font-semibold mb-3 flex items-center justify-center gap-2">
              <Newspaper className="h-3.5 w-3.5" />
              Live news feed
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-bold mb-3">
              Global market news
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Crypto, Forex & Commodities — auto-refreshed every 5 minutes.
            </p>
          </div>
          <div className="max-w-7xl mx-auto">
            <MarketNewsFeed variant="landing" defaultCategory="all" limit={9} />
          </div>
        </div>
      </section>

      {/* ───────────────── TRUST & SECURITY ───────────────── */}
      <TrustSecurity />

      {/* ───────────────── COMPARISON ───────────────── */}
      <ComparisonTable />

      {/* ───────────────── FAQ ───────────────── */}
      <section id="faq" className="py-14 sm:py-24 bg-background">
        <div className="container mx-auto px-3 sm:px-4 max-w-4xl">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-xs uppercase tracking-[0.22em] text-primary font-semibold mb-3">
              FAQ
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-bold">
              Frequently asked questions
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {[
              {
                q: "How do I get started with SkyFX Trade?",
                a: "Create your free account, complete the KYC verification, deposit via UPI / Net Banking / Crypto, and start trading across markets within minutes.",
              },
              {
                q: "What are the deposit and withdrawal methods?",
                a: "We support USD bank wire, ACH, debit/credit cards and major crypto. Deposits are typically instant. Withdrawals are processed within 24–48 hours after broker approval.",
              },
              {
                q: "Is my money safe on SkyFX Trade?",
                a: "Yes — SSL encryption, segregated funds, cold storage for crypto, and strict KYC/AML policies keep your account and capital protected.",
              },
              {
                q: "How does leverage work?",
                a: "Leverage allows you to control larger positions with smaller capital — up to 100x on select markets. It amplifies both gains and losses, so trade responsibly.",
              },
              {
                q: "Are there any hidden fees?",
                a: "No. Transparent competitive spreads, no deposit fees and clearly listed withdrawal fees in your account settings.",
              },
              {
                q: "Can I trade on mobile?",
                a: "Yes — the entire platform is fully optimized for mobile and includes an Android app for native execution.",
              },
            ].map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border border-border/60 rounded-xl px-5 bg-card data-[state=open]:border-primary/40 transition-all"
              >
                <AccordionTrigger className="text-sm sm:text-base font-semibold hover:text-primary text-left">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ───────────────── FINAL CTA ───────────────── */}
      <section className="py-16 sm:py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.06]" />
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-[hsl(var(--gold))]/20 rounded-full blur-[140px]" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-[hsl(var(--gold))]/15 rounded-full blur-[140px]" />

        <div className="container mx-auto px-4 relative z-10 text-center max-w-3xl">
          <Badge className="mb-6 bg-[hsl(var(--gold))] text-[hsl(var(--gold-foreground))] border-0 px-4 py-1.5 text-xs uppercase tracking-[0.18em] font-bold rounded-full">
            <Zap className="h-3.5 w-3.5 mr-1.5" /> Start in 2 minutes
          </Badge>
          <h2 className="font-display text-4xl sm:text-6xl md:text-7xl font-bold mb-5 leading-[1.05]">
            Your edge starts <br />
            <span className="text-[hsl(var(--gold))]">today.</span>
          </h2>
          <p className="text-base sm:text-xl text-primary-foreground/85 mb-9 max-w-xl mx-auto">
            Join 50,000+ traders trusting SkyFX Trade for daily market access.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-[hsl(var(--gold))] text-[hsl(var(--gold-foreground))] hover:bg-[hsl(var(--gold))]/90 px-8 py-6 text-base rounded-xl font-semibold shadow-xl"
              onClick={() => navigate("/auth")}
            >
              Create Free Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto px-8 py-6 text-base rounded-xl border-2 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary font-semibold"
            >
              <Shield className="mr-2 h-5 w-5" />
              Why we're secure
            </Button>
          </div>
          <p className="mt-7 text-sm text-primary-foreground/80 flex items-center justify-center gap-2">
            <CheckCircle className="h-4 w-4 text-[hsl(var(--gold))]" />
            No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      {/* ───────────────── FOOTER ───────────────── */}
      <footer className="border-t border-border/60 bg-background pt-14 pb-8">
        <div className="container mx-auto px-3 sm:px-4 max-w-6xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
            <div className="sm:col-span-2 md:col-span-1 flex flex-col items-center md:items-start gap-3">
              <img src={logo} alt="SkyFX Trade" className="h-14 w-14 object-contain" />
              <p className="text-sm text-muted-foreground text-center md:text-left max-w-xs leading-relaxed">
                Your trusted desk for crypto, forex & commodities. Built for professionals,
                accessible to everyone.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                  <Shield className="h-3 w-3 mr-1" /> SSL Secured
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] border-[hsl(var(--gold))]/50 text-[hsl(var(--gold-foreground))]"
                >
                  <Award className="h-3 w-3 mr-1" /> ISO Certified
                </Badge>
              </div>
            </div>

            <div className="flex flex-col items-center md:items-start gap-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-[0.18em]">
                Contact
              </h4>
              <div className="text-sm text-muted-foreground text-center md:text-left space-y-2">
                <p className="flex items-start gap-2 justify-center md:justify-start">
                  <Globe className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>
                    No. 42, 100 Feet Road
                    <br />
                    Indiranagar, Bengaluru, KA 560038
                    <br />
                    India
                  </span>
                </p>
                <p>
                  <a
                    href="tel:+918025550199"
                    className="hover:text-primary transition-colors inline-flex items-center gap-2"
                  >
                    <Bell className="h-3.5 w-3.5 text-primary" />
                    +91 80 2555 0199
                  </a>
                </p>
                <p>
                  <a
                    href="mailto:support@growfxtrade.com"
                    className="hover:text-primary transition-colors inline-flex items-center gap-2"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-primary" />
                    support@growfxtrade.com
                  </a>
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center md:items-start gap-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-[0.18em]">
                Markets
              </h4>
              <div className="flex flex-col items-center md:items-start gap-2 text-sm text-muted-foreground">
                <a href="#" className="hover:text-primary transition-colors">Cryptocurrency</a>
                <a href="#" className="hover:text-primary transition-colors">Forex Trading</a>
                <a href="#" className="hover:text-primary transition-colors">Commodities</a>
                <a href="#" className="hover:text-primary transition-colors">Indices</a>
              </div>
            </div>

            <div className="flex flex-col items-center md:items-start gap-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-[0.18em]">
                Company
              </h4>
              <div className="flex flex-col items-center md:items-start gap-2 text-sm text-muted-foreground">
                <a href="#" className="hover:text-primary transition-colors">About Us</a>
                <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-primary transition-colors">Support Center</a>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <p className="text-xs text-muted-foreground">
              © 2007 <span className="font-semibold text-foreground">SkyFX Trade</span>. All
              rights reserved.
            </p>
            <p className="text-[11px] text-muted-foreground/80 max-w-md">
              Trading involves substantial risk and may result in loss of capital. Trade
              responsibly.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
