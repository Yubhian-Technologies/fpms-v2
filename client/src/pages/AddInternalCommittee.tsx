import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";

interface InternalCommitteeUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  level?: number;
  college?: string;
  dateOfJoining?: string;
  experience?: number;
  hasPhd?: boolean;
}

interface RoleOption {
  name: string;
  level: number;
}

interface CollegeDetails {
  name: string;
}

export default function AddInternalCommittee() {
  const [members, setMembers] = useState<InternalCommitteeUser[]>([]);
  const [roleOption, setRoleOption] = useState<RoleOption>({
    name: "internal committee",
    level: 0,
  });
  const [collegeDetails, setCollegeDetails] = useState<CollegeDetails | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [memberToDelete, setMemberToDelete] =
    useState<InternalCommitteeUser | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    dateOfJoining: "",
    experience: "",
    hasPhd: false,
  });

  const getLocalDateInputValue = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const calculateExperience = (dateStr: string): number => {
    if (!dateStr) return 0;
    const joining = new Date(dateStr);
    const today = new Date();
    const diffMs = today.getTime() - joining.getTime();
    return Math.max(0, Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000)));
  };

  const todayDate = useMemo(() => getLocalDateInputValue(), []);

  const fetchMembers = async () => {
    try {
      const res = await api.get("/api/admin/internal-committees");
      setMembers(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      toast({
        title: "Failed to load internal committee users",
        variant: "destructive",
      });
    }
  };

  const fetchRoleOption = async () => {
    try {
      const res = await api.get("/api/admin/internal-committee-role");
      const data = res.data?.data || {};
      setRoleOption({
        name: String(data.name || "internal committee").trim(),
        level: Number.isFinite(Number(data.level)) ? Number(data.level) : 0,
      });
    } catch {
      setRoleOption({ name: "internal committee", level: 0 });
    }
  };

  const fetchCollegeDetails = async () => {
    try {
      const res = await api.get("/api/admin/college-details");
      const data = res.data?.data || null;
      setCollegeDetails(data);
    } catch {
      setCollegeDetails(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        await Promise.all([
          fetchMembers(),
          fetchRoleOption(),
          fetchCollegeDetails(),
        ]);
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
      confirmPassword: "",
      dateOfJoining: "",
      experience: "",
      hasPhd: false,
    });
    setEditingId(null);
  };

  const startAdd = () => {
    if (members.length >= 1) {
      toast({
        title: "Only one internal committee is allowed per college",
        variant: "destructive",
      });
      return;
    }
    resetForm();
    setIsAdding(true);
  };

  const openEdit = (member: InternalCommitteeUser) => {
    setFormData({
      name: member.name || "",
      email: member.email || "",
      phone: member.phone || "",
      password: "",
      confirmPassword: "",
      dateOfJoining: member.dateOfJoining || "",
      experience: member.dateOfJoining
        ? String(calculateExperience(member.dateOfJoining))
        : member.experience !== undefined
          ? String(member.experience)
          : "",
      hasPhd: Boolean(member.hasPhd),
    });
    setEditingId(member.id);
    setIsAdding(true);
  };

  const cancelForm = () => {
    setIsAdding(false);
    resetForm();
  };

  const handleJoiningDateChange = (value: string) => {
    if (value && value > todayDate) return;

    setFormData((prev) => ({
      ...prev,
      dateOfJoining: value,
      experience: value ? String(calculateExperience(value)) : "",
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email || !formData.phone) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }

    if (!editingId && !formData.password) {
      toast({ title: "Password is required", variant: "destructive" });
      return;
    }

    if (formData.password) {
      if (formData.password.length < 6) {
        toast({
          title: "Password must be at least 6 characters",
          variant: "destructive",
        });
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast({
          title: "Password mismatch",
          description: "Password does not match",
          variant: "destructive",
        });
        return;
      }
    }

    const payload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      role: roleOption.name,
      level: roleOption.level,
      password: formData.password || undefined,
      confirmPassword: formData.confirmPassword || undefined,
      dateOfJoining: formData.dateOfJoining || undefined,
      experience:
        formData.dateOfJoining !== ""
          ? calculateExperience(formData.dateOfJoining)
          : formData.experience !== ""
            ? Number(formData.experience)
            : undefined,
      hasPhd: formData.hasPhd,
    };

    try {
      setIsSaving(true);
      if (editingId) {
        await api.put(`/api/admin/internal-committee/${editingId}`, payload);
        toast({ title: "Internal committee user updated" });
      } else {
        await api.post("/api/admin/add-internal-committee", payload);
        toast({ title: "Internal committee user added" });
      }

      await fetchMembers();
      cancelForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Server error",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      await api.delete(`/api/admin/internal-committee/${id}`);
      setMemberToDelete(null);
      await fetchMembers();
      toast({ title: "Internal committee user deleted" });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error?.response?.data?.message || "Server error",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => {
      const values = [member.name, member.email, member.phone, member.college]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return values.includes(q);
    });
  }, [members, searchQuery]);

  return (
    <DashboardLayout
      title="Add Internal Committee"
      subtitle="Principal can manage internal committee users for the current college"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Members</p>
              <p className="text-3xl font-bold mt-2">{members.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">College</p>
              <p className="text-sm font-medium mt-2">
                {collegeDetails?.name || "-"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Role</p>
              <p className="text-sm font-medium mt-2">{roleOption.name}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Input
            placeholder="Search by name, email, phone, or college..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button
            onClick={startAdd}
            className="gap-2"
            disabled={members.length >= 1}
          >
            <Plus className="h-4 w-4" />
            Add Member
          </Button>
        </div>

        {isAdding && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingId ? "Edit Member" : "Add Internal Committee Member"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Level *</Label>
                  <Input
                    value={String(roleOption.level)}
                    disabled
                    placeholder="Auto-filled level"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Input
                    value={roleOption.name}
                    disabled
                    placeholder="Auto-filled role"
                  />
                </div>
                <div className="space-y-2">
                  <Label>College *</Label>
                  <Input
                    value={collegeDetails?.name || "-"}
                    disabled
                    readOnly
                    placeholder="Auto-filled college"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of Joining</Label>
                  <Input
                    type="date"
                    max={todayDate}
                    value={formData.dateOfJoining}
                    onChange={(e) => handleJoiningDateChange(e.target.value)}
                    placeholder="Select joining date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Experience</Label>
                  <Input
                    type="number"
                    min={0}
                    readOnly
                    disabled
                    value={formData.experience}
                    placeholder="Auto-calculated from joining date"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>
                    Password{" "}
                    {!editingId && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    placeholder={
                      editingId
                        ? "Leave blank to keep current password"
                        : "Enter password"
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={cancelForm}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {editingId ? "Update" : "Create"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Internal Committee Users
            </CardTitle>
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
                    <TableHead>Role</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>College</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>{member.name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.phone || "-"}</TableCell>
                      <TableCell>
                        {member.role || "internal committee"}
                      </TableCell>
                      <TableCell>{member.level ?? "-"}</TableCell>
                      <TableCell>{member.college || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(member)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setMemberToDelete(member)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredMembers.length && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        No internal committee users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <DeleteConfirmationDialog
          open={!!memberToDelete}
          onOpenChange={(open) => {
            if (!open && !isDeleting) setMemberToDelete(null);
          }}
          title="Delete internal committee user?"
          description={`This will permanently delete ${memberToDelete?.name || "this user"}.`}
          confirmText="Delete"
          isLoading={isDeleting}
          onConfirm={() => {
            if (memberToDelete) handleDelete(memberToDelete.id);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
