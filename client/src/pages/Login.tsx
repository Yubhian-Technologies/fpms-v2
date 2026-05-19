import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Footer } from "@/components/layout/Footer";
import vishnuLogo from "@/assets/vishnu.png";
import fpmsLogo from "@/assets/LOGO.png";
import { formatRoleLabel } from "@/lib/utils";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, isAuthenticated, sendPasswordReset } = useAuth();
  const sessionToastShown = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (sessionToastShown.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "session_expired") {
      sessionToastShown.current = true;
      toast({
        title: "Session timed out",
        description: "Please log in again to continue.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/login");
    }
  }, [toast]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setIsResetting(true);
    try {
      await sendPasswordReset(resetEmail);
      toast({
        title: "Reset email sent",
        description: "Check your inbox for the password reset link.",
      });
      setShowForgot(false);
      setResetEmail("");
    } catch (err: any) {
      toast({
        title: "Failed to send reset email",
        description: err?.code === "auth/user-not-found"
          ? "No account found with that email."
          : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const user = await login(email, password);

      if (user) {
        toast({
          title: "Login successful",
          description: `Welcome ${formatRoleLabel(user.role)}!`,
        });

        navigate("/dashboard", { replace: true });
      } else {
        toast({
          title: "Login failed",
          description: "Invalid email or password",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Login failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg p-1 border">
                <img
                  src={vishnuLogo}
                  alt="Vishnu Logo"
                  className="h-full w-full rounded-xl object-contain"
                />
              </div>
              <div className="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg p-1 border">
                <img
                  src={fpmsLogo}
                  alt="FPMS Logo"
                  className="h-full w-full rounded-xl object-contain"
                />
              </div>
            </div>
            {/* <h1 className="mt-4 font-display text-3xl font-bold text-foreground">
              FPMS
            </h1>
            <p className="mt-1 text-muted-foreground">
              Faculty Performance Management System
            </p> */}

            <Card className="border-border/50 shadow-xl">
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-display">Sign in</CardTitle>
                {/* <CardDescription>
                  Enter your credentials to access the system
                </CardDescription> */}
              </CardHeader>
              <CardContent>
                {showForgot ? (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="your.email@university.edu"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isResetting}>
                      {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send Reset Link
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setShowForgot(false); setResetEmail(""); }}
                      className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Back to Sign in
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.email@university.edu"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <button
                          type="button"
                          onClick={() => { setShowForgot(true); setResetEmail(email); }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Sign in
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
