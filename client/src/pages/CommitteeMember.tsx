import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, UserCheck, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";

interface CommitteeMemberData {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  level: number;
}

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

export default function CommitteeMember() {
  const [member, setMember] = useState<CommitteeMemberData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  const fetchMember = async () => {
    try {
      const res = await api.get("/api/superadmin/committee-member");
      setMember(res.data?.data ?? null);
    } catch {
      toast({ title: "Failed to load committee member", variant: "destructive" });
    }
  };

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await fetchMember();
      setIsLoading(false);
    })();
  }, []);

  const startEdit = () => {
    setFormData({
      name: member?.name ?? "",
      email: member?.email ?? "",
      phone: member?.phone ?? "",
      password: "",
      confirmPassword: "",
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    const { name, email, phone, password, confirmPassword } = formData;

    if (!name.trim() || !email.trim() || !phone.trim()) {
      toast({ title: "Name, email and phone are required", variant: "destructive" });
      return;
    }

    if (!member && !password) {
      toast({ title: "Password is required for new member", variant: "destructive" });
      return;
    }

    if (password) {
      if (password.length < 6) {
        toast({ title: "Password must be at least 6 characters", variant: "destructive" });
        return;
      }
      if (password !== confirmPassword) {
        toast({ title: "Passwords do not match", variant: "destructive" });
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: Record<string, string> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
      };
      if (password) payload.password = password;

      if (member) {
        await api.put("/api/superadmin/committee-member", payload);
        toast({ title: "Committee member updated successfully" });
      } else {
        await api.post("/api/superadmin/committee-member/register", payload);
        toast({ title: "Committee member registered successfully" });
      }

      await fetchMember();
      setIsEditing(false);
      setFormData(emptyForm);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Server error",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete("/api/superadmin/committee-member");
      toast({ title: "Committee member deleted" });
      setMember(null);
      setShowDeleteDialog(false);
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout title="Committee Member" subtitle="Manage the committee member account">
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Committee Member</h1>
            <p className="text-muted-foreground">Register or update the committee account</p>
          </div>
          {member && !isEditing && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={startEdit}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </Button>
            </div>
          )}
          {!member && !isEditing && (
            <Button onClick={() => setIsEditing(true)}>
              <UserCheck className="mr-2 h-4 w-4" /> Register Member
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !isEditing && member ? (
          <Card>
            <CardHeader>
              <CardTitle>Current Committee Member</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Name", value: member.name },
                { label: "Email", value: member.email },
                { label: "Phone", value: member.phone },
                { label: "Role", value: member.role },
                { label: "Level", value: String(member.level) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-4">
                  <span className="w-24 text-sm font-medium text-muted-foreground">{label}</span>
                  <span className="text-sm">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : !isEditing && !member ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No committee member registered yet.</p>
              <Button className="mt-4" onClick={() => setIsEditing(true)}>
                Register Committee Member
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {isEditing && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle>{member ? "Edit Committee Member" : "Register Committee Member"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Address *</Label>
                  <Input
                    type="email"
                    placeholder="committee@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!!member}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number *</Label>
                  <Input
                    placeholder="+91 XXXXXXXXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{member ? "New Password" : "Password *"}</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={member ? "Leave blank to keep current" : "Min 6 characters"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowPassword((p) => !p)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password {!member && "*"}</Label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowConfirm((p) => !p)}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-xs text-red-600">Passwords don't match</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSaving ? "Saving..." : member ? "Update Member" : "Register Member"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={(open) => { if (!isDeleting) setShowDeleteDialog(open); }}
        title="Remove committee member?"
        description="This will permanently delete the committee member account from Firebase Auth."
        confirmText="Remove"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </DashboardLayout>
  );
}
