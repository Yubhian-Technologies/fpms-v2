import { useEffect, useRef, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Eye,
  EyeOff,
  Loader2,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import { downloadDemoExcel, excelHeaders } from "@/lib/excelUtils";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";

interface Dean {
  id: string;
  name: string;
  email: string;
  college: string;
  role: string;
  level?: number;
  hasPhd?: boolean;
  designation?: string;
  experience?: number;
  dateOfJoining?: string;
}

interface CollegeDetails {
  id?: string;
  name: string;
  code?: string;
}

interface DesignationOption {
  name: string;
  target: string;
  phd: boolean;
}

interface RoleOption {
  id: string;
  name: string;
  level: number;
}

export default function AddDean() {
  const [deans, setDeans] = useState<Dean[]>([]);
  const [collegeDetails, setCollegeDetails] = useState<CollegeDetails | null>(
    null,
  );
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingDean, setIsAddingDean] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deanToDelete, setDeanToDelete] = useState<Dean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [designations, setDesignations] = useState<DesignationOption[]>([]);

  // Excel upload state
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const [isExcelDialogOpen, setIsExcelDialogOpen] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [excelRows, setExcelRows] = useState<
    Array<{
      name: string;
      email: string;
      pass: string;
      role: string;
      designation: string;
      hasPhd: boolean;
      error?: string;
    }>
  >([]);

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
    pass: "",
    confirm_pass: "",
    designation: "",
    college: "",
    role: "",
    level: 0,
    hasPhd: false,
    dateOfJoining: "",
    experience: "",
  });

  const lockedCollegeName = collegeDetails?.name || "";

  const normalizedLockedCollege = String(lockedCollegeName || "")
    .trim()
    .toLowerCase();

  const occupiedRoleNamesForCollege = new Set(
    deans
      .filter((dean) => {
        const deanCollege = String(dean.college || "")
          .trim()
          .toLowerCase();
        return normalizedLockedCollege
          ? deanCollege === normalizedLockedCollege
          : true;
      })
      .map((dean) =>
        String(dean.role || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );

  const fetchDesignations = async () => {
    try {
      const res = await api.get("/api/admin/designations");
      const payload = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data?.data?.designations)
          ? res.data.data.designations
          : [];

      const designationList: DesignationOption[] = payload
        .map((item: any) => {
          if (typeof item === "string")
            return { name: item.trim(), target: "", phd: false };
          if (typeof item === "object" && item !== null)
            return {
              name: String(item.name || item || "").trim(),
              target: String(item.target || "").trim(),
              phd: Boolean(item.phd),
            };
          return null;
        })
        .filter((item: any): item is DesignationOption => !!item?.name);

      setDesignations(designationList);
    } catch (err) {
      console.error("Failed to fetch designations:", err);
      setDesignations([]);
    }
  };
  const availableRoleOptions = roleOptions.filter((role) => {
    const normalizedRoleName = String(role.name || "")
      .trim()
      .toLowerCase();

    if (!normalizedRoleName) return false;

    if (editingId) {
      const currentRole = String(formData.role || "")
        .trim()
        .toLowerCase();
      return (
        !occupiedRoleNamesForCollege.has(normalizedRoleName) ||
        normalizedRoleName === currentRole
      );
    }

    return !occupiedRoleNamesForCollege.has(normalizedRoleName);
  });

  const fetchDeans = async () => {
    try {
      const res = await api.get("/api/dean/all-deans");
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      const normalized = data
        .map((item: any) => ({
          ...item,
          level:
            item.level !== undefined && Number.isFinite(Number(item.level))
              ? Number(item.level)
              : undefined,
          hasPhd: item.hasPhd ?? item.hasPhD ?? false,
        }))
        .filter((item: any) =>
          String(item.role || "")
            .trim()
            .toLowerCase()
            .startsWith("dean"),
        );
      setDeans(normalized);
    } catch {
      toast({ title: "Failed to load deans", variant: "destructive" });
    }
  };

  const fetchCollegeDetails = async () => {
    try {
      const res = await api.get("/api/dean/college-details");
      const data = res.data?.data || null;
      setCollegeDetails(data);
    } catch {
      toast({
        title: "Failed to load college details",
        variant: "destructive",
      });
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get("/api/dean/roles");
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
        await Promise.all([
          fetchDeans(),
          fetchCollegeDetails(),
          fetchRoles(),
          fetchDesignations(),
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const resetForm = () => {
    const defaultRole = availableRoleOptions[0];
    setFormData({
      name: "",
      email: "",
      pass: "",
      confirm_pass: "",
      college: lockedCollegeName,
      designation: "",
      role: defaultRole?.name || "",
      level: Number(defaultRole?.level ?? 0),
      hasPhd: designations[0]?.phd ?? false,
      dateOfJoining: "",
      experience: "",
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setEditingId(null);
  };

  const startNewDean = () => {
    resetForm();
    setIsAddingDean(true);
  };

  const cancelForm = () => {
    setIsAddingDean(false);
    resetForm();
  };

  const openEdit = (dean: Dean) => {
    const matchingRole = roleOptions.find((item) => item.name === dean.role);
    const rawDesignation = dean.designation || "";
    const storedHasPhd = !!dean.hasPhd;
    const exactMatch = designations.find(
      (d) => d.name === rawDesignation && d.phd === storedHasPhd,
    );
    const nameMatch =
      exactMatch ?? designations.find((d) => d.name === rawDesignation);
    const resolvedDesignation = nameMatch?.name ?? rawDesignation;
    const resolvedHasPhd = exactMatch
      ? storedHasPhd
      : (nameMatch?.phd ?? storedHasPhd);

    const joiningDate = dean.dateOfJoining || "";
    setFormData({
      name: dean.name,
      email: dean.email,
      pass: "",
      confirm_pass: "",
      college: lockedCollegeName || dean.college,
      designation: resolvedDesignation,
      role: dean.role || availableRoleOptions[0]?.name || "",
      level: Number(dean.level ?? matchingRole?.level ?? 0),
      hasPhd: resolvedHasPhd,
      dateOfJoining: joiningDate,
      experience: joiningDate
        ? String(calculateExperience(joiningDate))
        : dean.experience !== undefined
          ? String(dean.experience)
          : "",
    });
    setEditingId(dean.id);
    setIsAddingDean(true);
  };

  const handleSave = async () => {
    const resolvedCollege = lockedCollegeName || formData.college;

    if (
      !formData.name ||
      !formData.email ||
      !resolvedCollege ||
      !formData.role ||
      !Number.isFinite(formData.level)
    ) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }

    const selectedRoleName = String(formData.role || "")
      .trim()
      .toLowerCase();
    const isSelectedRoleAvailable = availableRoleOptions.some(
      (role) =>
        String(role.name || "")
          .trim()
          .toLowerCase() === selectedRoleName,
    );

    if (!isSelectedRoleAvailable) {
      toast({
        title: "Role not available",
        description: "Selected role is already assigned in this college.",
        variant: "destructive",
      });
      return;
    }

    if (!editingId && !formData.pass) {
      toast({ title: "Password is required", variant: "destructive" });
      return;
    }

    if (formData.pass) {
      if (formData.pass.length < 6) {
        toast({
          title: "Password must be at least 6 characters",
          variant: "destructive",
        });
        return;
      }

      if (formData.pass !== formData.confirm_pass) {
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
        pass: formData.pass || undefined,
        confirm_pass: formData.confirm_pass || undefined,
        college: resolvedCollege,
        role: formData.role,
        level: Number(formData.level),
        designation: formData.designation,
        hasPhd: formData.hasPhd,
        dateOfJoining: formData.dateOfJoining || undefined,
        experience:
          formData.experience !== "" ? Number(formData.experience) : undefined,
      };

      if (editingId) {
        await api.put(`/api/dean/update/${editingId}`, payload);
        toast({ title: "Dean updated successfully" });
      } else {
        await api.post("/api/dean/add-dean", payload);
        toast({ title: "Dean added successfully" });
      }

      await fetchDeans();
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

  const validateExcelRow = (
    row: Omit<(typeof excelRows)[0], "error">,
    currentRoleOptions: RoleOption[],
    currentDesignations: DesignationOption[],
    occupiedRoles: Set<string>,
  ): string => {
    let error = "";
    if (!row.name.trim()) error += "Name missing. ";
    if (!row.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email))
      error += "Valid email required. ";
    if (!row.pass || row.pass.length < 6)
      error += "Password must be ≥6 chars. ";
    if (!row.role.trim()) {
      error += "Role missing. ";
    } else {
      const normalizedRole = row.role.trim().toLowerCase();
      const roleValid = currentRoleOptions.some(
        (r) => r.name.trim().toLowerCase() === normalizedRole,
      );
      if (!roleValid) error += "Role not in allowed list. ";
      else if (occupiedRoles.has(normalizedRole))
        error += "Role already assigned to an existing dean. ";
    }
    if (row.designation.trim() && currentDesignations.length > 0) {
      const desigValid = currentDesignations.some(
        (d) =>
          d.name.trim().toLowerCase() === row.designation.trim().toLowerCase(),
      );
      if (!desigValid) error += "Designation not in allowed list. ";
    }
    return error.trim();
  };

  const updateExcelRow = (
    idx: number,
    updates: Partial<Omit<(typeof excelRows)[0], "error">>,
  ) => {
    setExcelRows((prev) => {
      const updated = [...prev];
      const newRow = { ...updated[idx], ...updates };
      newRow.error = validateExcelRow(
        newRow,
        roleOptions,
        designations,
        occupiedRoleNamesForCollege,
      );
      updated[idx] = newRow;
      return updated;
    });
  };

  const deleteExcelRow = (idx: number) => {
    setExcelRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const parsed = rows.map((row) => {
          const name = String(row["name"] ?? row["Name"] ?? "").trim();
          const email = String(row["email"] ?? row["Email"] ?? "").trim();
          const pass = String(
            row["pass"] ?? row["password"] ?? row["Password"] ?? "",
          ).trim();
          const role = String(row["role"] ?? row["Role"] ?? "").trim();
          const designation = String(
            row["designation"] ?? row["Designation"] ?? "",
          ).trim();
          const hasPhdRaw =
            row["hasPhd"] ??
            row["hasphd"] ??
            row["HasPhD"] ??
            row["has_phd"] ??
            false;
          const hasPhd =
            hasPhdRaw === true ||
            String(hasPhdRaw).toLowerCase() === "yes" ||
            String(hasPhdRaw).toLowerCase() === "true" ||
            String(hasPhdRaw) === "1";

          const base = { name, email, pass, role, designation, hasPhd };
          return {
            ...base,
            error: validateExcelRow(
              base,
              roleOptions,
              designations,
              occupiedRoleNamesForCollege,
            ),
          };
        });

        if (parsed.length === 0) {
          toast({
            title: "No rows found in the Excel file",
            variant: "destructive",
          });
          return;
        }

        // Check for duplicate emails against existing deans
        const existingEmails = new Set(
          deans.map((d) => d.email.trim().toLowerCase()),
        );
        // Check for duplicate emails within the Excel file itself
        const seenInFile = new Set<string>();
        const finalParsed = parsed.map((row) => {
          const emailKey = row.email.trim().toLowerCase();
          let extraError = "";
          if (emailKey && existingEmails.has(emailKey)) {
            extraError = "Email already exists in the system. ";
          } else if (emailKey && seenInFile.has(emailKey)) {
            extraError = "Duplicate email in this file. ";
          }
          if (emailKey) seenInFile.add(emailKey);
          return extraError
            ? {
                ...row,
                error: (row.error ? row.error + " " : "") + extraError.trim(),
              }
            : row;
        });

        setExcelRows(finalParsed);
        setIsExcelDialogOpen(true);
      } catch {
        toast({ title: "Failed to parse Excel file", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkUpload = async () => {
    const validRows = excelRows.filter((r) => !r.error);
    if (validRows.length === 0) {
      toast({ title: "No valid rows to upload", variant: "destructive" });
      return;
    }

    setIsBulkUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const row of validRows) {
      const matchingRole = roleOptions.find(
        (r) => r.name.trim().toLowerCase() === row.role.trim().toLowerCase(),
      );
      try {
        await api.post("/api/dean/add-dean", {
          name: row.name,
          email: row.email,
          pass: row.pass,
          confirm_pass: row.pass,
          college: lockedCollegeName,
          role: row.role,
          level: Number(matchingRole?.level ?? 0),
          designation: row.designation || designations[0]?.name || "",
          hasPhd: row.hasPhd,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setIsBulkUploading(false);
    setIsExcelDialogOpen(false);
    setExcelRows([]);
    if (xlsxInputRef.current) xlsxInputRef.current.value = "";
    await fetchDeans();

    toast({
      title: "Bulk upload complete",
      description: `${successCount} added${failCount > 0 ? `, ${failCount} failed` : ""}.`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      await api.delete(`/api/dean/delete/${id}`);
      toast({ title: "Dean deleted" });
      await fetchDeans();
      setDeanToDelete(null);
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const collegeDeans = deans.filter((dean) => {
    if (!normalizedLockedCollege) return true;
    return (
      String(dean.college || "")
        .trim()
        .toLowerCase() === normalizedLockedCollege
    );
  });

  const filteredDeans = collegeDeans.filter((dean) => {
    const q = searchQuery.toLowerCase();
    return (
      dean.name.toLowerCase().includes(q) ||
      dean.email.toLowerCase().includes(q) ||
      dean.college.toLowerCase().includes(q) ||
      dean.role.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (!lockedCollegeName) return;

    setFormData((prev) => {
      if (prev.college === lockedCollegeName) return prev;
      return {
        ...prev,
        college: lockedCollegeName,
      };
    });
  }, [lockedCollegeName]);

  useEffect(() => {
    if (!isAddingDean) return;

    const selectedRoleName = String(formData.role || "")
      .trim()
      .toLowerCase();
    const hasSelectedRole = availableRoleOptions.some(
      (role) =>
        String(role.name || "")
          .trim()
          .toLowerCase() === selectedRoleName,
    );

    if (hasSelectedRole) return;

    const fallbackRole = availableRoleOptions[0];
    setFormData((prev) => ({
      ...prev,
      role: fallbackRole?.name || "",
      level: Number(fallbackRole?.level ?? 0),
    }));
  }, [availableRoleOptions, formData.role, isAddingDean]);

  return (
    <DashboardLayout
      title="Add Dean"
      subtitle="Manage deans by college and role"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dean Management</h1>
            <p className="text-muted-foreground">Add and manage deans</p>
          </div>
          {!isAddingDean && (
            <div className="flex gap-2">
              <input
                ref={xlsxInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleExcelFile(file);
                }}
              />
              <Button
                variant="outline"
                onClick={() =>
                  downloadDemoExcel("dean_template.xlsx", excelHeaders.dean)
                }
              >
                <Download className="mr-2 h-4 w-4" /> Download Template
              </Button>
              <Button
                variant="outline"
                onClick={() => xlsxInputRef.current?.click()}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Upload Excel
              </Button>
              <Button onClick={startNewDean}>
                <Plus className="mr-2 h-4 w-4" /> Add Dean
              </Button>
            </div>
          )}
        </div>

        {isAddingDean && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle>{editingId ? "Edit Dean" : "Add Dean"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="Enter dean name"
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
                    placeholder="dean@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>College *</Label>
                  <Input
                    value={
                      lockedCollegeName
                        ? `${lockedCollegeName}${collegeDetails?.code ? ` (${collegeDetails.code})` : ""}`
                        : ""
                    }
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select
                    value={formData.role}
                    disabled={!availableRoleOptions.length}
                    onValueChange={(value) => {
                      const selectedRole = availableRoleOptions.find(
                        (item) => item.name === value,
                      );
                      setFormData({
                        ...formData,
                        role: value,
                        level: Number(selectedRole?.level ?? 0),
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          availableRoleOptions.length
                            ? "Select role"
                            : "No dean roles available for this college"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoleOptions.map((role) => (
                        <SelectItem key={role.id} value={role.name}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Designation *</Label>
                  <Select
                    value={
                      formData.designation
                        ? `${formData.designation}__${formData.hasPhd ? "phd" : "nophd"}`
                        : ""
                    }
                    onValueChange={(key) => {
                      const opt = designations.find(
                        (d) => `${d.name}__${d.phd ? "phd" : "nophd"}` === key,
                      );
                      if (opt)
                        setFormData({
                          ...formData,
                          designation: opt.name,
                          hasPhd: opt.phd,
                        });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select designation" />
                    </SelectTrigger>
                    <SelectContent>
                      {designations.map((d) => {
                        const key = `${d.name}__${d.phd ? "phd" : "nophd"}`;
                        return (
                          <SelectItem key={key} value={key}>
                            {d.name} {d.phd ? "(PhD)" : "(No PhD)"}
                            {d.target ? ` — Target: ${d.target}` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Level *</Label>
                  <Input value={String(formData.level)} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Date of Joining</Label>
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
                    placeholder="Auto-calculated"
                  />
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
                      value={formData.pass}
                      onChange={(e) =>
                        setFormData({ ...formData, pass: e.target.value })
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
                      value={formData.confirm_pass}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirm_pass: e.target.value,
                        })
                      }
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
                  {formData.confirm_pass &&
                    formData.pass !== formData.confirm_pass && (
                      <p className="text-xs text-red-600">
                        Password doesn't match
                      </p>
                    )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Target Score</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      value={
                        designations.find(
                          (d) =>
                            d.name === formData.designation &&
                            d.phd === formData.hasPhd,
                        )?.target || "—"
                      }
                      disabled
                      className="bg-muted font-semibold max-w-[180px]"
                    />
                    {formData.designation && (
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          formData.hasPhd
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-muted text-muted-foreground border"
                        }`}
                      >
                        {formData.hasPhd ? "PhD" : "No PhD"}
                      </span>
                    )}
                  </div>
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
                  {isSaving ? "Saving..." : "Save Dean"}
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
                <p>Total Deans</p>
                <p className="text-2xl font-bold">{collegeDeans.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex gap-4">
              <Users className="h-5 w-5" />
              <div>
                <p>Visible Results</p>
                <p className="text-2xl font-bold">{filteredDeans.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Input
          placeholder="Search by name, email, college or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <Card>
          <CardHeader>
            <CardTitle>Deans</CardTitle>
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
                    <TableHead>College</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>PhD</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeans.map((dean) => (
                    <TableRow key={dean.id}>
                      <TableCell>{dean.name}</TableCell>
                      <TableCell>{dean.email}</TableCell>
                      <TableCell>{dean.college}</TableCell>
                      <TableCell>{dean.designation || "-"}</TableCell>
                      <TableCell>{dean.role}</TableCell>
                      <TableCell>{dean.level ?? "-"}</TableCell>
                      <TableCell>{dean.hasPhd ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(dean)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setDeanToDelete(dean)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredDeans.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        No dean data available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Excel Preview Dialog */}
        <Dialog
          open={isExcelDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsExcelDialogOpen(false);
              setExcelRows([]);
              if (xlsxInputRef.current) xlsxInputRef.current.value = "";
            }
          }}
        >
          <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Excel Upload Preview — Edit rows before uploading
              </DialogTitle>
            </DialogHeader>

            <div className="text-sm text-muted-foreground mb-2">
              <span className="text-green-600 font-medium">
                {excelRows.filter((r) => !r.error).length} valid
              </span>
              {" / "}
              <span className="text-destructive font-medium">
                {excelRows.filter((r) => r.error).length} invalid
              </span>
              {" rows. Fix any issues inline, then upload valid rows."}
            </div>

            <div className="overflow-auto flex-1 rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="min-w-[130px]">Name</TableHead>
                    <TableHead className="min-w-[170px]">Email</TableHead>
                    <TableHead className="min-w-[140px]">Password</TableHead>
                    <TableHead className="min-w-[170px]">Role *</TableHead>
                    <TableHead className="min-w-[180px]">Designation</TableHead>
                    <TableHead className="w-16">PhD</TableHead>
                    <TableHead className="min-w-[160px]">Issues</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {excelRows.map((row, idx) => (
                    <TableRow
                      key={idx}
                      className={
                        row.error
                          ? "bg-destructive/5"
                          : "bg-green-50/40 dark:bg-green-950/10"
                      }
                    >
                      <TableCell className="align-top pt-3">
                        {row.error ? (
                          <XCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                      </TableCell>

                      {/* Name */}
                      <TableCell>
                        <Input
                          className="h-8 text-xs"
                          value={row.name}
                          onChange={(e) =>
                            updateExcelRow(idx, { name: e.target.value })
                          }
                        />
                      </TableCell>

                      {/* Email */}
                      <TableCell>
                        <Input
                          className="h-8 text-xs"
                          value={row.email}
                          onChange={(e) =>
                            updateExcelRow(idx, { email: e.target.value })
                          }
                        />
                      </TableCell>

                      {/* Password */}
                      <TableCell>
                        <Input
                          className="h-8 text-xs"
                          type="password"
                          value={row.pass}
                          onChange={(e) =>
                            updateExcelRow(idx, { pass: e.target.value })
                          }
                          placeholder="≥6 chars"
                        />
                      </TableCell>

                      {/* Role — must match fetched roles */}
                      <TableCell>
                        <Select
                          value={
                            roleOptions.some(
                              (r) =>
                                r.name.trim().toLowerCase() ===
                                row.role.trim().toLowerCase(),
                            )
                              ? row.role
                              : ""
                          }
                          onValueChange={(val) =>
                            updateExcelRow(idx, { role: val })
                          }
                        >
                          <SelectTrigger
                            className={`h-8 text-xs ${
                              row.error?.includes("Role")
                                ? "border-destructive"
                                : ""
                            }`}
                          >
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((r) => (
                              <SelectItem key={r.id} value={r.name}>
                                {r.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Designation — must match fetched designations */}
                      <TableCell>
                        <Select
                          value={
                            designations.some(
                              (d) =>
                                d.name.trim().toLowerCase() ===
                                row.designation.trim().toLowerCase(),
                            )
                              ? row.designation
                              : ""
                          }
                          onValueChange={(val) =>
                            updateExcelRow(idx, { designation: val })
                          }
                        >
                          <SelectTrigger
                            className={`h-8 text-xs ${
                              row.error?.includes("Designation")
                                ? "border-destructive"
                                : ""
                            }`}
                          >
                            <SelectValue placeholder="Select designation" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from(
                              new Set(designations.map((d) => d.name)),
                            ).map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* PhD */}
                      <TableCell className="text-center align-top pt-3">
                        <input
                          type="checkbox"
                          checked={row.hasPhd}
                          onChange={(e) =>
                            updateExcelRow(idx, { hasPhd: e.target.checked })
                          }
                          className="h-4 w-4"
                        />
                      </TableCell>

                      {/* Issues */}
                      <TableCell className="text-destructive text-xs align-top pt-3">
                        {row.error || (
                          <span className="text-green-600">Ready</span>
                        )}
                      </TableCell>

                      {/* Delete row */}
                      <TableCell className="align-top pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteExcelRow(idx)}
                          disabled={isBulkUploading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-3 p-3 rounded-md bg-muted text-xs text-muted-foreground space-y-1">
              {roleOptions.length > 0 && (
                <p>
                  <strong>Valid roles:</strong>{" "}
                  {roleOptions.map((r) => r.name).join(", ")}
                </p>
              )}
              {designations.length > 0 && (
                <p>
                  <strong>Valid designations:</strong>{" "}
                  {Array.from(new Set(designations.map((d) => d.name))).join(
                    ", ",
                  )}
                </p>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsExcelDialogOpen(false);
                  setExcelRows([]);
                  if (xlsxInputRef.current) xlsxInputRef.current.value = "";
                }}
                disabled={isBulkUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkUpload}
                disabled={
                  isBulkUploading ||
                  excelRows.filter((r) => !r.error).length === 0
                }
              >
                {isBulkUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {excelRows.filter((r) => !r.error).length} Deans
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DeleteConfirmationDialog
          open={!!deanToDelete}
          onOpenChange={(open) => {
            if (!open && !isDeleting) setDeanToDelete(null);
          }}
          title="Delete dean?"
          description={`This will permanently delete ${deanToDelete?.name || "this dean"}.`}
          confirmText="Delete"
          isLoading={isDeleting}
          onConfirm={() => {
            if (deanToDelete) handleDelete(deanToDelete.id);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
