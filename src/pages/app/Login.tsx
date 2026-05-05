import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import tpssLogo from "@/assets/tpss-logo-portal.jpg";

export default function Login() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/app/dashboard", { replace: true });
  }, [user, loading, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) {
      toast.error("Invalid credentials");
      return;
    }
    toast.success("Signed in");
    navigate("/app/dashboard", { replace: true });
  }

  return (
    <div className="app-shell min-h-screen flex items-center justify-center bg-app-bg p-4">
      <Card className="w-full max-w-md border-app-border shadow-lg">
        <CardHeader className="text-center space-y-2">
          <img
            src={tpssLogo}
            alt="TPSS – Trinetra Professional Security Services"
            className="mx-auto h-20 w-20 rounded-full object-contain bg-white"
          />
          <CardTitle className="text-2xl text-app-navy">Trinetra Internal Portal</CardTitle>
          <CardDescription>Trinetra Professional Security Services</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>
            <Button type="submit" className="w-full bg-app-navy hover:bg-app-navy/90 text-white" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Internal portal only. No public registration. Contact your administrator for access.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
