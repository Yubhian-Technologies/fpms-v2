import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Trash2,
  Plus,
  Save,
  Edit2,
  X,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";

// ──────────────────────────────────────────────── Types
interface College {
  id: string;
  name: string;
  location: string;
  code: string;
  isActive: boolean;
  branches: string[];
}

interface CommitteeMember {
  uid?: string;
  name: string;
  email: string;
  phone: string;
  role?: string;
  level?: number;
  registeredAt: string;
}

interface CommitteeMemberForm {
  name: string;
  email: string;
  phone: string;
  role: string;
  level: number;
  password: string;
}

interface RoleOption {
  id: string;
  name: string;
  level: number;
}

// ──────────────────────────────────────────────── Component
export default function ManageColleges() {
  const { toast } = useToast();

  const [colleges, setColleges] = useState<College[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAddingCollegeLoading, setIsAddingCollegeLoading] = useState(false);
  const [isSavingCollegeEditLoading, setIsSavingCollegeEditLoading] =
    useState(false);
  const [deletingCollegeId, setDeletingCollegeId] = useState<string | null>(
    null,
  );
  const [togglingCollegeId, setTogglingCollegeId] = useState<string | null>(
    null,
  );
  const [collegeToDelete, setCollegeToDelete] = useState<College | null>(null);

  const [isAddingCollege, setIsAddingCollege] = useState(false);
  const [editingCollege, setEditingCollege] = useState<string | null>(null);

  // New college form state
  const [newCollege, setNewCollege] = useState<Partial<College>>({
    name: "",
    location: "",
    code: "",
    isActive: true,
    branches: [],
  });

  // Edit college state
  const [editForm, setEditForm] = useState<Partial<College>>({});
  const [newBranchInput, setNewBranchInput] = useState("");
  const [editBranchInput, setEditBranchInput] = useState("");

  const addNewCollegeBranch = () => {
    const branch = newBranchInput.trim();
    if (!branch) return;

    const existing = newCollege.branches ?? [];
    const duplicate = existing.some(
      (item) => item.toLowerCase() === branch.toLowerCase(),
    );
    if (duplicate) {
      toast({
        title: "Duplicate Branch",
        description: "This branch is already added.",
        variant: "destructive",
      });
      return;
    }

    setNewCollege({ ...newCollege, branches: [...existing, branch] });
    setNewBranchInput("");
  };

  const removeNewCollegeBranch = (branch: string) => {
    setNewCollege({
      ...newCollege,
      branches: (newCollege.branches ?? []).filter((item) => item !== branch),
    });
  };

  const addEditCollegeBranch = () => {
    const branch = editBranchInput.trim();
    if (!branch) return;

    const existing = editForm.branches ?? [];
    const duplicate = existing.some(
      (item) => item.toLowerCase() === branch.toLowerCase(),
    );
    if (duplicate) {
      toast({
        title: "Duplicate Branch",
        description: "This branch is already added.",
        variant: "destructive",
      });
      return;
    }

    setEditForm({ ...editForm, branches: [...existing, branch] });
    setEditBranchInput("");
  };

  const removeEditCollegeBranch = (branch: string) => {
    setEditForm({
      ...editForm,
      branches: (editForm.branches ?? []).filter((item) => item !== branch),
    });
  };

  // Committee member state
  const [committeeMember, setCommitteeMember] =
    useState<CommitteeMember | null>(null);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [isAddingMemberLoading, setIsAddingMemberLoading] = useState(false);
  const [isUpdatingMemberLoading, setIsUpdatingMemberLoading] = useState(false);
  const [isDeletingMemberLoading, setIsDeletingMemberLoading] = useState(false);
  const [isDeleteMemberDialogOpen, setIsDeleteMemberDialogOpen] =
    useState(false);
  const [showMemberPassword, setShowMemberPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [memberForm, setMemberForm] = useState<CommitteeMemberForm>({
    name: "",
    email: "",
    phone: "",
    role: "committee",
    level: 1,
    password: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");

  const availableLevels = Array.from(
    new Set(
      (memberForm.role
        ? roleOptions.filter((item) => item.name === memberForm.role)
        : roleOptions
      ).map((item) => Number(item.level)),
    ),
  ).sort((a, b) => a - b);

  const roleNames = Array.from(new Set(roleOptions.map((item) => item.name)));

  const fetchColleges = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const response = await api.get("/api/superadmin/colleges");
      setColleges(response.data?.data ?? []);
    } catch (error: any) {
      if (!silent) {
        toast({
          title: "Load Failed",
          description:
            error?.response?.data?.message || "Unable to load colleges.",
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const fetchCommitteeMember = async (silent = false) => {
    try {
      const response = await api.get("/api/superadmin/committee-member");
      setCommitteeMember(response.data?.data ?? null);
    } catch (error: any) {
      if (!silent) {
        toast({
          title: "Load Failed",
          description:
            error?.response?.data?.message ||
            "Unable to load committee member.",
          variant: "destructive",
        });
      }
    }
  };

  const fetchRoles = async (silent = false) => {
    try {
      const response = await api.get("/api/superadmin/roles");
      setRoleOptions(response.data?.data ?? []);
    } catch (error: any) {
      if (!silent) {
        toast({
          title: "Load Failed",
          description:
            error?.response?.data?.message || "Unable to load role options.",
          variant: "destructive",
        });
      }
    }
  };

  const syncData = async (silent = false) => {
    await Promise.all([
      fetchColleges(silent),
      fetchCommitteeMember(silent),
      fetchRoles(silent),
    ]);
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsInitialLoading(true);
        await syncData();
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadInitialData();

    const interval = window.setInterval(() => {
      syncData(true);
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const handleAddCommitteeMember = async () => {
    const hasValidLevel = Number.isFinite(memberForm.level);
    if (
      !memberForm.name ||
      !memberForm.email ||
      !memberForm.phone ||
      !memberForm.role.trim() ||
      !hasValidLevel ||
      !memberForm.password
    ) {
      toast({
        title: "Validation Error",
        description:
          "Please fill in all required fields including role and level.",
        variant: "destructive",
      });
      return;
    }

    if (memberForm.password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Password and confirm password do not match.",
        variant: "destructive",
      });
      return;
    }

    if (memberForm.password.length < 6) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAddingMemberLoading(true);
      await api.post("/api/superadmin/committee-member/register", {
        name: memberForm.name,
        email: memberForm.email,
        phone: memberForm.phone,
        role: memberForm.role,
        level: memberForm.level,
        password: memberForm.password,
      });

      await fetchCommitteeMember(true);
      setIsAddingMember(false);
      setConfirmPassword("");
      setMemberForm({
        name: "",
        email: "",
        phone: "",
        role: "committee",
        level: 1,
        password: "",
      });

      toast({
        title: "Committee Member Registered",
        description: "Committee member has been successfully registered.",
      });
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description:
          error?.response?.data?.message ||
          "Unable to register committee member.",
        variant: "destructive",
      });
    } finally {
      setIsAddingMemberLoading(false);
    }
  };

  const startEditMember = () => {
    if (committeeMember) {
      setIsEditingMember(true);
      setMemberForm({
        name: committeeMember.name,
        email: committeeMember.email,
        phone: committeeMember.phone,
        role: committeeMember.role || "committee",
        level: committeeMember.level || 1,
        password: "",
      });
      setConfirmPassword("");
    }
  };

  const cancelEditMember = () => {
    setIsEditingMember(false);
    setConfirmPassword("");
    setMemberForm({
      name: "",
      email: "",
      phone: "",
      role: "committee",
      level: 1,
      password: "",
    });
  };

  const saveEditMember = async () => {
    const hasValidLevel = Number.isFinite(memberForm.level);
    if (
      !memberForm.name ||
      !memberForm.email ||
      !memberForm.phone ||
      !memberForm.role.trim() ||
      !hasValidLevel
    ) {
      toast({
        title: "Validation Error",
        description:
          "Please fill in all required fields including role and level.",
        variant: "destructive",
      });
      return;
    }

    if (memberForm.password) {
      if (memberForm.password !== confirmPassword) {
        toast({
          title: "Password Mismatch",
          description: "Password and confirm password do not match.",
          variant: "destructive",
        });
        return;
      }

      if (memberForm.password.length < 6) {
        toast({
          title: "Weak Password",
          description: "Password must be at least 6 characters long.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setIsUpdatingMemberLoading(true);
      await api.put("/api/superadmin/committee-member", {
        name: memberForm.name,
        phone: memberForm.phone,
        role: memberForm.role,
        level: memberForm.level,
        password: memberForm.password || undefined,
      });

      await fetchCommitteeMember(true);
      setIsEditingMember(false);
      setConfirmPassword("");
      setMemberForm({
        name: "",
        email: "",
        phone: "",
        role: "committee",
        level: 1,
        password: "",
      });

      toast({
        title: "Member Updated",
        description:
          "Committee member information has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description:
          error?.response?.data?.message ||
          "Unable to update committee member.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingMemberLoading(false);
    }
  };

  const handleDeleteMember = async () => {
    try {
      setIsDeletingMemberLoading(true);
      await api.delete("/api/superadmin/committee-member");
      setCommitteeMember(null);
      setIsDeleteMemberDialogOpen(false);
      toast({
        title: "Member Removed",
        description: "Committee member has been removed from the system.",
      });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description:
          error?.response?.data?.message ||
          "Unable to remove committee member.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingMemberLoading(false);
    }
  };

  const handleAddCollege = async () => {
    if (!newCollege.name || !newCollege.location || !newCollege.code) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAddingCollegeLoading(true);
      await api.post("/api/superadmin/colleges", {
        name: newCollege.name,
        location: newCollege.location,
        code: newCollege.code,
        isActive: newCollege.isActive ?? true,
        branches: newCollege.branches ?? [],
      });

      await fetchColleges(true);
      setIsAddingCollege(false);
      setNewCollege({
        name: "",
        location: "",
        code: "",
        isActive: true,
        branches: [],
      });
      setNewBranchInput("");

      toast({
        title: "College Added",
        description: "College has been successfully added.",
      });
    } catch (error: any) {
      toast({
        title: "Add Failed",
        description: error?.response?.data?.message || "Unable to add college.",
        variant: "destructive",
      });
    } finally {
      setIsAddingCollegeLoading(false);
    }
  };

  const handleDeleteCollege = async (collegeId: string) => {
    try {
      setDeletingCollegeId(collegeId);
      await api.delete(`/api/superadmin/colleges/${collegeId}`);
      await fetchColleges(true);
      setCollegeToDelete(null);
      toast({
        title: "College Deleted",
        description: "The college has been removed from the system.",
      });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description:
          error?.response?.data?.message || "Unable to delete college.",
        variant: "destructive",
      });
    } finally {
      setDeletingCollegeId(null);
    }
  };

  const startEdit = (college: College) => {
    setEditingCollege(college.id);
    setEditForm(college);
    setEditBranchInput("");
  };

  const cancelEdit = () => {
    setEditingCollege(null);
    setEditForm({});
    setEditBranchInput("");
  };

  const saveEdit = async () => {
    if (!editForm.name || !editForm.location || !editForm.code) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSavingCollegeEditLoading(true);
      await api.put(`/api/superadmin/colleges/${editingCollege}`, {
        name: editForm.name,
        location: editForm.location,
        code: editForm.code,
        branches: editForm.branches ?? [],
      });

      await fetchColleges(true);
      setEditingCollege(null);
      setEditForm({});

      toast({
        title: "College Updated",
        description: "College information has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description:
          error?.response?.data?.message || "Unable to update college.",
        variant: "destructive",
      });
    } finally {
      setIsSavingCollegeEditLoading(false);
    }
  };

  const toggleStatus = async (collegeId: string) => {
    const target = colleges.find((c) => c.id === collegeId);
    if (!target) return;

    try {
      setTogglingCollegeId(collegeId);
      await api.put(`/api/superadmin/colleges/${collegeId}`, {
        isActive: !target.isActive,
      });
      await fetchColleges(true);
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description:
          error?.response?.data?.message || "Unable to update college status.",
        variant: "destructive",
      });
    } finally {
      setTogglingCollegeId(null);
    }
  };

  const handleSaveAll = async () => {
    try {
      setIsSyncing(true);
      await syncData(true);
      toast({
        title: "Synced",
        description: "Colleges and committee data are synced with server.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatRegisteredDate = (value: any) => {
    if (!value) return "-";

    if (typeof value === "string") {
      return new Date(value).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    if (value?.seconds) {
      return new Date(value.seconds * 1000).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    return "-";
  };

  return (
    <DashboardLayout
      title="Manage Colleges"
      subtitle="Manage colleges and committee member for the society"
    >
      {isInitialLoading ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">
              Loading colleges and committee data...
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-6 pb-16">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Total Colleges
                  </p>
                  <p className="text-4xl font-bold mt-2">{colleges.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50/50 border-green-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Active Colleges
                  </p>
                  <p className="text-4xl font-bold mt-2 text-green-600">
                    {colleges.filter((c) => c.isActive).length}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50/50 border-orange-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Inactive Colleges
                  </p>
                  <p className="text-4xl font-bold mt-2 text-orange-600">
                    {colleges.filter((c) => !c.isActive).length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Header Actions */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-muted-foreground">
                {colleges.length} college{colleges.length !== 1 ? "s" : ""}{" "}
                configured
              </p>
              {isLoading && (
                <p className="text-xs text-muted-foreground mt-1">
                  Syncing data...
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setIsAddingCollege(!isAddingCollege)}
                variant={isAddingCollege ? "outline" : "default"}
                className="gap-2"
                disabled={
                  isAddingCollegeLoading ||
                  isSyncing ||
                  isSavingCollegeEditLoading ||
                  deletingCollegeId !== null
                }
              >
                {isAddingCollege ? (
                  "Cancel"
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Add New College
                  </>
                )}
              </Button>
              <Button
                onClick={handleSaveAll}
                className="gap-2 bg-green-700 hover:bg-green-800"
                disabled={
                  isSyncing ||
                  isAddingCollegeLoading ||
                  isSavingCollegeEditLoading ||
                  deletingCollegeId !== null
                }
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSyncing ? "Syncing..." : "Save All Changes"}
              </Button>
            </div>
          </div>

          {/* Add New College Form */}
          {isAddingCollege && (
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle>Add New College</CardTitle>
                <CardDescription>Add a college to the society</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>College Name *</Label>
                    <Input
                      placeholder="e.g., St. Joseph's College..."
                      value={newCollege.name}
                      onChange={(e) =>
                        setNewCollege({ ...newCollege, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location *</Label>
                    <Input
                      placeholder="e.g., Chennai, Bangalore..."
                      value={newCollege.location}
                      onChange={(e) =>
                        setNewCollege({
                          ...newCollege,
                          location: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>College Code *</Label>
                    <Input
                      placeholder="e.g., SJCE, SJIT..."
                      value={newCollege.code}
                      onChange={(e) =>
                        setNewCollege({
                          ...newCollege,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">
                        Branches
                      </Label>
                      <Badge variant="outline">
                        {(newCollege.branches ?? []).length} Added
                      </Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <Input
                        placeholder="e.g., CSE, ECE, MBA"
                        value={newBranchInput}
                        onChange={(e) => setNewBranchInput(e.target.value)}
                      />
                      <Button type="button" onClick={addNewCollegeBranch}>
                        Add Branch
                      </Button>
                    </div>

                    {(newCollege.branches ?? []).length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No branches added yet.
                      </p>
                    )}

                    {(newCollege.branches ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {(newCollege.branches ?? []).map((branch) => (
                          <Badge
                            key={branch}
                            variant="secondary"
                            className="gap-1 pr-1"
                          >
                            {branch}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 hover:bg-transparent"
                              onClick={() => removeNewCollegeBranch(branch)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddingCollege(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddCollege} className="gap-2">
                    {isAddingCollegeLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {isAddingCollegeLoading ? "Adding..." : "Add College"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Colleges Table */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Colleges</CardTitle>
              <CardDescription>
                View and manage colleges in the society
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>College Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Branches</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colleges.map((college) => (
                    <TableRow key={college.id}>
                      <TableCell className="font-medium">
                        {editingCollege === college.id ? (
                          <Input
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm({ ...editForm, name: e.target.value })
                            }
                          />
                        ) : (
                          college.name
                        )}
                      </TableCell>
                      <TableCell>
                        {editingCollege === college.id ? (
                          <Input
                            value={editForm.location}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                location: e.target.value,
                              })
                            }
                          />
                        ) : (
                          college.location
                        )}
                      </TableCell>
                      <TableCell>
                        {editingCollege === college.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editForm.code}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  code: e.target.value.toUpperCase(),
                                })
                              }
                              className="w-24"
                            />
                          </div>
                        ) : (
                          <Badge variant="outline">{college.code}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingCollege === college.id ? (
                          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3 min-w-[260px]">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">
                                Manage Branches
                              </p>
                              <Badge variant="outline">
                                {(editForm.branches ?? []).length}
                              </Badge>
                            </div>

                            <div className="grid gap-2 grid-cols-[1fr_auto]">
                              <Input
                                value={editBranchInput}
                                onChange={(e) =>
                                  setEditBranchInput(e.target.value)
                                }
                                placeholder="Enter branch name"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addEditCollegeBranch}
                              >
                                Add
                              </Button>
                            </div>

                            {(editForm.branches ?? []).length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                No branches added.
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {(editForm.branches ?? []).map((branch) => (
                                  <Badge
                                    key={branch}
                                    variant="secondary"
                                    className="gap-1 pr-1"
                                  >
                                    {branch}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 hover:bg-transparent"
                                      onClick={() =>
                                        removeEditCollegeBranch(branch)
                                      }
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {college.branches.length > 0 ? (
                              college.branches.map((branch) => (
                                <Badge key={branch} variant="secondary">
                                  {branch}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                No branches
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={college.isActive ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() =>
                            editingCollege !== college.id &&
                            toggleStatus(college.id)
                          }
                        >
                          {togglingCollegeId === college.id
                            ? "Updating..."
                            : college.isActive
                              ? "Active"
                              : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {editingCollege === college.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={saveEdit}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                disabled={isSavingCollegeEditLoading}
                              >
                                {isSavingCollegeEditLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEdit}
                                disabled={isSavingCollegeEditLoading}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEdit(college)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCollegeToDelete(college)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                disabled={deletingCollegeId === college.id}
                              >
                                {deletingCollegeId === college.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {colleges.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No colleges configured yet. Click "Add New College" to create
                  one.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Committee Member Section */}
          <Card>
            <CardHeader className="bg-white">
              <div className="flex justify-between bg-white items-center">
                <div>
                  <CardTitle>Society Committee Member</CardTitle>
                  <CardDescription>
                    Register and manage the committee member for the society
                  </CardDescription>
                </div>
                {!committeeMember && !isAddingMember && (
                  <Button
                    onClick={() => setIsAddingMember(true)}
                    variant="default"
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Register Member
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Add Member Form */}
              {isAddingMember && !committeeMember && (
                <div className="space-y-6 border-2 border-primary rounded-lg p-6 bg-white">
                  <h3 className="font-semibold text-lg">
                    Register Committee Member
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Full Name *</Label>
                      <Input
                        placeholder="Enter full name"
                        value={memberForm.name}
                        onChange={(e) =>
                          setMemberForm({ ...memberForm, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email Address *</Label>
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={memberForm.email}
                        onChange={(e) =>
                          setMemberForm({
                            ...memberForm,
                            email: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number *</Label>
                      <Input
                        placeholder="+91 XXXXXXXXXX"
                        value={memberForm.phone}
                        onChange={(e) =>
                          setMemberForm({
                            ...memberForm,
                            phone: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role *</Label>
                      <Select
                        value={memberForm.role}
                        onValueChange={(value) => {
                          const roleMatch = roleOptions.find(
                            (item) => item.name === value,
                          );
                          setMemberForm({
                            ...memberForm,
                            role: value,
                            level: roleMatch
                              ? Number(roleMatch.level)
                              : memberForm.level,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              roleOptions.length
                                ? "Select role"
                                : "No roles configured"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {roleNames.map((roleName) => (
                            <SelectItem key={roleName} value={roleName}>
                              {roleName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Level *</Label>
                      <Select
                        value={String(memberForm.level)}
                        onValueChange={(value) =>
                          setMemberForm({ ...memberForm, level: Number(value) })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              availableLevels.length
                                ? "Select level"
                                : "No levels available"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {availableLevels.map((level) => (
                            <SelectItem key={level} value={String(level)}>
                              Level {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <div className="relative">
                        <Input
                          type={showMemberPassword ? "text" : "password"}
                          placeholder="Enter password (min 6 characters)"
                          value={memberForm.password}
                          onChange={(e) =>
                            setMemberForm({
                              ...memberForm,
                              password: e.target.value,
                            })
                          }
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowMemberPassword((prev) => !prev)}
                        >
                          {showMemberPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Confirm Password *</Label>
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
                          onClick={() =>
                            setShowConfirmPassword((prev) => !prev)
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {confirmPassword &&
                        memberForm.password !== confirmPassword && (
                          <p className="text-xs text-red-600">
                            Password doesn\'t match
                          </p>
                        )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setIsAddingMember(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddCommitteeMember}
                      className="gap-2"
                      disabled={isAddingMemberLoading}
                    >
                      {isAddingMemberLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {isAddingMemberLoading
                        ? "Registering..."
                        : "Register Member"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Display Existing Member */}
              {committeeMember && !isEditingMember && (
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Full Name</Label>
                      <p className="font-semibold text-lg">
                        {committeeMember.name}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">
                        Email Address
                      </Label>
                      <p className="font-medium">{committeeMember.email}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">
                        Phone Number
                      </Label>
                      <p className="font-medium">{committeeMember.phone}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Role</Label>
                      <p className="font-medium">
                        {committeeMember.role || "committee"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Level</Label>
                      <p className="font-medium">
                        {committeeMember.level ?? 1}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">
                        Registered On
                      </Label>
                      <p className="font-medium text-sm">
                        {formatRegisteredDate(committeeMember.registeredAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    {/* <Button
                    variant="outline"
                    onClick={startEditMember}
                    className="gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit Member
                  </Button> */}
                    <Button
                      variant="destructive"
                      onClick={() => setIsDeleteMemberDialogOpen(true)}
                      className="gap-2"
                      disabled={isDeletingMemberLoading}
                    >
                      {isDeletingMemberLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Remove Member
                    </Button>
                  </div>
                </div>
              )}

              {/* Edit Member Form */}
              {isEditingMember && committeeMember && (
                <div className="space-y-6 border-2 border-orange-500 rounded-lg p-6 bg-white">
                  <h3 className="font-semibold text-lg">
                    Edit Committee Member
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Full Name *</Label>
                      <Input
                        value={memberForm.name}
                        onChange={(e) =>
                          setMemberForm({ ...memberForm, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email Address *</Label>
                      <Input
                        type="email"
                        value={memberForm.email}
                        onChange={(e) =>
                          setMemberForm({
                            ...memberForm,
                            email: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number *</Label>
                      <Input
                        value={memberForm.phone}
                        onChange={(e) =>
                          setMemberForm({
                            ...memberForm,
                            phone: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role *</Label>
                      <Select
                        value={memberForm.role}
                        onValueChange={(value) => {
                          const roleMatch = roleOptions.find(
                            (item) => item.name === value,
                          );
                          setMemberForm({
                            ...memberForm,
                            role: value,
                            level: roleMatch
                              ? Number(roleMatch.level)
                              : memberForm.level,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              roleOptions.length
                                ? "Select role"
                                : "No roles configured"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {roleNames.map((roleName) => (
                            <SelectItem key={roleName} value={roleName}>
                              {roleName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Level *</Label>
                      <Select
                        value={String(memberForm.level)}
                        onValueChange={(value) =>
                          setMemberForm({ ...memberForm, level: Number(value) })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              availableLevels.length
                                ? "Select level"
                                : "No levels available"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {availableLevels.map((level) => (
                            <SelectItem key={level} value={String(level)}>
                              Level {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <div className="relative">
                        <Input
                          type={showMemberPassword ? "text" : "password"}
                          placeholder="Enter new password (min 6 characters)"
                          value={memberForm.password}
                          onChange={(e) =>
                            setMemberForm({
                              ...memberForm,
                              password: e.target.value,
                            })
                          }
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowMemberPassword((prev) => !prev)}
                        >
                          {showMemberPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Confirm Password *</Label>
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
                          onClick={() =>
                            setShowConfirmPassword((prev) => !prev)
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {confirmPassword &&
                        memberForm.password !== confirmPassword && (
                          <p className="text-xs text-red-600">
                            Password doesn\'t match
                          </p>
                        )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={cancelEditMember}>
                      Cancel
                    </Button>
                    <Button
                      onClick={saveEditMember}
                      className="gap-2 bg-green-700 hover:bg-green-800"
                      disabled={isUpdatingMemberLoading}
                    >
                      {isUpdatingMemberLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {isUpdatingMemberLoading ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              )}

              {/* No Member State */}
              {!committeeMember && !isAddingMember && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg">No committee member registered yet.</p>
                  <p className="text-sm mt-2">
                    Click "Register Member" to add a committee member for the
                    society.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <DeleteConfirmationDialog
            open={!!collegeToDelete}
            onOpenChange={(open) => {
              if (!open && !deletingCollegeId) setCollegeToDelete(null);
            }}
            title="Delete college?"
            description={`This will permanently delete ${collegeToDelete?.name || "this college"}.`}
            confirmText="Delete"
            isLoading={!!deletingCollegeId}
            onConfirm={() => {
              if (collegeToDelete) handleDeleteCollege(collegeToDelete.id);
            }}
          />

          <DeleteConfirmationDialog
            open={isDeleteMemberDialogOpen}
            onOpenChange={(open) => {
              if (!isDeletingMemberLoading) setIsDeleteMemberDialogOpen(open);
            }}
            title="Remove committee member?"
            description="This will permanently remove the registered committee member account."
            confirmText="Remove"
            isLoading={isDeletingMemberLoading}
            onConfirm={handleDeleteMember}
          />

          {/* Summary Cards */}
        </div>
      )}
    </DashboardLayout>
  );
}
