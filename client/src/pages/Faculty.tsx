import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Download,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import { downloadDemoExcel, excelHeaders } from "@/lib/excelUtils";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import LOGO from "@/assets/LOGO.png";

type StaffStatus = "active" | "inactive" | "long-leave" | "maternity-leave" | "recently-joined" | "retainership" | "other";

const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  "active": "Active",
  "inactive": "Inactive",
  "long-leave": "Long Leave",
  "maternity-leave": "Maternity Leave",
  "recently-joined": "Recently Joined",
  "retainership": "Retainership",
  "other": "Other",
};

interface FacultyMember {
  id: string;
  name: string;
  email: string;
  role: string;
  level?: number;
  department: string;
  college: string;
  designation: string;
  experience: number;
  externalExperience?: number;
  overallExperience?: number;
  dateOfJoining?: string;
  hasPhd: boolean;
  isActive: boolean;
  staffStatus?: StaffStatus;
  statusNote?: string;
  subjectsHandled?: string[];
}

interface DesignationOption {
  name: string;
  target: string;
  phd: boolean;
}

interface CollegeDetails {
  id?: string;
  name: string;
  code?: string;
  branches?: string[];
}

export default function Faculty() {
  const { user } = useAuth();
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [designations, setDesignations] = useState<DesignationOption[]>([]);
  const [collegeDetails, setCollegeDetails] = useState<CollegeDetails | null>(
    null,
  );
  const [facultyRoleLevel, setFacultyRoleLevel] = useState(0);

  const [isAddingFaculty, setIsAddingFaculty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [facultyToDelete, setFacultyToDelete] = useState<FacultyMember | null>(
    null,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      experience: number;
      hasPhd: boolean;
      status: string;
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
    college: "",
    department: "",
    designation: "",
    role: "faculty",
    level: 0,
    dateOfJoining: "",
    experience: "0",
    status: "active" as StaffStatus,
    statusNote: "",
    hasPhd: false,
    subjectsHandled: [] as string[],
    subjectInput: "",
    externalExperience: "",
    overallExperience: "",
  });

  const lockedCollegeName = collegeDetails?.name || "";
  const lockedDepartment = user?.department || "";
  const normalizedLockedCollege = String(lockedCollegeName)
    .trim()
    .toLowerCase();
  const normalizedLockedDepartment = String(lockedDepartment)
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

  const fetchFaculty = async () => {
    const res = await api.get("/api/hod/all-faculty");
    const data = Array.isArray(res.data?.data) ? res.data.data : [];
    const normalized = data.map((item: any) => ({
      id: item.id,
      name: String(item.name || ""),
      email: String(item.email || ""),
      role: String(item.role || "faculty"),
      level:
        item.level !== undefined && Number.isFinite(Number(item.level))
          ? Number(item.level)
          : undefined,
      department: String(item.department || ""),
      college: String(item.college || ""),
      designation: String(item.designation || ""),
      experience: Number(item.experience || 0),
      hasPhd: Boolean(item.hasPhd ?? item.hasPhD ?? false),
      isActive: Boolean(item.isActive ?? true),
      staffStatus: (item.staffStatus as StaffStatus) || undefined,
      statusNote: item.statusNote || undefined,
    }));

    setFaculty(normalized);
  };

  const fetchCollegeDetails = async () => {
    const res = await api.get("/api/hod/college-details");
    setCollegeDetails(res.data?.data || null);
  };

  const fetchDesignations = async () => {
    try {
      const res = await api.get("/api/colleges/designations");
      const payload = res.data?.data;
      const designationList = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.designations)
          ? payload.designations
          : [];

      const normalized: DesignationOption[] = designationList
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

      setDesignations(normalized);
    } catch (error) {
      console.error("[Faculty] Failed to fetch designations:", error);
      setDesignations([]);
    }
  };

  const fetchFacultyRole = async () => {
    try {
      const res = await api.get("/api/hod/faculty-role");
      console.log("[Faculty] Faculty role response:", res.data);

      const data = res.data?.data || {};
      const resolvedLevel = Number(data.level);
      console.log("[Faculty] Faculty level:", resolvedLevel);
      setFacultyRoleLevel(Number.isFinite(resolvedLevel) ? resolvedLevel : 0);
    } catch (error) {
      console.error("[Faculty] Failed to fetch faculty role:", error);
      setFacultyRoleLevel(0);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        await Promise.all([
          fetchFaculty(),
          fetchCollegeDetails(),
          fetchDesignations(),
          fetchFacultyRole(),
        ]);
      } catch {
        toast({ title: "Failed to load faculty data", variant: "destructive" });
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
      department: lockedDepartment || branchOptions[0] || "",
      designation: designations[0]?.name || "",
      role: "faculty",
      level: facultyRoleLevel,
      dateOfJoining: "",
      experience: "0",
      status: "active",
      hasPhd: designations[0]?.phd ?? false,
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setEditingId(null);
  };

  const startNewFaculty = () => {
    resetForm();
    setIsAddingFaculty(true);
  };

  const cancelForm = () => {
    setIsAddingFaculty(false);
    resetForm();
  };

  const openEdit = (member: FacultyMember) => {
    const rawDesignation = member.designation || "";
    const storedHasPhd = !!member.hasPhd;
    const exactMatch = designations.find(
      (d) => d.name === rawDesignation && d.phd === storedHasPhd,
    );
    const nameMatch =
      exactMatch ?? designations.find((d) => d.name === rawDesignation);
    const resolvedDesignation = nameMatch?.name ?? rawDesignation;
    const resolvedHasPhd = exactMatch
      ? storedHasPhd
      : (nameMatch?.phd ?? storedHasPhd);

    const joiningDate = member.dateOfJoining || "";
    setFormData({
      name: member.name,
      email: member.email,
      pass: "",
      confirm_pass: "",
      college: lockedCollegeName || member.college,
      department: lockedDepartment || member.department,
      designation: resolvedDesignation,
      role: "faculty",
      level:
        member.level !== undefined && Number.isFinite(Number(member.level))
          ? Number(member.level)
          : facultyRoleLevel,
      dateOfJoining: joiningDate,
      experience: joiningDate
        ? String(calculateExperience(joiningDate))
        : String(member.experience || 0),
      status: member.staffStatus || (member.isActive ? "active" : "inactive"),
      statusNote: member.statusNote || "",
      hasPhd: resolvedHasPhd,
      subjectsHandled: member.subjectsHandled || [],
      subjectInput: "",
      externalExperience: member.externalExperience != null ? String(member.externalExperience) : "",
      overallExperience: "",
    });
    setEditingId(member.id);
    setIsAddingFaculty(true);
  };

  const handleSave = async () => {
    const resolvedCollege = lockedCollegeName || formData.college;

    if (
      !formData.name ||
      !formData.email ||
      !resolvedCollege ||
      !formData.department ||
      !formData.designation ||
      !Number.isFinite(Number(formData.level))
    ) {
      toast({ title: "Fill all required fields", variant: "destructive" });
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
        department: formData.department,
        designation: formData.designation,
        role: "faculty",
        level: Number(formData.level),
        dateOfJoining: formData.dateOfJoining || undefined,
        experience: Number(formData.experience || 0),
        isActive: formData.status === "active" || formData.status === "recently-joined",
        staffStatus: formData.status,
        statusNote: formData.status === "other" ? formData.statusNote : undefined,
        hasPhd: formData.hasPhd,
        subjectsHandled: formData.subjectsHandled,
        externalExperience: formData.externalExperience !== "" ? Number(formData.externalExperience) : undefined,
        overallExperience: (() => {
          const internal = Number(formData.experience || 0);
          const external = formData.externalExperience !== "" ? Number(formData.externalExperience) : 0;
          return internal + external;
        })(),
      };

      if (editingId) {
        await api.put(`/api/hod/update-faculty/${editingId}`, payload);
        toast({ title: "Faculty updated successfully" });
      } else {
        await api.post("/api/hod/add-faculty", payload);
        toast({ title: "Faculty added successfully" });
      }

      await fetchFaculty();
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
          // Department is always taken from the HOD's own department — not from the Excel row
          const department = lockedDepartment;
          const designation = String(
            row["designation"] ?? row["Designation"] ?? "",
          ).trim();
          const experience = Number(
            row["experience"] ?? row["Experience"] ?? 0,
          );
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
          const statusRaw = String(row["status"] ?? row["Status"] ?? "active")
            .trim()
            .toLowerCase();
          const status = statusRaw === "inactive" ? "inactive" : "active";

          const validDesignationNames = designations.map((d) =>
            d.name.trim().toLowerCase(),
          );

          let error = "";
          if (!name) error += "Name missing. ";
          if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
            error += "Valid email required. ";
          if (!pass || pass.length < 6) error += "Password must be ≥6 chars. ";
          if (!designation) {
            error += "Designation missing. ";
          } else if (!validDesignationNames.includes(designation.toLowerCase())) {
            const validList = designations.map((d) => d.name).join(", ");
            error += `Designation "${designation}" is not valid. Valid: ${validList}. `;
          }

          return {
            name,
            email,
            pass,
            department,
            designation,
            experience,
            hasPhd,
            status,
            error: error.trim(),
          };
        });

        // Check for duplicate emails against existing faculty
        const existingEmails = new Set(
          faculty.map((f) => f.email.trim().toLowerCase()),
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

        if (finalParsed.length === 0) {
          toast({
            title: "No rows found in the Excel file",
            variant: "destructive",
          });
          return;
        }

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
        await api.post("/api/hod/add-faculty", {
          name: row.name,
          email: row.email,
          pass: row.pass,
          confirm_pass: row.pass,
          college: lockedCollegeName,
          department: row.department || lockedDepartment,
          designation: row.designation,
          role: "faculty",
          level: facultyRoleLevel,
          experience: row.experience,
          isActive: row.status === "active",
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
    await fetchFaculty();

    toast({
      title: `Bulk upload complete`,
      description: `${successCount} added${failCount > 0 ? `, ${failCount} failed` : ""}.`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  const handleExportReport = async () => {
    try {
      const res = await api.get("/api/hod/export-report");
      const reportData: Array<{ name: string; subs: any[] }> = res.data?.data || [];

      const rows: any[][] = [];
      const headers = [
        "S.No",
        "Name of the Faculty",
        "Modules",
        "Sub Modules",
        "Tasks",
        "Points",
        "Points Claimed",
        "Points given by Reviewer",
        "Appeal Points",
        "Final Points",
        "Total Points",
      ];
      rows.push(headers);

      const merges: XLSX.Range[] = [];
      const addMerge = (c: number, r1: number, r2: number) => {
        if (r2 > r1) merges.push({ s: { r: r1, c }, e: { r: r2, c } });
      };

      let sno = 1;
      for (const faculty of reportData) {
        if (faculty.subs.length === 0) {
          rows.push([sno++, faculty.name, "-", "-", "-", "-", "-", "-", "-", "-"]);
          continue;
        }

        const totalFinal = faculty.subs.reduce(
          (sum, s) => sum + Number(s.finalScore ?? 0),
          0,
        );

        // Collect ALL subs per criteriaName (preserving first-seen order)
        const criteriaMap = new Map<string, any[]>();
        for (const sub of faculty.subs) {
          const key = sub.criteriaName || sub.formTitle || "-";
          if (!criteriaMap.has(key)) criteriaMap.set(key, []);
          criteriaMap.get(key)!.push(sub);
        }
        const criteriaGroups = Array.from(criteriaMap.entries()).map(
          ([key, subs]) => ({ key, subs }),
        );

        const facultyRowStart = rows.length;
        let isFirstFacultyRow = true;

        criteriaGroups.forEach(({ key, subs }) => {
          const criteriaRowStart = rows.length;

          // Sub-group by moduleName within this criteria
          const subModuleMap = new Map<string, any[]>();
          for (const sub of subs) {
            const smKey = sub.moduleName || "-";
            if (!subModuleMap.has(smKey)) subModuleMap.set(smKey, []);
            subModuleMap.get(smKey)!.push(sub);
          }

          let isFirstInCriteria = true;
          for (const [smKey, smSubs] of subModuleMap) {
            const subModuleRowStart = rows.length;
            smSubs.forEach((sub, smIdx) => {
              const isLast = sub === faculty.subs[faculty.subs.length - 1];
              rows.push([
                isFirstFacultyRow ? sno : "",
                isFirstFacultyRow ? faculty.name : "",
                isFirstInCriteria ? key : "",
                smIdx === 0 ? smKey : "",
                sub.taskName || "-",
                sub.maxMarks ?? "-",
                sub.claimedScore ?? "-",
                sub.reviewerScore ?? "-",
                sub.appealerScore ?? "-",
                sub.finalScore ?? "-",
                isLast ? totalFinal : "",
              ]);
              isFirstFacultyRow = false;
              isFirstInCriteria = false;
            });
            // Merge col D for this sub-module group
            addMerge(3, subModuleRowStart, rows.length - 1);
          }

          // Merge col C for this criteria group
          addMerge(2, criteriaRowStart, rows.length - 1);
        });

        // Merge col A (S.No) and col B (name) for this faculty
        addMerge(0, facultyRowStart, rows.length - 1);
        addMerge(1, facultyRowStart, rows.length - 1);
        sno++;
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!merges"] = merges;

      // Column widths
      ws["!cols"] = [
        { wch: 6 }, { wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 35 }, { wch: 8 },
        { wch: 15 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Faculty Report");
      XLSX.writeFile(wb, "faculty_report.xlsx");
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      await api.delete(`/api/hod/delete-faculty/${id}`);
      toast({ title: "Faculty deleted" });
      await fetchFaculty();
      setFacultyToDelete(null);
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const generateFacultyPDF = async (facultyId: string) => {
    try {
      const res = await api.get(`/api/hod/faculty-pdf-data/${facultyId}`);
      const { faculty, hodName, principalName, submissions } = res.data.data;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const PW = doc.internal.pageSize.getWidth();   // 210
      const ML = 14; const MR = 14;
      const usableW = PW - ML - MR;
      const academicYear = "2025 – 2026";

      // ── HEADER ──
      // Logo
      try { doc.addImage(LOGO, "PNG", ML, 6, 18, 18); } catch { /* skip if load fails */ }

      // Title block (centered)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(0, 82, 165);
      doc.text(String(faculty.college || "VISHNU INSTITUTE OF TECHNOLOGY").toUpperCase(), PW / 2, 12, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(faculty.department || "Department", PW / 2, 18, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text("FACULTY PERFORMANCE MANAGEMENT SYSTEM", PW / 2, 24, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(60, 60, 60);
      doc.text(`Academic Year: ${academicYear}`, PW / 2, 30, { align: "center" });

      // Divider
      doc.setDrawColor(0, 82, 165);
      doc.setLineWidth(0.5);
      doc.line(ML, 33, PW - MR, 33);

      // ── FACULTY INFO TABLE ──
      const doj = faculty.dateOfJoining
        ? new Date(faculty.dateOfJoining).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : "—";
      const expStr = faculty.experience != null ? `${faculty.experience} yrs (Internal)` : "—";
      const overallExpStr = faculty.overallExperience != null ? ` / ${faculty.overallExperience} yrs (Overall)` : "";
      const subjectsStr = faculty.subjectsHandled?.length ? faculty.subjectsHandled.join(", ") : "—";

      const infoRows = [
        ["Name of the Faculty:", faculty.name || "—", "Date of Joining:", doj],
        ["Designation:", faculty.designation || "—", "Phone:", faculty.phone || "—"],
        ["Email:", faculty.email || "—", "Target Score:", faculty.targetScore ? String(faculty.targetScore) : "—"],
        ["Subjects Handled (incl. labs):", { content: subjectsStr, colSpan: 3 } as any, "", ""],
        ["Experience:", { content: expStr + overallExpStr, colSpan: 3 } as any, "", ""],
      ];

      autoTable(doc, {
        body: infoRows.map((row) => row.filter((_, i) => i < 4)),
        startY: 36,
        margin: { left: ML, right: MR },
        tableWidth: usableW,
        styles: { fontSize: 8.5, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.2 },
        columnStyles: {
          0: { fontStyle: "bold", fillColor: [240, 245, 255], cellWidth: 46 },
          1: { cellWidth: 52 },
          2: { fontStyle: "bold", fillColor: [240, 245, 255], cellWidth: 36 },
          3: { cellWidth: usableW - 46 - 52 - 36 },
        },
        theme: "grid",
      });

      // ── SUBMISSIONS TABLE ──
      const startY = (doc as any).lastAutoTable.finalY + 5;

      const tableRows: any[] = [];
      // parallel merge-flag array: tracks which cols should visually merge with row above
      const mergeFlags: Array<{ criteria: boolean; module: boolean }> = [];
      let sno = 1;
      let totalFinal = 0;

      // Group by criteriaName
      const criteriaGroups: Record<string, typeof submissions> = {};
      for (const sub of submissions) {
        const key = sub.criteriaName || "Uncategorized";
        if (!criteriaGroups[key]) criteriaGroups[key] = [];
        criteriaGroups[key].push(sub);
      }

      for (const [criteriaName, subs] of Object.entries(criteriaGroups)) {
        const criteriaTotal = subs.reduce((s, sub) => s + (sub.finalScore != null ? sub.finalScore : 0), 0);
        totalFinal += criteriaTotal;

        // group by moduleName within criteria
        const moduleGroups: Record<string, typeof subs> = {};
        for (const sub of subs) {
          const mk = sub.moduleName || "—";
          if (!moduleGroups[mk]) moduleGroups[mk] = [];
          moduleGroups[mk].push(sub);
        }

        let criteriaFirstRow = true;
        for (const [moduleName, msubs] of Object.entries(moduleGroups)) {
          let moduleFirstRow = true;
          for (const sub of msubs) {
            const isLastOfCriteria = !criteriaFirstRow && subs.indexOf(sub) === subs.length - 1;
            const isLastCriteria = sub === subs[subs.length - 1];
            tableRows.push([
              sno++,
              criteriaName,
              moduleName,
              sub.taskName || "—",
              sub.maxMarks != null ? sub.maxMarks : "—",
              sub.claimedScore != null ? sub.claimedScore : "—",
              sub.reviewerScore != null ? sub.reviewerScore : "—",
              sub.appealerScore != null ? sub.appealerScore : "—",
              sub.finalScore != null ? sub.finalScore : "—",
              isLastCriteria ? criteriaTotal : "",
            ]);
            mergeFlags.push({
              criteria: !criteriaFirstRow,
              module: !moduleFirstRow,
            });
            criteriaFirstRow = false;
            moduleFirstRow = false;
          }
        }
      }

      if (tableRows.length === 0) {
        tableRows.push(["—", "No submissions found", "", "", "", "", "", "", "", ""]);
        mergeFlags.push({ criteria: false, module: false });
      }

      const BORDER_COLOR: [number, number, number] = [180, 180, 180];
      const BW = 0.2;

      autoTable(doc, {
        head: [[
          "S.No", "Criteria\nName", "Modules", "Sub\nModules",
          "Actual\nScore", "Claimed\nScore", "Reviewer\nScore",
          "Appeal\nScore", "Final\nScore", "Total Score\nper Criteria",
        ]],
        body: tableRows,
        startY,
        margin: { left: ML, right: MR },
        tableWidth: usableW,
        styles: { fontSize: 7.5, cellPadding: 1.8, overflow: "linebreak", lineColor: BORDER_COLOR, lineWidth: BW },
        headStyles: { fillColor: [0, 31, 63], textColor: 255, fontStyle: "bold", fontSize: 7.5, halign: "center" },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 35 },
          2: { cellWidth: 28 },
          3: { cellWidth: 28 },
          4: { cellWidth: 14, halign: "center" },
          5: { cellWidth: 14, halign: "center" },
          6: { cellWidth: 14, halign: "center" },
          7: { cellWidth: 14, halign: "center" },
          8: { cellWidth: 14, halign: "center" },
          9: { cellWidth: usableW - 10 - 35 - 28 - 28 - 14 * 5, halign: "center" },
        },
        theme: "grid",
        didParseCell: (data) => {
          if (data.section !== "body") return;
          const ri = data.row.index;
          const ci = data.column.index;
          const flags = mergeFlags[ri];
          if (!flags) return;
          // Blank out repeated criteria/module cells
          if (flags.criteria && ci === 1) data.cell.text = [];
          if (flags.module && ci === 2) data.cell.text = [];
        },
        didDrawCell: (data) => {
          if (data.section !== "body") return;
          const ri = data.row.index;
          const ci = data.column.index;
          const flags = mergeFlags[ri];
          if (!flags) return;
          // Erase top border to make cell appear merged with row above
          if ((flags.criteria && ci === 1) || (flags.module && ci === 2)) {
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(BW + 0.1);
            doc.line(data.cell.x + BW, data.cell.y, data.cell.x + data.cell.width - BW, data.cell.y);
            doc.setDrawColor(...BORDER_COLOR);
            doc.setLineWidth(BW);
          }
        },
      });

      // ── TOTAL SCORE ──
      const afterTable = (doc as any).lastAutoTable.finalY + 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const targetScore = faculty.targetScore || 0;
      const totalPct = targetScore > 0 ? ` (${Math.round((totalFinal / targetScore) * 100)}% of target)` : "";
      doc.text(`Total Score: ${totalFinal} / ${targetScore}${totalPct}`, PW - MR, afterTable, { align: "right" });

      // ── SIGNATURES ──
      const sigY = afterTable + 20;
      const sigBoxW = 52;
      const sigBoxH = 28;
      const positions = [
        { x: ML, label: "Submitted and Accepted By", role: "Faculty", name: faculty.name || "" },
        { x: PW / 2 - sigBoxW / 2, label: "Verified and Forwarded By", role: "HoD", name: hodName },
        { x: PW - MR - sigBoxW, label: "Approved By", role: "Principal", name: principalName || "Principal" },
      ];

      doc.setFontSize(8);
      positions.forEach(({ x, label, role, name }) => {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.text(label, x + sigBoxW / 2, sigY - 3, { align: "center" });

        doc.setDrawColor(180, 180, 180);
        doc.setFillColor(250, 250, 252);
        doc.roundedRect(x, sigY, sigBoxW, sigBoxH, 1, 1, "FD");

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text("Signature:", x + 3, sigY + 9);
        doc.setDrawColor(160, 160, 160);
        doc.line(x + 22, sigY + 9, x + sigBoxW - 3, sigY + 9);

        doc.text("Name:", x + 3, sigY + 17);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        const nameLines = doc.splitTextToSize(name, sigBoxW - 22);
        doc.text(nameLines[0] || "—", x + 22, sigY + 17);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text("Role:", x + 3, sigY + 24);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 31, 63);
        doc.text(role, x + 22, sigY + 24);
      });

      doc.setTextColor(0, 0, 0);
      const safeName = (faculty.name || "faculty").replace(/[/\\?*[\]:]/g, "-");
      doc.save(`${safeName}-FPMS-Report.pdf`);
    } catch {
      toast({ title: "PDF generation failed", variant: "destructive" });
    }
  };

  const collegeDeptFaculty = faculty.filter((member) => {
    const memberCollege = String(member.college || "")
      .trim()
      .toLowerCase();
    const memberDept = String(member.department || "")
      .trim()
      .toLowerCase();
    const collegeMatch = normalizedLockedCollege
      ? memberCollege === normalizedLockedCollege
      : true;
    const deptMatch = normalizedLockedDepartment
      ? memberDept === normalizedLockedDepartment
      : true;
    return collegeMatch && deptMatch;
  });

  const filteredFaculty = collegeDeptFaculty.filter((member) => {
    const query = searchQuery.toLowerCase();
    return (
      member.name.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query) ||
      member.department.toLowerCase().includes(query) ||
      member.designation.toLowerCase().includes(query)
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
      if (Number(prev.level) === Number(facultyRoleLevel)) return prev;
      return {
        ...prev,
        level: Number(facultyRoleLevel),
      };
    });
  }, [facultyRoleLevel]);

  useEffect(() => {
    if (!isAddingFaculty) return;

    if (
      !formData.department &&
      (lockedDepartment || branchOptions.length > 0)
    ) {
      setFormData((prev) => ({
        ...prev,
        department: lockedDepartment || branchOptions[0],
      }));
    }

    if (!formData.designation && designations.length > 0) {
      setFormData((prev) => ({
        ...prev,
        designation: designations[0].name,
        hasPhd: designations[0].phd,
      }));
    }
  }, [
    branchOptions,
    designations,
    formData.department,
    formData.designation,
    isAddingFaculty,
  ]);

  return (
    <DashboardLayout title="Faculty" subtitle="Manage faculty users">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">
              Faculty Management
            </h1>
            <p className="text-muted-foreground">
              Add and manage faculty for your college
            </p>
          </div>
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
                downloadDemoExcel("faculty_template.xlsx", excelHeaders.faculty)
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
            <Button variant="outline" onClick={handleExportReport}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Report
            </Button>
            <Button onClick={startNewFaculty}>
              <Plus className="mr-2 h-4 w-4" /> Add Faculty
            </Button>
          </div>
        </div>

        {isAddingFaculty && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingId ? "Edit Faculty" : "Add Faculty"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Enter faculty name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="Enter email"
                  />
                </div>

                <div className="space-y-2">
                  <Label>College *</Label>
                  <Input
                    value={lockedCollegeName || formData.college}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department *</Label>
                  <Input
                    value={lockedDepartment || formData.department}
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <Label>Designation *</Label>
                  <Select
                    value={
                      formData.designation
                        ? `${formData.designation}__${
                            formData.hasPhd ? "phd" : "nophd"
                          }`
                        : ""
                    }
                    onValueChange={(key) => {
                      const opt = designations.find(
                        (d) => `${d.name}__${d.phd ? "phd" : "nophd"}` === key,
                      );
                      if (opt)
                        setFormData((prev) => ({
                          ...prev,
                          designation: opt.name,
                          hasPhd: opt.phd,
                        }));
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
                  <Label>Date of Joining *</Label>
                  <Input
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    value={formData.dateOfJoining}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dateOfJoining: e.target.value,
                        experience: String(calculateExperience(e.target.value)),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Internal Experience (Years)</Label>
                  <Input
                    type="number"
                    value={formData.experience}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label>External Experience (Years)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Years at previous institutions"
                    value={formData.externalExperience}
                    onChange={(e) => setFormData((prev) => ({ ...prev, externalExperience: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Overall Experience (Years)</Label>
                  <Input
                    type="number"
                    value={
                      Number(formData.experience || 0) +
                      (formData.externalExperience !== "" ? Number(formData.externalExperience) : 0)
                    }
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Input value="faculty" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Level *</Label>
                  <Input value={formData.level} disabled />
                </div>

                <div className="space-y-2">
                  <Label>Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: StaffStatus) =>
                      setFormData((prev) => ({ ...prev, status: value, statusNote: "" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="long-leave">Long Leave</SelectItem>
                      <SelectItem value="maternity-leave">Maternity Leave</SelectItem>
                      <SelectItem value="recently-joined">Recently Joined</SelectItem>
                      <SelectItem value="retainership">Retainership</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.status === "other" && (
                    <Input
                      placeholder="Specify reason…"
                      value={formData.statusNote}
                      onChange={(e) => setFormData((prev) => ({ ...prev, statusNote: e.target.value }))}
                      className="mt-2"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Subjects Handled including labs (During 2025–2026)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a subject and press Enter"
                      value={formData.subjectInput}
                      onChange={(e) => setFormData((prev) => ({ ...prev, subjectInput: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          const val = formData.subjectInput.trim().replace(/,$/, "");
                          if (val && !formData.subjectsHandled.includes(val)) {
                            setFormData((prev) => ({ ...prev, subjectsHandled: [...prev.subjectsHandled, val], subjectInput: "" }));
                          } else {
                            setFormData((prev) => ({ ...prev, subjectInput: "" }));
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const val = formData.subjectInput.trim();
                        if (val && !formData.subjectsHandled.includes(val)) {
                          setFormData((prev) => ({ ...prev, subjectsHandled: [...prev.subjectsHandled, val], subjectInput: "" }));
                        } else {
                          setFormData((prev) => ({ ...prev, subjectInput: "" }));
                        }
                      }}
                    >Add</Button>
                  </div>
                  {formData.subjectsHandled.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {formData.subjectsHandled.map((subject) => (
                        <span key={subject} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                          {subject}
                          <button
                            type="button"
                            className="ml-0.5 hover:text-destructive"
                            onClick={() => setFormData((prev) => ({ ...prev, subjectsHandled: prev.subjectsHandled.filter((s) => s !== subject) }))}
                          >×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
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
                      className="bg-muted font-semibold"
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

                <div className="space-y-2">
                  <Label>{editingId ? "New Password" : "Password *"}</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.pass}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          pass: e.target.value,
                        }))
                      }
                      placeholder={
                        editingId
                          ? "Leave blank to keep current password"
                          : "Enter password"
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
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
                  <Label>
                    {editingId ? "Confirm New Password" : "Confirm Password *"}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirm_pass}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          confirm_pass: e.target.value,
                        }))
                      }
                      placeholder="Confirm password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={cancelForm}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingId ? (
                    "Update Faculty"
                  ) : (
                    "Add Faculty"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              Faculty List
              {collegeDeptFaculty.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({collegeDeptFaculty.length} total)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Search by name, email, designation"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground"
                      >
                        Loading faculty...
                      </TableCell>
                    </TableRow>
                  ) : filteredFaculty.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground"
                      >
                        No faculty found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFaculty.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>{member.name}</TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>{member.department}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{member.designation}</span>
                            {member.hasPhd && (
                              <Badge variant="secondary">PhD</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{member.role || "faculty"}</TableCell>
                        <TableCell>
                          {member.level ?? facultyRoleLevel}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const s = member.staffStatus || (member.isActive ? "active" : "inactive");
                            const label = STAFF_STATUS_LABELS[s as StaffStatus] || s;
                            const note = s === "other" && member.statusNote ? ` — ${member.statusNote}` : "";
                            const colorMap: Record<string, string> = {
                              "active": "bg-green-100 text-green-800",
                              "recently-joined": "bg-blue-100 text-blue-800",
                              "long-leave": "bg-orange-100 text-orange-800",
                              "maternity-leave": "bg-purple-100 text-purple-800",
                              "retainership": "bg-yellow-100 text-yellow-800",
                              "inactive": "bg-gray-100 text-gray-600",
                              "other": "bg-gray-100 text-gray-600",
                            };
                            return (
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[s] || "bg-gray-100 text-gray-600"}`}>
                                {label}{note}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Download PDF Report"
                              onClick={() => generateFacultyPDF(member.id)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(member)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => setFacultyToDelete(member)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
          <DialogContent className="max-w-5xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Excel Upload Preview
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
              {" rows. Only valid rows will be uploaded."}
            </div>

            <div className="overflow-auto flex-1 rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-6"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Exp</TableHead>
                    <TableHead>PhD</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {excelRows.map((row, idx) => (
                    <TableRow
                      key={idx}
                      className={row.error ? "bg-destructive/5" : ""}
                    >
                      <TableCell>
                        {row.error ? (
                          <XCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                      </TableCell>
                      <TableCell>{row.name || "—"}</TableCell>
                      <TableCell>{row.email || "—"}</TableCell>
                      <TableCell>{row.designation || "—"}</TableCell>
                      <TableCell>{row.experience}</TableCell>
                      <TableCell>{row.hasPhd ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "active" ? "default" : "secondary"
                          }
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-destructive text-xs">
                        {row.error || ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-3 p-3 rounded-md bg-muted text-xs text-muted-foreground">
              <strong>Expected columns:</strong> name, email, pass (password),
              designation, experience, hasPhd (yes/no/true/false),
              status (active/inactive) — department is set automatically from your account.
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
                    Upload {excelRows.filter((r) => !r.error).length} Faculty
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DeleteConfirmationDialog
          open={!!facultyToDelete}
          onOpenChange={(open) => {
            if (!open) setFacultyToDelete(null);
          }}
          title="Delete faculty"
          description={
            facultyToDelete
              ? `Are you sure you want to delete ${facultyToDelete.name}?`
              : "This action cannot be undone."
          }
          confirmText="Delete"
          cancelText="Cancel"
          isLoading={isDeleting}
          onConfirm={() => {
            if (facultyToDelete) {
              handleDelete(facultyToDelete.id);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
}
