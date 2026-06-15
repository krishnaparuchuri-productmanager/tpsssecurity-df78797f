import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import tpssLogo from "@/assets/tpss-logo-portal.jpg";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase embeds the recovery token in the URL hash.
    // Listening for PASSWORD_RECOVERY confirms the session is valid.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated successfully");
    navigate("/app/dashboard", { replace: true });
  }

  if (!ready) {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center bg-app-bg p-4">
        <Card className="w-full max-w-md border-app-border shadow-lg">
          <CardContent className="pt-6 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-app-navy" />
            <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen flex items-center justify-center bg-app-bg p-4">
      <Card className="w-full max-w-md border-app-border shadow-lg">
        <CardHeader className="text-center space-y-2">
          <img
            src={tpssLogo}
            alt="TPSS"
            className="mx-auto h-20 w-20 rounded-full object-contain bg-white"
          />
          <CardTitle className="text-2xl text-app-navy">Set New Password</CardTitle>
          <CardDescription>Trinetra Professional Security Services</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                placeholder="Minimum 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm New Password</Label>
              <Input
                id="confirm"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={submitting}
                placeholder="Re-enter new password"
              />
            </div>
            <Button type="submit" className="w-full bg-app-navy hover:bg-app-navy/90 text-white" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}