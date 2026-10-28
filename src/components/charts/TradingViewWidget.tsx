import { useEffect, useRef, memo } from "react";

interface Props {
  tvSymbol: string;
  interval?: string;
  height?: number;
}

/** Embeds the official TradingView Advanced Chart widget. */
function TradingViewWidget({ tvSymbol, interval = "60", height = 520 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '<div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>';
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: false,
      width: "100%",
      height,
      symbol: tvSymbol,
      interval,
      timezone: "Asia/Kolkata",
      theme: "light",
      style: "1",
      locale: "en",
      allow_symbol_change: false,
      hide_side_toolbar: false,
      withdateranges: true,
      support_host: "https://www.tradingview.com",
    });
    el.appendChild(script);
    return () => { el.innerHTML = ""; };
  }, [tvSymbol, interval, height]);

  return <div ref={ref} className="tradingview-widget-container w-full" style={{ height }} />;
}

export default memo(TradingViewWidget);
