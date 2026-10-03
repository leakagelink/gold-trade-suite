import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldX, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const BROKER_EMAIL = "hello@skyfx.com";

export const AdminPasswordGate = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
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

      // Only the broker account (admin role) may open this panel
      setUnlocked(Boolean(isAdmin) && user.email === BROKER_EMAIL);
      setCheckingAccess(false);
    })();
  }, [authLoading, user?.id, user?.email]);

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
            {user ? (
              <ShieldX className="h-8 w-8 text-destructive" />
            ) : (
              <Lock className="h-8 w-8 text-primary" />
            )}
          </div>
          <h2 className="text-2xl font-bold mb-2">Broker Panel Access</h2>
          <p className="text-muted-foreground text-sm">
            {user
              ? "This account does not have broker access. Please sign in with the broker account."
              : "Please sign in with the broker account to continue."}
          </p>
        </div>
        <div className="space-y-3">
          {user ? (
            <>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  await signOut();
                }}
              >
                Sign out & switch account
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate("/dashboard")}>
                Back to Dashboard
              </Button>
            </>
          ) : (
            <Button className="w-full" onClick={() => navigate("/auth")}>
              <Lock className="h-4 w-4 mr-2" />
              Go to Sign In
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};
