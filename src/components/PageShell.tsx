import { ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import BottomNav from "@/components/BottomNav";
import TickerTape from "@/components/TickerTape";

interface PageShellProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  headerAction?: ReactNode;
  children: ReactNode;
  maxWidth?: "2xl" | "4xl" | "6xl" | "7xl" | "wide" | "full";
}

const maxWidthMap = {
  "2xl": "max-w-2xl lg:max-w-4xl",
  "4xl": "max-w-4xl lg:max-w-5xl",
  "6xl": "max-w-6xl lg:max-w-[1500px]",
  "7xl": "max-w-7xl lg:max-w-[1600px]",
  "wide": "max-w-7xl lg:max-w-[1700px] xl:max-w-[1800px]",
  "full": "max-w-full",
};

const PageShell = ({
  title,
  subtitle,
  icon: Icon,
  headerAction,
  children,
  maxWidth = "4xl",
}: PageShellProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-muted/40 to-background">
      <div className="pointer-events-none fixed inset-0 bg-hero" />
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-[0.35] [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />
          {headerAction && (
            <div className="flex items-center gap-2">{headerAction}</div>
          )}
        </div>
      </header>


      {/* Main Content */}
      <main className={`relative z-10 container mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-6 sm:py-8 ${maxWidthMap[maxWidth]} pb-24`}>
        {/* Terminal-style title */}
        <div className="mb-6 sm:mb-8 animate-fade-in flex items-center gap-3 sm:gap-4">
          {Icon && (
            <span className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-primary-foreground shadow-[var(--shadow-glow)]">
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
          )}
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
              <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" /></span>
              SkyFX Terminal
            </div>
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground truncate">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        <div className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default PageShell;

/* Reusable glass-card wrapper class string for consistency */
export const glassCardClass =
  "relative rounded-2xl bg-card/60 backdrop-blur-xl border border-border/60 shadow-xl overflow-hidden";
