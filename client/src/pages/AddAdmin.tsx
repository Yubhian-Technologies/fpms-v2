import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";

interface Principal {
  id: string;
  name: string;
  email: string;
  phone?: string;
  college: string;
  role?: string;
  level?: number;
  experience?: number;
  dateOfJoining?: string;
  hasPhD?: boolean;
}

interface CollegeOption {
  id: string;
  name: string;
  code?: string;
}

interface RoleOption {
  id: string;
  name: string;
  level: number;
}

export default function AddPrincipal() {
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [collegeOptions, setCollegeOptions] = useState<CollegeOption[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingPrincipal, setIsAddingPrincipal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [principalToDelete, setPrincipalToDelete] = useState<Principal | null>(
    null,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  const calculateExperience = (dateStr: string): number => {
    if (!dateStr) return 0;
    const joining = new Date(dateStr);
    const today = new Date();
    const diffMs = today.getTime() - joining.getTime();
    return Math.max(0, Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000)));
  };

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    college: "",
    role: "",
    level: 0,
    dateOfJoining: "",
    experience: "",
    hasPhD: false,
  });

  const normalizeRole = (value: string) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const isPrincipalRole = (value: string) => {
    const normalized = normalizeRole(value);
    return (
      normalized === "principal" ||
      normalized === "principle" ||
      normalized === "admin"
    );
  };

  const isVicePrincipalRole = (value: string) => {
    const normalized = normalizeRole(value);
    return (
      normalized === "vice principal" ||
      normalized === "vice principle" ||
      normalized === "vice-principal" ||
      normalized === "viceprincipal"
    );
  };

  const formatRoleForUi = (value: string) => {
    const normalized = normalizeRole(value);
    if (normalized === "principle") return "principal";
    if (
      normalized === "vice principle" ||
      normalized === "vice-principal" ||
      normalized === "viceprincipal"
    ) {
      return "vice principal";
    }
    return String(value || "");
  };

  const principalRoleOption =
    roleOptions.find((item) => isPrincipalRole(item.name)) ?? null;
  const lockedRoleName = principalRoleOption?.name || "principle";
  const lockedRoleDisplayName = formatRoleForUi(lockedRoleName);
  const lockedRoleLevel = Number(principalRoleOption?.level ?? 1);

  const occupiedCollegeNames = new Set(
    principals
      .map((principal) =>
        String(principal.college || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );

  const availableCollegeOptions = collegeOptions.filter((college) => {
    const normalizedCollegeName = String(college.name || "")
      .trim()
      .toLowerCase();

    if (!normalizedCollegeName) return false;

    if (editingId) {
      const editingCollegeName = String(formData.college || "")
        .trim()
        .toLowerCase();
      return (
        !occupiedCollegeNames.has(normalizedCollegeName) ||
        normalizedCollegeName === editingCollegeName
      );
    }

    return !occupiedCollegeNames.has(normalizedCollegeName);
  });

  const roleNames = Array.from(new Set(roleOptions.map((item) => item.name)));
  const availableLevels = Array.from(
    new Set(
      (formData.role
        ? roleOptions.filter((item) => item.name === formData.role)
        : roleOptions
      ).map((item) => Number(item.level)),
    ),
  ).sort((a, b) => a - b);

  const fetchPrincipals = async () => {
    try {
      const res = await api.get("/api/committee/admins");
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      const normalized = data
        .map((item: any) => ({
          ...item,
          hasPhD: item.hasPhD ?? item.hasPhd ?? false,
        }))
        .filter(
          (item: any) =>
            isPrincipalRole(item.role || "") &&
            !isVicePrincipalRole(item.role || ""),
        );
      setPrincipals(normalized);
    } catch {
      toast({ title: "Failed to load principals", variant: "destructive" });
    }
  };

  const fetchColleges = async () => {
    try {
      const res = await api.get("/api/committee/colleges");
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setCollegeOptions(data);
    } catch {
      toast({ title: "Failed to load colleges", variant: "destructive" });
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get("/api/committee/roles");
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setRoleOptions(data);
    } catch {
      toast({ title: "Failed to load roles", variant: "destructive" });
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        await Promise.all([fetchPrincipals(), fetchColleges(), fetchRoles()]);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      college: "",
      role: lockedRoleName,
      level: lockedRoleLevel,
      dateOfJoining: "",
      experience: "",
      hasPhD: false,
    });
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setEditingId(null);
  };

  const startNewPrincipal = () => {
    resetForm();
    setIsAddingPrincipal(true);
  };

  const cancelForm = () => {
    setIsAddingPrincipal(false);
    resetForm();
  };

  const openEdit = (principal: Principal) => {
    const joiningDate = principal.dateOfJoining || "";
    setFormData({
      name: principal.name,
      email: principal.email,
      phone: principal.phone || "",
      password: "",
      college: principal.college,
      role: lockedRoleName,
      level: lockedRoleLevel,
      dateOfJoining: joiningDate,
      experience: joiningDate
        ? String(calculateExperience(joiningDate))
        : principal.experience !== undefined
          ? String(principal.experience)
          : "",
      hasPhD: !!principal.hasPhD,
    });
    setConfirmPassword("");
    setEditingId(principal.id);
    setIsAddingPrincipal(true);
  };

  const handleSave = async () => {
    if (
      !formData.name ||
      !formData.email ||
      !formData.phone ||
      !formData.college ||
      !formData.role ||
      !Number.isFinite(formData.level) ||
      !formData.dateOfJoining
    ) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }

    if (Number(formData.experience) < 0) {
      toast({ title: "Experience cannot be negative", variant: "destructive" });
      return;
    }

    if (!editingId && !formData.password) {
      toast({ title: "Password is required", variant: "destructive" });
      return;
    }

    if (!editingId) {
      const selectedCollege = String(formData.college || "")
        .trim()
        .toLowerCase();
      if (selectedCollege && occupiedCollegeNames.has(selectedCollege)) {
        toast({
          title: "Principal already exists",
          description: "Selected college already has a principal.",
          variant: "destructive",
        });
        return;
      }
    }

    if (formData.password) {
      if (formData.password.length < 6) {
        toast({
          title: "Password must be at least 6 characters",
          variant: "destructive",
        });
        return;
      }

      if (formData.password !== confirmPassword) {
        toast({
          title: "Password mismatch",
          description: "Password doesn't match",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSaving(true);

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        college: formData.college,
        role: lockedRoleName,
        level: lockedRoleLevel,
        password: formData.password || undefined,
        dateOfJoining: formData.dateOfJoining || undefined,
        experience: Number(formData.experience),
        hasPhd: formData.hasPhD,
      };

      if (editingId) {
        await api.put(`/api/committee/update/${editingId}`, payload);
        toast({ title: "Principal updated successfully" });
      } else {
        await api.post("/api/committee/admin-add", payload);
        toast({ title: "Principal added successfully" });
      }

      await fetchPrincipals();
      cancelForm();
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

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      await api.delete(`/api/committee/delete/${id}`);
      toast({ title: "Principal deleted" });
      await fetchPrincipals();
      setPrincipalToDelete(null);
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredPrincipals = principals.filter(
    (principal) =>
      principal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      principal.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      principal.college.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <DashboardLayout
      title="Add Principal"
      subtitle="Manage principals by college"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Principal Management</h1>
            <p className="text-muted-foreground">Add and manage principals</p>
          </div>
          {!isAddingPrincipal && (
            <Button onClick={startNewPrincipal}>
              <Plus className="mr-2 h-4 w-4" /> Add Principal
            </Button>
          )}
        </div>

        {isAddingPrincipal && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle>
                {editingId ? "Edit Principal" : "Add Principal"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="Enter principal name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Address *</Label>
                  <Input
                    type="email"
                    placeholder="principal@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number *</Label>
                  <Input
                    placeholder="+91 XXXXXXXXXX"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>College *</Label>
                  <Select
                    value={formData.college}
                    onValueChange={(value) =>
                      setFormData({ ...formData, college: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          availableCollegeOptions.length
                            ? "Select college"
                            : "No colleges available"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCollegeOptions.map((college) => (
                        <SelectItem key={college.id} value={college.name}>
                          {college.name}
                          {college.code ? ` (${college.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Input value={lockedRoleDisplayName} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Level *</Label>
                  <Input value={String(lockedRoleLevel)} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Date of Joining *</Label>
                  <Input
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    value={formData.dateOfJoining}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dateOfJoining: e.target.value,
                        experience: e.target.value
                          ? String(calculateExperience(e.target.value))
                          : "",
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Experience (Years)</Label>
                  <Input
                    type="number"
                    value={formData.experience}
                    disabled
                    className="bg-muted"
                    placeholder="Auto-calculated from Date of Joining"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Has PhD</Label>
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <input
                      type="checkbox"
                      checked={formData.hasPhD}
                      onChange={(e) =>
                        setFormData({ ...formData, hasPhD: e.target.checked })
                      }
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Principal has completed PhD</span>
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>
                    {editingId ? "New Password" : "Password"}{" "}
                    {!editingId && "*"}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={
                        editingId ? "Enter new password" : "Enter password"
                      }
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password {!editingId && "*"}</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {confirmPassword && formData.password !== confirmPassword && (
                    <p className="text-xs text-red-600">
                      Password doesn't match
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={cancelForm}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {isSaving ? "Saving..." : "Save Principal"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6 flex gap-4">
              <Users className="h-5 w-5" />
              <div>
                <p>Total Principals</p>
                <p className="text-2xl font-bold">{principals.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex gap-4">
              <Users className="h-5 w-5" />
              <div>
                <p>Visible Results</p>
                <p className="text-2xl font-bold">
                  {filteredPrincipals.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Input
          placeholder="Search by name, email or college..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <Card>
          <CardHeader>
            <CardTitle>Principals</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>College</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>PhD</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrincipals.map((principal) => (
                    <TableRow key={principal.id}>
                      <TableCell>{principal.name}</TableCell>
                      <TableCell>{principal.email}</TableCell>
                      <TableCell>{principal.phone || "-"}</TableCell>
                      <TableCell>{principal.college}</TableCell>
                      <TableCell>
                        {principal.role ? formatRoleForUi(principal.role) : "-"}
                      </TableCell>
                      <TableCell>{principal.level ?? "-"}</TableCell>
                      <TableCell>{principal.experience ?? "-"}</TableCell>
                      <TableCell>{principal.hasPhD ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(principal)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setPrincipalToDelete(principal)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredPrincipals.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-muted-foreground py-8"
                      >
                        No principal data available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <DeleteConfirmationDialog
          open={!!principalToDelete}
          onOpenChange={(open) => {
            if (!open && !isDeleting) setPrincipalToDelete(null);
          }}
          title="Delete principal?"
          description={`This will permanently delete ${principalToDelete?.name || "this principal"}.`}
          confirmText="Delete"
          isLoading={isDeleting}
          onConfirm={() => {
            if (principalToDelete) handleDelete(principalToDelete.id);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
