import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Shield, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import { useNavigate } from "react-router-dom";

type Tab = "register" | "change";

export default function AddSuperAdmin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("register");
  const [isSaving, setIsSaving] = useState(false);

  // ── Register form ──
  const [reg, setReg] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // ── Change form ──
  const [chg, setChg] = useState({
    currentEmail: "",
    currentPassword: "",
    newEmail: "",
    newPassword: "",
    newName: "",
  });
  const [showCurPass, setShowCurPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // ── Register submit ──
  const handleRegister = async () => {
    if (!reg.name.trim())      return toast({ title: "Name is required", variant: "destructive" });
    if (!reg.email.trim())     return toast({ title: "Email is required", variant: "destructive" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reg.email))
      return toast({ title: "Invalid email address", variant: "destructive" });
    if (reg.password.length < 6)
      return toast({ title: "Password must be at least 6 characters", variant: "destructive" });
    if (reg.password !== reg.confirmPassword)
      return toast({ title: "Passwords do not match", variant: "destructive" });

    setIsSaving(true);
    try {
      const res = await api.post("/api/superadmin/register", {
        name: reg.name.trim(),
        email: reg.email.trim().toLowerCase(),
        password: reg.password,
      });
      if (res.data.success) {
        toast({ title: "Super Admin registered successfully! Redirecting to login..." });
        setReg({ name: "", email: "", password: "", confirmPassword: "" });
        setTimeout(() => navigate("/login"), 2000);
      } else {
        toast({ title: "Registration Failed", description: res.data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || err.message || "Failed to register",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Change submit ──
  const handleChange = async () => {
    if (!chg.currentEmail.trim() || !chg.currentPassword)
      return toast({ title: "Current email and password are required", variant: "destructive" });
    if (!chg.newEmail && !chg.newPassword && !chg.newName)
      return toast({ title: "Provide at least one new value to update", variant: "destructive" });
    if (chg.newPassword && chg.newPassword.length < 6)
      return toast({ title: "New password must be at least 6 characters", variant: "destructive" });

    setIsSaving(true);
    try {
      const res = await api.put("/api/superadmin/credentials", {
        currentEmail: chg.currentEmail.trim().toLowerCase(),
        currentPassword: chg.currentPassword,
        ...(chg.newEmail    && { newEmail: chg.newEmail.trim().toLowerCase() }),
        ...(chg.newPassword && { newPassword: chg.newPassword }),
        ...(chg.newName     && { newName: chg.newName.trim() }),
      });
      if (res.data.success) {
        toast({ title: "Superadmin updated successfully! Please log in again." });
        setChg({ currentEmail: "", currentPassword: "", newEmail: "", newPassword: "", newName: "" });
        setTimeout(() => navigate("/login"), 2000);
      } else {
        toast({ title: "Update Failed", description: res.data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || err.message || "Failed to update",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>

        <Card className="shadow-2xl border-2">
          <CardHeader className="space-y-4 pb-4">
            <div className="flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg">
                <Shield className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Super Admin Setup
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Register a new superadmin or update existing credentials
              </p>
            </div>

            {/* Tabs */}
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setTab("register")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  tab === "register"
                    ? "bg-purple-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Register New
              </button>
              <button
                onClick={() => setTab("change")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  tab === "change"
                    ? "bg-purple-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Change Existing
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* ── REGISTER TAB ── */}
            {tab === "register" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="Enter full name"
                    value={reg.name}
                    onChange={(e) => setReg((p) => ({ ...p, name: e.target.value }))}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Address *</Label>
                  <Input
                    type="email"
                    placeholder="admin@example.com"
                    value={reg.email}
                    onChange={(e) => setReg((p) => ({ ...p, email: e.target.value }))}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <div className="relative">
                    <Input
                      type={showRegPass ? "text" : "password"}
                      placeholder="Minimum 6 characters"
                      value={reg.password}
                      onChange={(e) => setReg((p) => ({ ...p, password: e.target.value }))}
                      disabled={isSaving}
                    />
                    <Button type="button" variant="ghost" size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowRegPass(!showRegPass)}>
                      {showRegPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password *</Label>
                  <div className="relative">
                    <Input
                      type={showRegConfirm ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={reg.confirmPassword}
                      onChange={(e) => setReg((p) => ({ ...p, confirmPassword: e.target.value }))}
                      disabled={isSaving}
                    />
                    <Button type="button" variant="ghost" size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowRegConfirm(!showRegConfirm)}>
                      {showRegConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button onClick={handleRegister} disabled={isSaving}
                  className="w-full h-12 text-base bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                  {isSaving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Registering...</> : <><Shield className="mr-2 h-5 w-5" />Register Super Admin</>}
                </Button>
              </div>
            )}

            {/* ── CHANGE TAB ── */}
            {tab === "change" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground border-l-2 border-purple-400 pl-3">
                  Enter your current credentials to verify, then fill in only the fields you want to change.
                </p>

                <div className="space-y-3 pb-3 border-b">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Credentials</p>
                  <div className="space-y-2">
                    <Label>Current Email *</Label>
                    <Input
                      type="email"
                      placeholder="current@example.com"
                      value={chg.currentEmail}
                      onChange={(e) => setChg((p) => ({ ...p, currentEmail: e.target.value }))}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Password *</Label>
                    <div className="relative">
                      <Input
                        type={showCurPass ? "text" : "password"}
                        placeholder="Enter current password"
                        value={chg.currentPassword}
                        onChange={(e) => setChg((p) => ({ ...p, currentPassword: e.target.value }))}
                        disabled={isSaving}
                      />
                      <Button type="button" variant="ghost" size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowCurPass(!showCurPass)}>
                        {showCurPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">New Values (leave blank to keep unchanged)</p>
                  <div className="space-y-2">
                    <Label>New Name</Label>
                    <Input
                      placeholder="Leave blank to keep current name"
                      value={chg.newName}
                      onChange={(e) => setChg((p) => ({ ...p, newName: e.target.value }))}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>New Email</Label>
                    <Input
                      type="email"
                      placeholder="Leave blank to keep current email"
                      value={chg.newEmail}
                      onChange={(e) => setChg((p) => ({ ...p, newEmail: e.target.value }))}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <div className="relative">
                      <Input
                        type={showNewPass ? "text" : "password"}
                        placeholder="Leave blank to keep current password"
                        value={chg.newPassword}
                        onChange={(e) => setChg((p) => ({ ...p, newPassword: e.target.value }))}
                        disabled={isSaving}
                      />
                      <Button type="button" variant="ghost" size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowNewPass(!showNewPass)}>
                        {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <Button onClick={handleChange} disabled={isSaving}
                  className="w-full h-12 text-base bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                  {isSaving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Updating...</> : <><Shield className="mr-2 h-5 w-5" />Update Superadmin</>}
                </Button>
              </div>
            )}

            <div className="pt-2 border-t">
              <p className="text-xs text-center text-muted-foreground">
                This account has full system administrative privileges. Keep credentials secure.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
