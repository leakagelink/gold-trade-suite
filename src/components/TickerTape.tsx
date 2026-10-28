import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const SYMBOLS = ["BTC", "ETH", "BNB", "SOL", "XRP", "DOGE", "ADA", "LTC", "TRX", "AVAX"];

type Tick = { p: number; c: number };

/** Live scrolling crypto ticker tape (Binance public mini-ticker stream). */
const TickerTape = () => {
  const navigate = useNavigate();
  const [ticks, setTicks] = useState<Record<string, Tick>>({});

  useEffect(() => {
    const streams = SYMBOLS.map((s) => `${s.toLowerCase()}usdt@miniTicker`).join("/");
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data).data;
          const sym = String(d.s).replace("USDT", "");
          const p = parseFloat(d.c);
          const o = parseFloat(d.o);
          setTicks((prev) => ({ ...prev, [sym]: { p, c: o ? ((p - o) / o) * 100 : 0 } }));
        } catch { /* ignore */ }
      };
      ws.onclose = () => { if (!closed) retry = setTimeout(connect, 4000); };
    };
    connect();
    return () => { closed = true; clearTimeout(retry); ws?.close(); };
  }, []);

  const items = SYMBOLS.filter((s) => ticks[s]);
  if (items.length === 0) return <div className="h-8 border-b border-primary/30 bg-primary" />;

  const fmt = (n: number) => n >= 100 ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : n.toFixed(n >= 1 ? 3 : 5);

  const row = items.map((s) => {
    const t = ticks[s];
    const up = t.c >= 0;
    return (
      <button
        key={s}
        onClick={() => navigate(`/trading?symbol=${s}`)}
        className="flex shrink-0 items-center gap-2 px-4 text-[11px] font-semibold tabular-nums hover:bg-primary-foreground/5"
      >
        <span className="text-primary-foreground/90">{s}/USD</span>
        <span className="font-mono text-primary-foreground">{fmt(t.p)}</span>
        <span className={up ? "text-success" : "text-destructive"}>
          {up ? "▲" : "▼"} {Math.abs(t.c).toFixed(2)}%
        </span>
      </button>
    );
  });

  return (
    <div className="group relative h-8 overflow-hidden border-b border-primary/30 bg-primary">
      <div className="flex h-full w-max animate-marquee items-center group-hover:[animation-play-state:paused]">
        {row}
        {row.map((el) => ({ ...el, key: `${el.key}-dup` }))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-primary to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-primary to-transparent" />
    </div>
  );
};

export default TickerTape;
