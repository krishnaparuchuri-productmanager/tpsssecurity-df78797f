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

type Stage = "checking" | "confirm" | "ready" | "invalid";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<Stage>("checking");
  const [invalidReason, setInvalidReason] = useState("");
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    // Supabase reports a used / expired link as #error=...&error_code=otp_expired
    const err = hash.get("error_code") || hash.get("error") || query.get("error_code");
    if (err) {
      setInvalidReason((hash.get("error_description") || query.get("error_description") || "This reset link is invalid or has expired.").replace(/\+/g, " "));
      setStage("invalid");
      return;
    }

    // New email links carry ?token_hash=…&type=recovery. The one-time token is only
    // used when the person clicks Continue, so email link scanners (e.g. Zoho Mail's)
    // opening the link don't use it up.
    const th = query.get("token_hash");
    if (th && query.get("type") === "recovery") {
      setTokenHash(th);
      setStage("confirm");
      return;
    }

    // Older links put the session in the URL hash and fire PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStage("ready");
    });
    // The event can fire before this page subscribes; a recovery session may already exist.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && hash.get("type") === "recovery") setStage("ready");
    });
    const timer = window.setTimeout(() => {
      setStage((s) => {
        if (s !== "checking") return s;
        setInvalidReason("This reset link is invalid or has expired.");
        return "invalid";
      });
    }, 6000);
    return () => { subscription.unsubscribe(); window.clearTimeout(timer); };
  }, []);

  async function continueReset() {
    if (!tokenHash) return;
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    setVerifying(false);
    if (error) {
      setInvalidReason(error.message);
      setStage("invalid");
      return;
    }
    // Drop the used token from the address bar.
    window.history.replaceState(null, "", "/reset-password");
    setStage("ready");
  }

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

  if (stage === "checking") {
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

  if (stage === "confirm" || stage === "invalid") {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center bg-app-bg p-4">
        <Card className="w-full max-w-md border-app-border shadow-lg">
          <CardHeader className="text-center space-y-2">
            <img src={tpssLogo} alt="TPSS" className="mx-auto h-20 w-20 rounded-full object-contain bg-white" />
            <CardTitle className="text-2xl text-app-navy">{stage === "confirm" ? "Reset your password" : "Reset link not valid"}</CardTitle>
            <CardDescription>
              {stage === "confirm"
                ? "Click Continue to set a new password for your account."
                : `${invalidReason.replace(/[.!]?\s*$/, ".")} Reset links work once and expire after a short time. Request a new one below.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {stage === "confirm" ? (
              <Button className="w-full bg-app-navy hover:bg-app-navy/90 text-white" onClick={continueReset} disabled={verifying}>
                {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue to set new password
              </Button>
            ) : (
              <Button className="w-full bg-app-navy hover:bg-app-navy/90 text-white" onClick={() => navigate("/forgot-password")}>
                Send a new link
              </Button>
            )}
            <Button variant="ghost" className="w-full" onClick={() => navigate("/login")}>Back to sign in</Button>
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