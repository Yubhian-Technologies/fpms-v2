import { useEffect, useMemo, useRef, useState } from "react";
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

interface Hod {
  id: string;
  name: string;
  email: string;
  department: string;
  designation?: string;
  college: string;
  role?: string;
  level?: number;
  hasPhd?: boolean;
  experience?: number;
  dateOfJoining?: string;
}

interface CollegeDetails {
  id?: string;
  name: string;
  code?: string;
  branches?: string[];
}

interface DesignationOption {
  name: string;
  target: string;
  phd: boolean;
}

export default function AddHod() {
  const [hods, setHods] = useState<Hod[]>([]);
  const [collegeDetails, setCollegeDetails] = useState<CollegeDetails | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingHod, setIsAddingHod] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hodToDelete, setHodToDelete] = useState<Hod | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hodRoleLevel, setHodRoleLevel] = useState(0);
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
      department: string;
      designation: string;
      hasPhd: boolean;
      error?: string;
    }>
  >([]);

  const fetchDesignations = async () => {
    try {
      const res = await api.get("/api/admin/designations");
      const payload = res.data?.data;

      const list: any[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.designations)
          ? payload.designations
          : [];

      const normalized: DesignationOption[] = list
        .map((item) => {
          if (typeof item === "string")
            return { name: item.trim(), target: "", phd: false };
          if (typeof item === "object" && item !== null)
            return {
              name: String(item.name || item.title || "").trim(),
              target: String(item.target || "").trim(),
              phd: Boolean(item.phd),
            };
          return null;
        })
        .filter((item): item is DesignationOption => !!item?.name);

      setDesignations(normalized);
    } catch (err) {
      console.error("Failed to fetch designations", err);
      setDesignations([]);
    }
  };

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
    college: "",
    designation: "",
    department: "",
    role: "hod",
    level: 0,
    hasPhd: false,
    dateOfJoining: "",
    experience: "",
  });

  const lockedCollegeName = collegeDetails?.name || "";
  const normalizedLockedCollege = String(lockedCollegeName || "")
    .trim()
    .toLowerCase();
  const branchOptions = useMemo(
    () =>
      Array.isArray(collegeDetails?.branches)
        ? collegeDetails!
            .branches!.map((item) => String(item || "").trim())
            .filter(Boolean)
        : [],
    [collegeDetails],
  );

  const occupiedDepartmentsForCollege = new Set(
    hods
      .filter((hod) => {
        const hodCollege = String(hod.college || "")
          .trim()
          .toLowerCase();
        return normalizedLockedCollege
          ? hodCollege === normalizedLockedCollege
          : true;
      })
      .map((hod) =>
        String(hod.department || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );

  const availableBranchOptions = branchOptions.filter((branch) => {
    const normalizedBranch = String(branch || "")
      .trim()
      .toLowerCase();
    if (!normalizedBranch) return false;

    if (editingId) {
      const currentDepartment = String(formData.department || "")
        .trim()
        .toLowerCase();
      return (
        !occupiedDepartmentsForCollege.has(normalizedBranch) ||
        normalizedBranch === currentDepartment
      );
    }

    return !occupiedDepartmentsForCollege.has(normalizedBranch);
  });

  const fetchHods = async () => {
    try {
      const res = await api.get("/api/admin/all-hods");
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      const normalized = data.map((item: any) => ({
        ...item,
        level:
          item.level !== undefined && Number.isFinite(Number(item.level))
            ? Number(item.level)
            : undefined,
        hasPhd: item.hasPhd ?? item.hasPhD ?? false,
        designation:
          item.designation && typeof item.designation === "object"
            ? item.designation.name || item.designation.title || ""
            : item.designation || "",
      }));
      setHods(normalized);
    } catch {
      toast({ title: "Failed to load HODs", variant: "destructive" });
    }
  };

  const fetchCollegeDetails = async () => {
    try {
      const res = await api.get("/api/admin/college-details");
      const data = res.data?.data || null;
      setCollegeDetails(data);
    } catch {
      toast({
        title: "Failed to load college details",
        variant: "destructive",
      });
    }
  };

  const fetchHodRoleOption = async () => {
    try {
      const res = await api.get("/api/admin/hod-role");
      const data = res.data?.data || {};
      const resolvedLevel = Number(data.level);
      const nextLevel = Number.isFinite(resolvedLevel) ? resolvedLevel : 0;
      setHodRoleLevel(nextLevel);
    } catch {
      setHodRoleLevel(0);
      toast({ title: "Failed to load HOD role", variant: "destructive" });
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        await Promise.all([
          fetchHods(),
          fetchCollegeDetails(),
          fetchHodRoleOption(),
          fetchDesignations(),
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
      pass: "",
      confirm_pass: "",
      college: lockedCollegeName,
      designation: designations[0]?.name || "",
      department: availableBranchOptions[0] || "",
      role: "hod",
      level: hodRoleLevel,
      hasPhd: designations[0]?.phd ?? false,
      dateOfJoining: "",
      experience: "",
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setEditingId(null);
  };

  const startNewHod = () => {
    resetForm();
    setIsAddingHod(true);
  };

  const cancelForm = () => {
    setIsAddingHod(false);
    resetForm();
  };

  const openEdit = (hod: Hod) => {
    const rawDesignation =
      typeof hod.designation === "string"
        ? hod.designation
        : (hod.designation as any)?.name ||
          (hod.designation as any)?.title ||
          "";
    const storedHasPhd = !!hod.hasPhd;
    // Prefer exact match; fall back to same-name match (handles old data without phd field)
    const exactMatch = designations.find(
      (d) => d.name === rawDesignation && d.phd === storedHasPhd,
    );
    const nameMatch =
      exactMatch ?? designations.find((d) => d.name === rawDesignation);
    const resolvedDesignation =
      nameMatch?.name ?? rawDesignation ?? designations[0]?.name ?? "";
    const resolvedHasPhd = exactMatch
      ? storedHasPhd
      : (nameMatch?.phd ?? storedHasPhd);

    const joiningDate = hod.dateOfJoining || "";
    setFormData({
      name: hod.name,
      email: hod.email,
      pass: "",
      confirm_pass: "",
      college: lockedCollegeName || hod.college,
      department: hod.department || "",
      designation: resolvedDesignation,
      role: "hod",
      level:
        hod.level !== undefined && Number.isFinite(Number(hod.level))
          ? Number(hod.level)
          : hodRoleLevel,
      hasPhd: resolvedHasPhd,
      dateOfJoining: joiningDate,
      experience: joiningDate
        ? String(calculateExperience(joiningDate))
        : hod.experience !== undefined
          ? String(hod.experience)
          : "",
    });
    setEditingId(hod.id);
    setIsAddingHod(true);
  };

  const handleSave = async () => {
    const resolvedCollege = lockedCollegeName || formData.college;

    if (
      !formData.name ||
      !formData.email ||
      !resolvedCollege ||
      !formData.department ||
      !Number.isFinite(formData.level)
    ) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }

    const selectedDepartment = String(formData.department || "")
      .trim()
      .toLowerCase();
    const isSelectedDepartmentAvailable = availableBranchOptions.some(
      (branch) =>
        String(branch || "")
          .trim()
          .toLowerCase() === selectedDepartment,
    );

    if (!isSelectedDepartmentAvailable) {
      toast({
        title: "Branch not available",
        description: "Selected branch already has an HOD.",
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
        designation: formData.designation,
        department: formData.department,
        role: "hod",
        level: Number(formData.level),
        hasPhd: formData.hasPhd,
        dateOfJoining: formData.dateOfJoining || undefined,
        experience:
          formData.experience !== "" ? Number(formData.experience) : undefined,
      };

      if (editingId) {
        await api.put(`/api/admin/update/${editingId}`, payload);
        toast({ title: "HOD updated successfully" });
      } else {
        await api.post("/api/admin/add-hod", payload);
        toast({ title: "HOD added successfully" });
      }

      await fetchHods();
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
    currentBranches: string[],
    currentDesignations: DesignationOption[],
    occupiedDepts: Set<string>,
  ): string => {
    let error = "";
    if (!row.name.trim()) error += "Name missing. ";
    if (!row.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email))
      error += "Valid email required. ";
    if (!row.pass || row.pass.length < 6)
      error += "Password must be ≥6 chars. ";
    if (!row.department.trim()) {
      error += "Department missing. ";
    } else {
      const normalizedDept = row.department.trim().toLowerCase();
      const deptValid = currentBranches.some(
        (b) => b.trim().toLowerCase() === normalizedDept,
      );
      if (!deptValid) error += "Department not in college branches. ";
      else if (occupiedDepts.has(normalizedDept))
        error += "Department already has an HOD. ";
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
        branchOptions,
        designations,
        occupiedDepartmentsForCollege,
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
          const department = String(
            row["department"] ?? row["Department"] ?? "",
          ).trim();
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

          let error = "";
          if (!name) error += "Name missing. ";
          if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
            error += "Valid email required. ";
          if (!pass || pass.length < 6) error += "Password must be ≥6 chars. ";
          if (!department) error += "Department missing. ";

          const base = { name, email, pass, department, designation, hasPhd };
          return {
            ...base,
            error: validateExcelRow(
              base,
              branchOptions,
              designations,
              occupiedDepartmentsForCollege,
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

        // Check for duplicate emails / departments against existing HODs
        const existingEmails = new Set(
          hods.map((h) => h.email.trim().toLowerCase()),
        );
        const existingDepts = new Set(
          hods
            .filter((h) =>
              normalizedLockedCollege
                ? String(h.college || "")
                    .trim()
                    .toLowerCase() === normalizedLockedCollege
                : true,
            )
            .map((h) =>
              String(h.department || "")
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean),
        );
        // Track duplicates within the Excel file itself
        const seenEmailsInFile = new Set<string>();
        const seenDeptsInFile = new Set<string>();
        const finalParsed = parsed.map((row) => {
          const emailKey = row.email.trim().toLowerCase();
          const deptKey = row.department.trim().toLowerCase();
          let extraError = "";

          // Email checks
          if (emailKey && existingEmails.has(emailKey)) {
            extraError += "Email already exists in the system. ";
          } else if (emailKey && seenEmailsInFile.has(emailKey)) {
            extraError += "Duplicate email in this file. ";
          }
          if (emailKey) seenEmailsInFile.add(emailKey);

          // Department checks (only if dept is otherwise valid — no point double-reporting)
          if (deptKey && !row.error?.includes("Department not in college")) {
            if (existingDepts.has(deptKey)) {
              extraError += "Department already has an HOD. ";
            } else if (seenDeptsInFile.has(deptKey)) {
              extraError += "Duplicate department in this file. ";
            }
          }
          if (deptKey) seenDeptsInFile.add(deptKey);

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
      try {
        await api.post("/api/admin/add-hod", {
          name: row.name,
          email: row.email,
          pass: row.pass,
          confirm_pass: row.pass,
          college: lockedCollegeName,
          department: row.department,
          designation: row.designation || designations[0]?.name || "",
          role: "hod",
          level: hodRoleLevel,
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
    await fetchHods();

    toast({
      title: "Bulk upload complete",
      description: `${successCount} added${failCount > 0 ? `, ${failCount} failed` : ""}.`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      await api.delete(`/api/admin/delete/${id}`);
      toast({ title: "HOD deleted" });
      await fetchHods();
      setHodToDelete(null);
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const collegeHods = hods.filter((hod) => {
    if (!normalizedLockedCollege) return true;
    return (
      String(hod.college || "")
        .trim()
        .toLowerCase() === normalizedLockedCollege
    );
  });

  const filteredHods = collegeHods.filter((hod) => {
    const q = searchQuery.toLowerCase();
    return (
      hod.name.toLowerCase().includes(q) ||
      hod.email.toLowerCase().includes(q) ||
      hod.department.toLowerCase().includes(q) ||
      hod.college.toLowerCase().includes(q)
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
    setFormData((prev) => {
      if (Number(prev.level) === Number(hodRoleLevel)) return prev;
      return {
        ...prev,
        level: Number(hodRoleLevel),
      };
    });
  }, [hodRoleLevel]);

  useEffect(() => {
    if (!isAddingHod) return;

    const selectedDepartment = String(formData.department || "")
      .trim()
      .toLowerCase();
    const hasSelectedDepartment = availableBranchOptions.some(
      (branch) =>
        String(branch || "")
          .trim()
          .toLowerCase() === selectedDepartment,
    );

    if (hasSelectedDepartment) return;

    setFormData((prev) => ({
      ...prev,
      department: availableBranchOptions[0] || "",
    }));
  }, [availableBranchOptions, formData.department, isAddingHod]);

  return (
    <DashboardLayout title="Add HOD" subtitle="Manage HODs by department">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">HOD Management</h1>
            <p className="text-muted-foreground">Add and manage HODs</p>
          </div>
          {!isAddingHod && (
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
                  downloadDemoExcel("hod_template.xlsx", excelHeaders.hod)
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
              <Button onClick={startNewHod}>
                <Plus className="mr-2 h-4 w-4" /> Add HOD
              </Button>
            </div>
          )}
        </div>

        {isAddingHod && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle>{editingId ? "Edit HOD" : "Add HOD"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="Enter HOD name"
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
                    placeholder="hod@example.com"
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
                  <Label>Dept / Branch *</Label>
                  <Select
                    value={formData.department}
                    onValueChange={(value) =>
                      setFormData({ ...formData, department: value })
                    }
                    disabled={!availableBranchOptions.length}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          availableBranchOptions.length
                            ? "Select branch"
                            : "No branches available for this college"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBranchOptions.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
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
                    disabled={designations.length === 0}
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
                  <Label>Role *</Label>
                  <Input value="hod" disabled />
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
                  {isSaving ? "Saving..." : "Save HOD"}
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
                <p>Total HODs</p>
                <p className="text-2xl font-bold">{collegeHods.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex gap-4">
              <Users className="h-5 w-5" />
              <div>
                <p>Visible Results</p>
                <p className="text-2xl font-bold">{filteredHods.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Input
          placeholder="Search by name, email, department or college..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <Card>
          <CardHeader>
            <CardTitle>HODs</CardTitle>
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
                    <TableHead>Dept / Branch</TableHead>
                    <TableHead>College</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>PhD</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHods.map((hod) => (
                    <TableRow key={hod.id}>
                      <TableCell>{hod.name}</TableCell>
                      <TableCell>{hod.email}</TableCell>
                      <TableCell>{hod.department || "-"}</TableCell>
                      <TableCell>{hod.college}</TableCell>
                      <TableCell>{hod.designation || "-"}</TableCell>
                      <TableCell>{hod.role || "hod"}</TableCell>
                      <TableCell>{hod.level ?? "-"}</TableCell>
                      <TableCell>{hod.hasPhd ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(hod)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setHodToDelete(hod)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredHods.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-8"
                      >
                        No HOD data available.
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
                    <TableHead className="min-w-[170px]">
                      Dept/Branch *
                    </TableHead>
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

                      {/* Department — must match fetched branches & not be occupied */}
                      <TableCell>
                        <Select
                          value={
                            branchOptions.some(
                              (b) =>
                                b.trim().toLowerCase() ===
                                row.department.trim().toLowerCase(),
                            )
                              ? row.department
                              : ""
                          }
                          onValueChange={(val) =>
                            updateExcelRow(idx, { department: val })
                          }
                        >
                          <SelectTrigger
                            className={`h-8 text-xs ${
                              row.error?.includes("Department") ||
                              row.error?.includes("HOD")
                                ? "border-destructive"
                                : ""
                            }`}
                          >
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branchOptions.map((b) => {
                              const isOccupied =
                                occupiedDepartmentsForCollege.has(
                                  b.trim().toLowerCase(),
                                );
                              return (
                                <SelectItem
                                  key={b}
                                  value={b}
                                  disabled={isOccupied}
                                >
                                  {b}
                                  {isOccupied ? " (occupied)" : ""}
                                </SelectItem>
                              );
                            })}
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
              {branchOptions.length > 0 && (
                <p>
                  <strong>Valid branches:</strong> {branchOptions.join(", ")}
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
                    Upload {excelRows.filter((r) => !r.error).length} HODs
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DeleteConfirmationDialog
          open={!!hodToDelete}
          onOpenChange={(open) => {
            if (!open && !isDeleting) setHodToDelete(null);
          }}
          title="Delete HOD?"
          description={`This will permanently delete ${hodToDelete?.name || "this HOD"}.`}
          confirmText="Delete"
          isLoading={isDeleting}
          onConfirm={() => {
            if (hodToDelete) handleDelete(hodToDelete.id);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
