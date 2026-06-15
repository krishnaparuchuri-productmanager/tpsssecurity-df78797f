import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import tpssLogo from "@/assets/tpss-logo-portal.jpg";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
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
          <CardTitle className="text-2xl text-app-navy">Reset Password</CardTitle>
          <CardDescription>Trinetra Professional Security Services</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                A password reset link has been sent to <strong>{email}</strong>. Check your inbox and click the link to set a new password.
              </p>
              <p className="text-xs text-muted-foreground">
                Didn't receive it? Check your spam folder or try again.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
                Try again
              </Button>
              <Link to="/login" className="block text-sm text-app-navy hover:underline">
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  placeholder="you@tpsssecurity.com"
                />
              </div>
              <Button type="submit" className="w-full bg-app-navy hover:bg-app-navy/90 text-white" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
              <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-app-navy">
                <ArrowLeft className="h-3 w-3" /> Back to login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}