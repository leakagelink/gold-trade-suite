import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ADMIN_PASSWORD = "Gonnagannareadyroshanpura@123";
const STORAGE_KEY = "admin_panel_unlocked";

export const AdminPasswordGate = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "true") {
      setUnlocked(true);
      setCheckingAccess(false);
      return;
    }

    if (authLoading) return;

    if (!user?.id) {
      sessionStorage.removeItem(STORAGE_KEY);
      setUnlocked(false);
      setCheckingAccess(false);
      return;
    }

    setCheckingAccess(true);

    (async () => {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (isAdmin) {
        sessionStorage.setItem(STORAGE_KEY, "true");
        setUnlocked(true);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
        setUnlocked(false);
      }
      setCheckingAccess(false);
    })();
  }, [authLoading, user?.id]);

  const handleUnlock = () => {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setUnlocked(true);
      setPassword("");
      toast.success("Admin panel unlocked");
    } else {
      toast.error("Incorrect password");
      setPassword("");
    }
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Admin Panel Access</h2>
          <p className="text-muted-foreground text-sm">
            Enter the password to access the admin panel
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="admin-password">Password</Label>
            <div className="relative mt-2">
              <Input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                placeholder="Enter password"
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button onClick={handleUnlock} className="w-full">
            <Lock className="h-4 w-4 mr-2" />
            Unlock
          </Button>
        </div>
      </Card>
    </div>
  );
};
