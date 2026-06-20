import { Fragment, useEffect, useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Filter,
  Clock,
  Folder,
  File,
  Award,
  User,
  Briefcase,
  Building,
  BookOpen,
  Users,
  School,
  CheckCircle,
  AlertCircle,
  BarChart2,
  FileSpreadsheet,
  Search,
  TrendingUp,
  CircleCheck,
  CircleDot,
  Loader2,
} from "lucide-react";
import { api } from "@/api/api";
import { formatRoleLabel } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { DeadlineAlert } from "@/components/dashboard/DeadlineAlert";
import { StatusCards } from "@/components/dashboard/StatusCards";
import { ScoreOverview } from "@/components/dashboard/ScoreOverview";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { UserProfile } from "@/components/dashboard/UserProfile";
import { FPMSFormOverview } from "@/components/fpms/FPMSFormOverview";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { getConfirmedScore } from "@/lib/utils";

/* ---------------- STATUS CONFIG ---------------- */
const statusConfig: Record<
  string,
  {
    label: string;
    variant:
      | "outline"
      | "secondary"
      | "default"
      | "success"
      | "warning"
      | "destructive";
  }
> = {
  pending: { label: "Pending", variant: "outline" },
  submitted: { label: "Submitted", variant: "secondary" },
  reviewed: { label: "Under Review", variant: "default" },
  accepted: { label: "Accepted", variant: "success" },
  appealed: { label: "Appealed", variant: "warning" },
  "appeal-resolved": { label: "Appeal Resolved", variant: "success" },
  "auto-approved": { label: "Claim Accepted", variant: "success" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [committeeData, setCommitteeData] = useState<any>(null);
  const [designations, setDesignations] = useState<any[]>([]);
  // ─── FILTER STATES ───
  const [selectedCollege, setSelectedCollege] = useState<string>("All");
  const [selectedRole, setSelectedRole] = useState<string>("All");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("All");
  const [selectedStaff, setSelectedStaff] = useState<string>("All");
  const [selectedCriteria, setSelectedCriteria] = useState<string>("All");
  const [selectedModule, setSelectedModule] = useState<string>("All");
  const [selectedCollegeDetail, setSelectedCollegeDetail] = useState<string | null>(null);
  const [collegeDetailStaff, setCollegeDetailStaff] = useState<any[]>([]);
  const [selectedDeptDetail, setSelectedDeptDetail] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [hodSearch, setHodSearch] = useState<string>("");
  const [cFilterCollege, setCFilterCollege] = useState<string>("All");
  const [cFilterDept, setCFilterDept] = useState<string>("All");
  const [cFilterDesig, setCFilterDesig] = useState<string>("All");
  const [cFilterStatus, setCFilterStatus] = useState<string>("All");
  const [cFilterRole, setCFilterRole] = useState<string>("All");
  const [cSearch, setCSearch] = useState<string>("");
  const [cActiveTab, setCActiveTab] = useState<string>("staff");
  const [viewerStats, setViewerStats] = useState<any>(null);
  const [expandedCollegeDetail, setExpandedCollegeDetail] = useState<string | null>(null);
  const [collegeFacultyCache, setCollegeFacultyCache] = useState<Record<string, any[]>>({});
  const [isLoadingCollegeFaculty, setIsLoadingCollegeFaculty] = useState(false);
  const [deptCardSearch, setDeptCardSearch] = useState<string>("");
  const [roleFormColumnsByRole, setRoleFormColumnsByRole] = useState<
    Record<string, string[]>
  >({});
  // Submissions & Staff Overview: loaded on-demand when college filter is selected
  const [overviewStaff, setOverviewStaff] = useState<any[]>([]);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  // Accurate total counts — loaded via lightweight select() queries (no cap)
  const [committeeSummary, setCommitteeSummary] = useState<any>(null);

  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [userTarget, setUserTarget] = useState<string>(
    user?.designationTarget || "Not assigned",
  );
  const [userDesignationPhd, setUserDesignationPhd] = useState<boolean | null>(
    user?.hasPhd !== undefined ? Boolean(user.hasPhd) : null,
  );

  const displayName = user?.name || user?.email || "User";

  // Helper: derive "with PhD" / "without PhD" label for a staff member based on fetched designations
  const getStaffPhdLabel = (staff: any): string | undefined => {
    // Prefer the stored hasPhd on the staff record (set at login / edit time)
    if (staff.hasPhd !== undefined) {
      return staff.hasPhd ? "with PhD" : "without PhD";
    }
    const name = (staff.designation || "").trim().toLowerCase();
    const target = String(staff.designationTarget || "");
    if (!name) return undefined;
    const matches = designations.filter(
      (d: any) => (d.name || "").trim().toLowerCase() === name,
    );
    if (matches.length === 0) return undefined;
    let m: any;
    if (matches.length === 1) {
      m = matches[0];
    } else {
      m =
        matches.find((x: any) => String(x.target || "") === target) ||
        matches[0];
    }
    return m?.phd ? "with PhD" : "without PhD";
  };

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // ─── COMMON: PERSONAL SUBMISSIONS (for faculty + HOD) ───
        const personalFetch = async () => {
          const res = await api.get("/api/submissions/my-submissions", {
            headers: {
              "x-user-id": user.uid,
              "x-user-email": user.email || "",
              "x-user-name": user.name || "",
              "x-user-role": user.role,
              "x-college": user.college || "",
              "x-department": user.department || "",
            },
          });
          console.log(res.data);
          if (res.data.success) {
            const sorted = [...(res.data.data || [])].sort(
              (a, b) =>
                (b.createdAt?.seconds || 0) * 1000 -
                (a.createdAt?.seconds || 0) * 1000,
            );
            setSubmissions(sorted);
          }
        };

        // ─── ROLE-SPECIFIC ───
        if (user.role === "viewer") {
          const res = await api.get("/api/viewer/stats", {
            headers: { "x-user-id": user.uid, "x-user-role": user.role },
          });
          if (res.data.success) setViewerStats(res.data.data);
        } else if (user.role === "committee") {
          const [res, summaryRes] = await Promise.all([
            api.get("/api/auth/dashboard-data", {
              headers: { "x-user-id": user.uid, "x-user-role": user.role },
            }),
            api.get("/api/auth/committee-summary", {
              headers: { "x-user-id": user.uid, "x-user-role": user.role },
            }),
          ]);
          if (res.data.success) setCommitteeData(res.data.data);
          setStaffList(res.data.data.staff || []);
          if (summaryRes.data.success) setCommitteeSummary(summaryRes.data.data);
        } else if (user.role === "internal committee") {
          try {
            const res = await api.get("/api/admin/college-dashboard", {
              headers: {
                "x-user-id": user.uid,
                "x-user-role": user.role,
                "x-college": user.college || "",
              },
            });
            if (res.data.success) setCommitteeData(res.data.data);
            setStaffList(res.data.data.staff || []);
          } catch {
            const res = await api.get("/api/auth/dashboard-data", {
              headers: { "x-user-id": user.uid, "x-user-role": user.role },
            });
            const allStaff = res.data?.data?.staff || [];
            const myCollege = String(user.college || "")
              .trim()
              .toLowerCase();
            const filtered = allStaff.filter(
              (s: any) =>
                String(s.college || "")
                  .trim()
                  .toLowerCase() === myCollege,
            );
            setCommitteeData({ staff: filtered });
            setStaffList(filtered);
          }
          // Also load personal submissions so their own score is shown
          await personalFetch();
        } else if (
          user.role === "principle" ||
          user.role === "vice principle" ||
          user.role === "director"
        ) {
          const res = await api.get("/api/admin/college-dashboard", {
            headers: { "x-user-id": user.uid, "x-user-role": user.role },
          });
          if (res.data.success) setCommitteeData(res.data.data);
          setStaffList(res.data.data.staff || []);
        } else if (user.role === "hod") {
          const deptRes = await api.get("/api/hod/hod-dashboard", {
            headers: {
              "x-user-id": user.uid,
              "x-user-role": user.role,
              "x-college": user.college,
              "x-department": user.department,
            },
          });
          if (deptRes.data.success) setCommitteeData(deptRes.data.data);
          setStaffList(deptRes.data.data.staff || []);

          await personalFetch();
        } else {
          await personalFetch();
        }

        // ─── FETCH DESIGNATIONS ─── (add this here, inside try)
        const fetchDesignations = async () => {
          try {
            console.log(
              "[Dashboard] Fetching designations for user:",
              user.role,
              "| college:",
              user.college,
              "| designation:",
              user.designation,
            );
            const res = await api.get("/api/colleges/designations");
            console.log("[Dashboard] Designations API response:", res.data);
            if (res.data?.success) {
              let fetchedDesignations: any[] = [];
              if (user.role === "committee") {
                // Preserve college on each entry so staff ScoreOverview can do college-scoped lookup
                fetchedDesignations = (res.data.data || []).flatMap(
                  (college: any) =>
                    (college.designations || []).map((d: any) => ({
                      ...d,
                      college: college.college,
                    })),
                );
              } else {
                fetchedDesignations = res.data.data?.designations || [];
              }
              setDesignations(fetchedDesignations);

              // Resolve the logged-in user's own target by exact case-insensitive match
              const myDesig = (user?.designation || "").trim().toLowerCase();
              if (myDesig) {
                const matches = fetchedDesignations.filter(
                  (d: any) => (d.name || "").trim().toLowerCase() === myDesig,
                );
                let match: any = null;
                if (matches.length === 1) {
                  match = matches[0];
                } else if (matches.length > 1) {
                  // Prefer user.hasPhd for disambiguation; fall back to stored target
                  if (user?.hasPhd !== undefined) {
                    match =
                      matches.find(
                        (m: any) => Boolean(m.phd) === Boolean(user.hasPhd),
                      ) || matches[0];
                  } else {
                    const storedTarget = String(user?.designationTarget || "");
                    match =
                      matches.find(
                        (m: any) => String(m.target || "") === storedTarget,
                      ) || matches[0];
                  }
                }
                if (match?.target) {
                  setUserTarget(String(match.target));
                  setUserDesignationPhd(Boolean(match.phd));
                } else if (user?.designationTarget) {
                  setUserTarget(String(user.designationTarget));
                }
              } else if (user?.designationTarget) {
                setUserTarget(String(user.designationTarget));
              }
            } else {
              console.warn(
                "[Dashboard] Designations API returned success:false",
                res.data,
              );
            }
          } catch (err) {
            console.error("[Dashboard] Failed to fetch designations:", err);
          }
        };

        await fetchDesignations();
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    const loadRoleFormColumns = async () => {
      if (user?.role !== "internal committee") {
        setRoleFormColumnsByRole({});
        return;
      }

      const uniqueRoles = Array.from(
        new Set(
          staffList
            .map((staff: any) =>
              String(staff.role || "")
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean),
        ),
      );

      if (uniqueRoles.length === 0) {
        setRoleFormColumnsByRole({});
        return;
      }

      try {
        const entries = await Promise.all(
          uniqueRoles.map(async (roleName) => {
            const res = await api.get("/api/auth/forms", {
              params: { role: roleName },
              headers: {
                "x-user-role": user.role,
                "x-user-id": user.uid,
              },
            });

            const forms = Array.isArray(res.data?.data) ? res.data.data : [];
            const columns = Array.from(
              new Set(
                forms.flatMap((form: any) => {
                  const criteria = Array.isArray(form.criteria)
                    ? form.criteria
                        .map((c: any) => String(c.criteriaName || "").trim())
                        .filter(Boolean)
                    : [];

                  if (criteria.length > 0) return criteria;

                  const formTitle = String(form.formTitle || "").trim();
                  return formTitle ? [formTitle] : [];
                }),
              ),
            ) as string[];

            columns.sort((a, b) => a.localeCompare(b));

            return [roleName, columns] as [string, string[]];
          }),
        );

        setRoleFormColumnsByRole(Object.fromEntries(entries));
      } catch (error) {
        console.error("[Dashboard] Failed to load role form columns:", error);
        setRoleFormColumnsByRole({});
      }
    };

    loadRoleFormColumns();
  }, [user?.role, user?.uid, staffList]);

  // Load Submissions & Staff Overview data only when a college is selected
  useEffect(() => {
    if (user?.role !== "committee" || cFilterCollege === "All") {
      setOverviewStaff([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setIsOverviewLoading(true);
      try {
        const res = await api.get("/api/auth/dashboard-data", {
          params: { college: cFilterCollege },
          headers: { "x-user-id": user.uid, "x-user-role": user.role },
        });
        if (!cancelled && res.data.success) {
          setOverviewStaff(res.data.data.staff || []);
        }
      } catch {
        if (!cancelled) setOverviewStaff([]);
      } finally {
        if (!cancelled) setIsOverviewLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [cFilterCollege, user?.role, user?.uid]);

  const applyFilter = () => {
    if (!committeeData) return;

    let filteredStaff: any[] = staffList;

    // Skip college filter for principal/vice principal
    if (user?.role === "committee" && selectedCollege !== "All") {
      filteredStaff = filteredStaff.filter(
        (s) => s.college === selectedCollege,
      );
    }

    if (selectedRole !== "All")
      filteredStaff = filteredStaff.filter((s) => s.role === selectedRole);
    if (selectedDepartment !== "All")
      filteredStaff = filteredStaff.filter((s) => s.department === selectedDepartment);
    if (selectedStaff !== "All")
      filteredStaff = filteredStaff.filter((s) => s.name === selectedStaff);

    let subs: any[] = filteredStaff.flatMap((s) => s.submissions || []);

    if (selectedCriteria !== "All")
      subs = subs.filter((s) => s.criteriaName === selectedCriteria);
    if (selectedModule !== "All")
      subs = subs.filter((s) => s.moduleName === selectedModule);

    setFilteredData(subs);
  };

  const exportFilteredExcel = () => {
    if (filteredData.length === 0) return;

    // Build a lookup: submissionId → staff record
    const subToStaff: Record<string, any> = {};
    staffList.forEach((staff: any) => {
      (staff.submissions || []).forEach((sub: any) => {
        if (sub.id) subToStaff[sub.id] = staff;
      });
    });

    // ── Sheet 1: Summary (one row per unique faculty in filtered results) ──
    const seenFaculty = new Map<string, any>();
    filteredData.forEach((sub: any) => {
      const staff = subToStaff[sub.id] || {};
      const uid = staff.uid || staff.id || sub.userId || sub.id;
      if (!seenFaculty.has(uid)) seenFaculty.set(uid, { staff, subs: [] });
      seenFaculty.get(uid)!.subs.push(sub);
    });

    const summaryRows: any[][] = [["S.No", "Name of the Faculty", "Email", "Role", "Department", "Designation", "Submissions", "Score", "Target", "Status"]];
    let sno = 1;
    for (const { staff, subs } of seenFaculty.values()) {
      const score = subs.reduce((sum: number, s: any) =>
        sum + Number(s.finalScore ?? s.reviewerScore ?? s.claimedScore ?? 0), 0);
      const hasAccepted = subs.some((s: any) => ["accepted", "appeal-resolved", "auto-approved", "appeal-expired"].includes(s.status));
      const hasAppealed = subs.some((s: any) => s.status === "appealed");
      const hasPending = subs.some((s: any) => s.status === "submitted");
      const status = !subs.length ? "Not Submitted" : hasAppealed ? "Appealed" : hasPending ? "Pending Review" : hasAccepted ? "Completed" : "Under Review";
      summaryRows.push([sno++, staff.name || "", staff.email || "", staff.role || "", staff.department || "", staff.designation || "", subs.length, score, staff.designationTarget || "—", status]);
    }

    // ── Sheet 2: Detailed (one row per submission with all score columns) ──
    const detailHeaders = ["S.No", "Staff Name", "Email", "Role", "Department", "Designation", "Criteria", "Module", "Task", "Max Points", "Claimed Score", "Reviewer Score", "Appeal Score", "Final Score", "Status"];
    const detailRows: any[][] = [detailHeaders];
    let dSno = 1;
    filteredData.forEach((sub: any) => {
      const staff = subToStaff[sub.id] || {};
      detailRows.push([
        dSno++,
        staff.name || sub.userName || "",
        staff.email || sub.userEmail || "",
        staff.role || sub.userRole || "",
        staff.department || sub.department || "",
        staff.designation || "",
        sub.criteriaName || sub.formTitle || "",
        sub.moduleName || "",
        sub.taskName || "",
        sub.maxMarks ?? "",
        sub.claimedScore ?? "",
        sub.reviewerScore ?? "",
        sub.appealerScore ?? "",
        sub.finalScore ?? "",
        sub.status || "",
      ]);
    });

    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = summaryRows[0].map((h: string) => ({ wch: Math.max(String(h).length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
    wsDetail["!cols"] = detailHeaders.map((h) => ({ wch: Math.max(String(h).length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, wsDetail, "Detailed");

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `fpms-filtered-report-${dateStr}.xlsx`);
  };

  if (loading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground">
          <Clock className="h-6 w-6 animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </DashboardLayout>
    );
  }

  const handleCollegeDetailClick = async (collegeName: string) => {
    if (expandedCollegeDetail === collegeName) {
      setExpandedCollegeDetail(null);
      return;
    }
    setExpandedCollegeDetail(collegeName);
    if (collegeFacultyCache[collegeName]) return;
    setIsLoadingCollegeFaculty(true);
    try {
      const res = await api.get(`/api/viewer/college-faculty?college=${encodeURIComponent(collegeName)}`);
      setCollegeFacultyCache((prev) => ({ ...prev, [collegeName]: res.data.data || [] }));
    } catch {
      setCollegeFacultyCache((prev) => ({ ...prev, [collegeName]: [] }));
    } finally {
      setIsLoadingCollegeFaculty(false);
    }
  };

  if (user?.role === "viewer") {
    const stats = viewerStats;
    const summary = stats?.summary || {};
    const collegeStats: any[] = (stats?.collegeStats || []).sort((a: any, b: any) => b.completionPct - a.completionPct);
    const deptStats: any[] = stats?.deptStats || [];
    const roleStats: any[] = stats?.roleStats || [];
    const rangeStats: any[] = stats?.rangeStats || [];

    const ROLE_COLORS = ["#6366f1","#f59e0b","#10b981","#3b82f6","#ec4899","#8b5cf6","#14b8a6","#f97316"];
    const RANGE_COLORS: Record<string, string> = {
      "0%": "#ef4444", "1–25%": "#f97316", "26–50%": "#eab308",
      "51–75%": "#3b82f6", "76–99%": "#14b8a6", "100%+": "#22c55e",
    };

    const achievedCount = rangeStats.find((b: any) => b.label === "100%+")?.count || 0;
    const achievedPct = summary.totalStaff ? Math.round((achievedCount / summary.totalStaff) * 100) : 0;
    const submittedPct = summary.totalStaff ? Math.round((summary.totalSubmitted / summary.totalStaff) * 100) : 0;

    const targetDonut = [
      { name: "Achieved Target", value: achievedCount },
      { name: "Not Yet", value: (summary.totalStaff || 0) - achievedCount },
    ];

    const rangeChartData = rangeStats.map((b: any) => ({
      label: b.label, count: b.count, fill: RANGE_COLORS[b.label] || "#6366f1",
    }));

    const rolePerformanceData = roleStats
      .filter((r: any) => r.total > 0)
      .map((r: any, i: number) => ({
        name: formatRoleLabel(r.role),
        completion: r.completionPct,
        avgScore: r.avgScore,
        staff: r.total,
        fill: ROLE_COLORS[i % ROLE_COLORS.length],
      }))
      .sort((a: any, b: any) => b.completion - a.completion);

    const CustomRangeTooltip = ({ active, payload }: any) => {
      if (!active || !payload?.length) return null;
      const d = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background px-3 py-2 shadow text-sm">
          <p className="font-semibold">{d.label}</p>
          <p className="text-muted-foreground">{d.count} staff</p>
        </div>
      );
    };

    const CustomRoleTooltip = ({ active, payload }: any) => {
      if (!active || !payload?.length) return null;
      const d = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background px-3 py-2 shadow text-sm space-y-0.5">
          <p className="font-semibold">{d.name}</p>
          <p className="text-muted-foreground">Completion: <span className="text-foreground font-medium">{d.completion}%</span></p>
          <p className="text-muted-foreground">Avg Score: <span className="text-foreground font-medium">{d.avgScore}</span></p>
          <p className="text-muted-foreground">Staff: <span className="text-foreground font-medium">{d.staff}</span></p>
        </div>
      );
    };

    return (
      <DashboardLayout title="Institution Overview">
        <div className="space-y-6">

          {/* ── Row 1: 6 summary stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Colleges", value: summary.totalColleges ?? "—", icon: School, color: "bg-amber-500/10 text-amber-600" },
              { label: "Total Staff", value: summary.totalStaff ?? "—", icon: Users, color: "bg-indigo-500/10 text-indigo-600" },
              { label: "Departments", value: summary.totalDepts ?? "—", icon: Building, color: "bg-purple-500/10 text-purple-600" },
              { label: "Submissions", value: summary.totalSubmissions ?? "—", icon: FileText, color: "bg-blue-500/10 text-blue-600" },
              { label: "Target Achievers", value: `${achievedCount} (${achievedPct}%)`, icon: CheckCircle, color: "bg-emerald-500/10 text-emerald-600" },
              { label: "Avg Score", value: summary.overallAvgScore ?? "—", icon: Award, color: "bg-teal-500/10 text-teal-600" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="border-border/60">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${color} mb-2`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                  <p className="text-xl font-bold leading-tight mt-0.5">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Row 2: Submission pipeline + Target achievement donut ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Submission Pipeline</CardTitle>
                <CardDescription>Institution-wide submission status breakdown</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Staff Submitted</span>
                    <span className="font-semibold">{summary.totalSubmitted ?? 0} / {summary.totalStaff ?? 0} <span className="text-muted-foreground font-normal">({submittedPct}%)</span></span>
                  </div>
                  <Progress value={submittedPct} className="h-2.5" />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {[
                    { label: "Finalized", value: summary.totalAccepted ?? 0, dot: "bg-emerald-500", desc: "accepted / auto-approved" },
                    { label: "Pending HOD Review", value: summary.totalPendingReview ?? 0, dot: "bg-amber-500", desc: "awaiting evaluation" },
                    { label: "Under HOD Review", value: summary.totalReviewed ?? 0, dot: "bg-blue-500", desc: "scored, not yet accepted" },
                    { label: "Appealed", value: summary.totalAppealed ?? 0, dot: "bg-orange-500", desc: "in appeal process" },
                  ].map(({ label, value, dot, desc }) => (
                    <div key={label} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`h-2 w-2 rounded-full ${dot} shrink-0`} />
                        <span className="text-xs text-muted-foreground font-medium">{label}</span>
                      </div>
                      <p className="text-2xl font-bold leading-none">{value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Target Achievement</CardTitle>
                <CardDescription>Staff who have reached 100%+ of their designation target</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 justify-between gap-3">
                <div className="relative w-full flex-1" style={{ minHeight: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={targetDonut} cx="50%" cy="50%" innerRadius="42%" outerRadius="62%"
                        paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                        <Cell fill="#22c55e" />
                        <Cell fill="#e5e7eb" />
                      </Pie>
                      <Tooltip formatter={(v: any, name: string) => [`${v} staff`, name]}
                        contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
                    <span className="text-4xl font-bold text-green-600 leading-none">{achievedPct}%</span>
                    <span className="text-xs text-muted-foreground mt-1">achieved target</span>
                    <span className="text-xl font-bold mt-1.5 leading-none">{achievedCount} <span className="text-sm font-normal text-muted-foreground">/ {summary.totalStaff ?? 0}</span></span>
                  </div>
                </div>
                <div className="flex justify-center gap-6 pb-1 text-sm">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-500 shrink-0" />Achieved ({achievedCount})</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-200 shrink-0" />Not Yet ({(summary.totalStaff ?? 0) - achievedCount})</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Row 3: Role performance + Completion bands ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Performance by Role</CardTitle>
                <CardDescription>Average target completion % per role</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ height: Math.max(180, rolePerformanceData.length * 44) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={rolePerformanceData} margin={{ top: 4, right: 52, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomRoleTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
                      <Bar dataKey="completion" radius={[0, 6, 6, 0]} maxBarSize={26}>
                        {rolePerformanceData.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
                        <LabelList dataKey="completion" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Completion Bands</CardTitle>
                <CardDescription>Staff count in each target completion % band</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rangeChartData} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip content={<CustomRangeTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                        {rangeChartData.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
                        <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Row 4: College Rankings Table ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">College Rankings</CardTitle>
              <CardDescription>Ranked by target completion — performance across all colleges</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {collegeStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground w-8">#</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">College</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Staff</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Submissions</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Sub Rate</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Avg Score</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Appeals</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Deadlines</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground min-w-[160px]">Completion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collegeStats.map((c: any, i: number) => {
                        const dl = c.deadlines;
                        const fmtDate = (d: string | null) => {
                          if (!d) return null;
                          return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                        };
                        return (
                        <Fragment key={c.college}>
                        <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground font-medium">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium leading-tight">{c.college}</div>
                            {c.code && <div className="text-xs text-muted-foreground mt-0.5">{c.code}</div>}
                          </td>
                          <td className="px-3 py-3 text-center font-medium">{c.total}</td>
                          <td className="px-3 py-3 text-center text-muted-foreground">{c.submissionCount}</td>
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={() => handleCollegeDetailClick(c.college)}
                              className="hover:underline focus:outline-none"
                            >
                              <span className={`font-semibold ${c.submissionRate >= 80 ? "text-emerald-600" : c.submissionRate >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                {c.submitted ?? 0} / {c.total}
                              </span>
                              <div className="text-xs text-muted-foreground">{c.submissionRate}%</div>
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center font-medium">{c.avgScore}</td>
                          <td className="px-3 py-3 text-center">
                            {c.appealedCount > 0
                              ? <span className="text-orange-500 font-medium">{c.appealedCount}</span>
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {dl ? (
                              <div className="text-xs space-y-0.5 whitespace-nowrap">
                                {(dl.submissionStart || dl.submissionEnd) && (
                                  <div><span className="text-muted-foreground">Sub: </span>{fmtDate(dl.submissionStart) ?? "—"} – {fmtDate(dl.submissionEnd) ?? "—"}</div>
                                )}
                                {dl.evaluationEnd && (
                                  <div><span className="text-muted-foreground">Eval: </span>{fmtDate(dl.evaluationEnd)}</div>
                                )}
                                {dl.appealEnd && (
                                  <div><span className="text-muted-foreground">Appeal: </span>{fmtDate(dl.appealEnd)}</div>
                                )}
                                {dl.appealReviewEnd && (
                                  <div><span className="text-muted-foreground">Appeal Review: </span>{fmtDate(dl.appealReviewEnd)}</div>
                                )}
                              </div>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(c.completionPct, 100)} className="flex-1 h-2" />
                              <span className={`text-xs font-bold w-10 text-right ${c.completionPct >= 75 ? "text-emerald-600" : c.completionPct >= 40 ? "text-amber-600" : "text-red-500"}`}>
                                {c.completionPct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                        {expandedCollegeDetail === c.college && (() => {
                          const facultyList = collegeFacultyCache[c.college] || [];
                          const notSubmitted = facultyList.filter((f: any) => !f.hasSubmitted).sort((a: any, b: any) => (a.department || "").localeCompare(b.department || "") || (a.name || "").localeCompare(b.name || ""));
                          const submitted = facultyList.filter((f: any) => f.hasSubmitted).sort((a: any, b: any) => (a.department || "").localeCompare(b.department || "") || (a.name || "").localeCompare(b.name || ""));
                          const colSpan = 9;
                          const statusLabel: Record<string, string> = {
                            "active": "Active", "inactive": "Inactive",
                            "long-leave": "Long Leave", "maternity-leave": "Maternity Leave",
                            "recently-joined": "Recently Joined", "other": "Other",
                          };
                          const statusColor: Record<string, string> = {
                            "active": "bg-green-100 text-green-800",
                            "recently-joined": "bg-blue-100 text-blue-800",
                            "long-leave": "bg-orange-100 text-orange-800",
                            "maternity-leave": "bg-purple-100 text-purple-800",
                            "inactive": "bg-gray-100 text-gray-600",
                            "other": "bg-gray-100 text-gray-600",
                          };
                          const FacultyTable = ({ rows, emptyMsg, showStatus, showScores }: { rows: any[]; emptyMsg: string; showStatus?: boolean; showScores?: boolean }) => (
                            rows.length === 0
                              ? <p className="text-xs text-muted-foreground py-2 text-center">{emptyMsg}</p>
                              : <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b bg-muted/20">
                                        <th className="text-left px-3 py-1.5 font-medium">Name</th>
                                        <th className="text-left px-3 py-1.5 font-medium">Department</th>
                                        <th className="text-left px-3 py-1.5 font-medium">Designation</th>
                                        <th className="text-left px-3 py-1.5 font-medium">Role</th>
                                        {showStatus && <th className="text-left px-3 py-1.5 font-medium">Status</th>}
                                        {showScores && <>
                                          <th className="text-right px-3 py-1.5 font-medium">Target</th>
                                          <th className="text-right px-3 py-1.5 font-medium">Claimed</th>
                                          <th className="text-right px-3 py-1.5 font-medium">Reviewer</th>
                                          <th className="text-left px-3 py-1.5 font-medium">Appeal</th>
                                          <th className="text-right px-3 py-1.5 font-medium">%</th>
                                          <th className="text-left px-3 py-1.5 font-medium">Status</th>
                                        </>}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rows.map((f: any) => (
                                        <tr key={f.uid} className="border-b last:border-0 hover:bg-muted/10">
                                          <td className="px-3 py-1.5 font-medium whitespace-nowrap">{f.name || "—"}</td>
                                          <td className="px-3 py-1.5">{f.department || "—"}</td>
                                          <td className="px-3 py-1.5">
                                            <span>{f.designation || "—"}</span>
                                            {f.hasPhd && <span className="ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700">PhD</span>}
                                          </td>
                                          <td className="px-3 py-1.5 capitalize">{f.role || "—"}</td>
                                          {showStatus && (
                                            <td className="px-3 py-1.5">
                                              {f.staffStatus ? (
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[f.staffStatus] || "bg-gray-100 text-gray-600"}`}>
                                                  {statusLabel[f.staffStatus] || f.staffStatus}
                                                  {f.staffStatus === "other" && f.statusNote ? ` — ${f.statusNote}` : ""}
                                                </span>
                                              ) : "—"}
                                            </td>
                                          )}
                                          {showScores && <>
                                            <td className="px-3 py-1.5 text-right tabular-nums">{f.targetScore ?? "—"}</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums">{f.claimedScore ?? "—"}</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums font-medium">{f.reviewerScore ?? "—"}</td>
                                            <td className="px-3 py-1.5">
                                              {f.isAppealed
                                                ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800">Appealed</span>
                                                : <span className="text-muted-foreground">—</span>}
                                            </td>
                                            <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                                              {f.percentage != null
                                                ? <span className={f.percentage >= 100 ? "text-green-600" : f.percentage >= 60 ? "text-blue-600" : "text-orange-600"}>{f.percentage}%</span>
                                                : "—"}
                                            </td>
                                            <td className="px-3 py-1.5">
                                              {(() => {
                                                const s = f.overallStatus;
                                                const cfg: Record<string, string> = {
                                                  "Accepted":       "bg-emerald-500 text-white",
                                                  "Pending Review": "bg-teal-400 text-white",
                                                  "Under Review":   "bg-slate-800 text-white",
                                                  "Appealed":       "bg-yellow-500 text-white",
                                                };
                                                return s ? (
                                                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cfg[s] || "bg-gray-200 text-gray-700"}`}>{s}</span>
                                                ) : "—";
                                              })()}
                                            </td>
                                          </>}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                          );
                          return (
                            <tr>
                              <td colSpan={colSpan} className="bg-muted/10 border-b px-0 py-0">
                                <div className="p-4 space-y-4">
                                  {isLoadingCollegeFaculty && facultyList.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-2">Loading…</p>
                                  ) : (
                                    <>
                                      <div>
                                        <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
                                          Not Submitted ({notSubmitted.length})
                                        </p>
                                        <FacultyTable rows={notSubmitted} emptyMsg="All staff have submitted." showStatus />
                                      </div>
                                      <div>
                                        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">
                                          Submitted ({submitted.length})
                                        </p>
                                        <FacultyTable rows={submitted} emptyMsg="No submissions yet." showScores />
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })()}
                        </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Row 5: Department breakdown accordion ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Department Breakdown</CardTitle>
              <CardDescription>Per-department stats grouped by college — click to expand</CardDescription>
            </CardHeader>
            <CardContent>
              {deptStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No data</p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {Array.from(new Set(deptStats.map((d: any) => d.college))).sort().map((college: any) => {
                    const rows = deptStats
                      .filter((d: any) => d.college === college)
                      .sort((a: any, b: any) => b.completionPct - a.completionPct);
                    const collegeAvg = rows.length
                      ? Math.round(rows.reduce((s: number, d: any) => s + d.completionPct, 0) / rows.length)
                      : 0;
                    const totalSubs = rows.reduce((s: number, d: any) => s + d.submissionCount, 0);
                    const totalAppeals = rows.reduce((s: number, d: any) => s + d.appealedCount, 0);
                    return (
                      <AccordionItem key={college} value={college}>
                        <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                          <div className="flex items-center justify-between w-full pr-3 gap-4">
                            <span className="text-left flex-1">{college}</span>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground font-normal shrink-0">
                              <span>{rows.length} dept{rows.length !== 1 ? "s" : ""}</span>
                              <span>{totalSubs} subs</span>
                              {totalAppeals > 0 && <span className="text-orange-500">{totalAppeals} appeals</span>}
                              <span className="w-32 flex items-center gap-1.5">
                                <Progress value={Math.min(collegeAvg, 100)} className="h-1.5 flex-1" />
                                <span className="w-8 text-right font-semibold">{collegeAvg}%</span>
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-1 pb-3">
                          <div className="rounded-lg border overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-muted/40 border-b">
                                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Department</th>
                                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Staff</th>
                                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Subs</th>
                                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Sub Rate</th>
                                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Avg Score</th>
                                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Appeals</th>
                                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground min-w-[140px]">Completion</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((d: any) => (
                                  <tr key={d.department} className="border-b last:border-0 hover:bg-muted/20">
                                    <td className="px-3 py-2 font-medium max-w-[200px] truncate" title={d.department}>{d.department}</td>
                                    <td className="px-3 py-2 text-center text-muted-foreground">{d.total}</td>
                                    <td className="px-3 py-2 text-center text-muted-foreground">{d.submissionCount}</td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`font-semibold ${d.submissionRate >= 80 ? "text-emerald-600" : d.submissionRate >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                        {d.submissionRate}%
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-center font-medium">{d.avgScore}</td>
                                    <td className="px-3 py-2 text-center">
                                      {d.appealedCount > 0
                                        ? <span className="text-orange-500 font-medium">{d.appealedCount}</span>
                                        : <span className="text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-1.5">
                                        <Progress value={Math.min(d.completionPct, 100)} className="flex-1 h-1.5" />
                                        <span className={`font-bold w-9 text-right ${d.completionPct >= 75 ? "text-emerald-600" : d.completionPct >= 40 ? "text-amber-600" : "text-red-500"}`}>
                                          {d.completionPct}%
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>

        </div>
      </DashboardLayout>
    );
  }

  if (
    ["committee", "principle", "vice principle", "director", "hod", "internal committee"].includes(
      user?.role || "",
    )
  ) {
    const isHod = user?.role === "hod";
    const isInternalCommittee = user?.role === "internal committee";
    const isDean =
      user?.role === "principle" || user?.role === "vice principle" || user?.role === "director" || isInternalCommittee;

    const groupedData = staffList
      .filter((staff: any) =>
        user?.role === "committee"
          ? staff.college && staff.role !== "committee"
          : true,
      )
      .reduce((acc: any, staff: any) => {
        const collegeName = staff.college || "Unknown College";
        const roleName = staff.role || "Unknown Role";

        if (!acc[collegeName]) acc[collegeName] = {};
        if (!acc[collegeName][roleName]) acc[collegeName][roleName] = [];
        acc[collegeName][roleName].push(staff);
        return acc;
      }, {});

    // Aggregate stats for department/college view
    let totalSubmissions = 0;
    let totalFinalScore = 0;
    let totalMaxMarks = 0;
    let totalAppealed = 0;
    let totalCompleted = 0;
    staffList
      .filter((staff: any) =>
        user?.role === "committee"
          ? staff.college && staff.role !== "committee"
          : true,
      )
      .forEach((staff: any) => {
        staff.submissions?.forEach((sub: any) => {
          totalSubmissions++;
          totalFinalScore += getConfirmedScore(sub);
          totalMaxMarks += sub.maxMarks ?? 0;
          if (sub.status === "appealed") totalAppealed++;
          if (sub.status === "accepted" || sub.status === "appeal-resolved" || sub.status === "auto-approved" || sub.status === "appeal-expired" || sub.status === "auto-approved")
            totalCompleted++;
        });
      });

    // ─── PERSONAL STATS (only used when isHod === true) ───
    let personalClaimed = 0,
      personalReviewer = 0,
      personalFinal = 0,
      personalMax = 0;
    let personalCompleted = 0,
      personalAppealed = 0;
    submissions.forEach((sub: any) => {
      personalClaimed += sub.claimedScore ?? 0;
      personalReviewer += sub.reviewerScore ?? 0;
      personalFinal += getConfirmedScore(sub);
      personalMax += sub.maxMarks ?? 0;
      if (sub.status === "accepted" || sub.status === "appeal-resolved" || sub.status === "auto-approved" || sub.status === "appeal-expired" || sub.status === "auto-approved")
        personalCompleted++;
      if (sub.status === "appealed") personalAppealed++;
    });

    const exportCommitteeCollegeWiseExcel = () => {
      if (user?.role !== "committee") return;

      const getScoreColumnKey = (sub: any) => {
        const criteria = String(sub?.criteriaName || "").trim();
        if (criteria) return criteria;

        const form = String(sub?.formTitle || "").trim();
        if (form) return form;

        return "Unspecified";
      };

      const colleges = Array.from(
        new Set(
          staffList.map((staff: any) =>
            String(staff.college || "Unknown College").trim(),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b));

      const toSafeSheetName = (rawName: string) =>
        (
          String(rawName || "Role")
            .replace(/[\\/?*\[\]:]/g, "-")
            .trim() || "Role"
        ).slice(0, 31);

      const toSafeFilePart = (rawName: string) =>
        String(rawName || "College")
          .replace(/[<>:"/\\|?*]/g, "-")
          .replace(/\s+/g, " ")
          .trim() || "College";

      colleges.forEach((collegeName) => {
        const workbook = XLSX.utils.book_new();
        const collegeStaff = staffList.filter(
          (staff: any) =>
            String(staff.college || "Unknown College").trim() === collegeName,
        );

        if (collegeStaff.length === 0) return;

        const rolesInCollege = Array.from(
          new Set(
            collegeStaff
              .map((staff: any) => String(staff.role || "Unknown Role").trim())
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b));

        const usedSheetNames = new Set<string>();
        const toUniqueSheetName = (rawName: string) => {
          const base = toSafeSheetName(rawName);
          if (!usedSheetNames.has(base)) {
            usedSheetNames.add(base);
            return base;
          }

          let index = 2;
          while (index < 1000) {
            const suffix = ` (${index})`;
            const candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
            if (!usedSheetNames.has(candidate)) {
              usedSheetNames.add(candidate);
              return candidate;
            }
            index++;
          }

          return `Role-${Date.now()}`.slice(0, 31);
        };

        rolesInCollege.forEach((roleName) => {
          const roleStaff = collegeStaff.filter(
            (staff: any) =>
              String(staff.role || "Unknown Role").trim() === roleName,
          );

          if (roleStaff.length === 0) return;

          const scoreColumns = Array.from(
            new Set(
              roleStaff.flatMap((staff: any) =>
                (staff.submissions || [])
                  .map((sub: any) => getScoreColumnKey(sub))
                  .filter(Boolean),
              ),
            ),
          ).sort((a, b) => a.localeCompare(b));

          const rowsForExcel = roleStaff.map((staff: any) => {
            const submissions = Array.isArray(staff.submissions)
              ? staff.submissions
              : [];
            const base: Record<string, string | number> = {
              Name: String(staff.name || ""),
              Email: String(staff.email || ""),
              Role: String(staff.role || ""),
              College: collegeName,
            };

            scoreColumns.forEach((title) => {
              base[`${title} Score`] = submissions
                .filter((sub: any) => getScoreColumnKey(sub) === title)
                .reduce(
                  (sum: number, sub: any) =>
                    sum +
                    Number(
                      sub.finalScore ??
                        sub.reviewerScore ??
                        sub.claimedScore ??
                        0,
                    ),
                  0,
                );
            });

            base["Target Score"] = Number(staff.designationTarget || 0);
            base["Achieved Score"] = submissions.reduce(
              (sum: number, sub: any) =>
                sum +
                Number(
                  sub.finalScore ?? sub.reviewerScore ?? sub.claimedScore ?? 0,
                ),
              0,
            );

            return base;
          });

          if (rowsForExcel.length === 0) return;

          const worksheet = XLSX.utils.json_to_sheet(rowsForExcel);
          XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            toUniqueSheetName(roleName),
          );
        });

        if ((workbook.SheetNames || []).length === 0) return;

        const fileCollegeName = toSafeFilePart(collegeName);
        XLSX.writeFile(workbook, `committee-${fileCollegeName}-users.xlsx`);
      });
    };

    // ── SUMMARY REPORT: one row per faculty, dept sheets with college/dept header ──
    const exportPrincipalReport = () => {
      const collegeName = String(user.college || "VISHNU INSTITUTE OF TECHNOLOGY").toUpperCase();
      const NCOLS = 7;
      const SUMMARY_HEADERS = ["S.No", "Name of the Faculty", "Designation", "Submissions", "Score", "Target", "Status"];
      const SUMMARY_WIDTHS = [{ wch: 6 }, { wch: 32 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 18 }];

      const getStatus = (subs: any[]) => {
        if (!subs.length) return "Not Submitted";
        if (subs.some((s: any) => s.status === "accepted" || s.status === "appeal-resolved" || s.status === "auto-approved" || s.status === "appeal-expired")) {
          return subs.some((s: any) => s.status === "submitted") ? "Partially Reviewed" : "Completed";
        }
        if (subs.some((s: any) => s.status === "appealed")) return "Appealed";
        return "Pending Review";
      };

      const buildSummarySheet = (deptName: string, staffArr: any[]) => {
        const rows: any[][] = [
          [collegeName, "", "", "", "", "", ""],
          [deptName, "", "", "", "", "", ""],
          SUMMARY_HEADERS,
        ];
        const merges: XLSX.Range[] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: NCOLS - 1 } },
        ];
        let sno = 1;
        for (const s of staffArr) {
          const subs = s.submissions || [];
          const score = subs.reduce((sum: number, sub: any) =>
            sum + Number(sub.finalScore ?? sub.reviewerScore ?? sub.claimedScore ?? 0), 0);
          rows.push([sno++, s.name || s.email || "—", s.designation || "—",
            subs.length, score, s.designationTarget || "—", getStatus(subs)]);
        }
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!merges"] = merges;
        ws["!cols"] = SUMMARY_WIDTHS;
        // Bold the title rows
        return ws;
      };

      const wb = XLSX.utils.book_new();
      const adminRoles = new Set(["committee", "principle", "vice principle", "director", "internal committee"]);
      const faculty = staffList.filter((s: any) => !adminRoles.has(String(s.role || "").toLowerCase()));

      const deptMap: Record<string, any[]> = {};
      const deans: any[] = [];
      faculty.forEach((s: any) => {
        if (String(s.role || "").toLowerCase().includes("dean")) {
          deans.push(s);
        } else if (s.department) {
          if (!deptMap[s.department]) deptMap[s.department] = [];
          deptMap[s.department].push(s);
        }
      });

      Object.entries(deptMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([dept, arr]) => {
        const safeName = dept.replace(/[:\\/?*[\]]/g, "").slice(0, 31);
        XLSX.utils.book_append_sheet(wb, buildSummarySheet(dept, arr), safeName);
      });
      if (deans.length) {
        XLSX.utils.book_append_sheet(wb, buildSummarySheet("Deans", deans), "Deans");
      }
      if (wb.SheetNames.length === 0) return;
      XLSX.writeFile(wb, `${collegeName.replace(/[/\\?*[\]:]/g, "-")}-summary-report.xlsx`);
    };

    // ── DETAILED REPORT: hierarchical modules/submodules/tasks with all scores ──
    const exportDetailedReport = async () => {
      try {
        const res = await api.get("/api/admin/export-report");
        const { deans, byDept } = res.data?.data || { deans: [], byDept: {} };
        const collegeName = String(user.college || "VISHNU INSTITUTE OF TECHNOLOGY").toUpperCase();

        const wb = XLSX.utils.book_new();
        const DETAIL_HEADERS = [
          "S.No", "Name of the Faculty", "Modules", "Sub Modules", "Tasks",
          "Max Points", "Claimed Score", "Reviewer Score", "Appeal Score", "Final Score", "Total Score",
        ];
        const DETAIL_WIDTHS = [
          { wch: 6 }, { wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 32 },
          { wch: 10 }, { wch: 14 }, { wch: 15 }, { wch: 13 }, { wch: 12 }, { wch: 12 },
        ];

        const buildDetailSheet = (deptName: string, staffArr: any[]) => {
          const titleRows: any[][] = [
            [collegeName, ...Array(DETAIL_HEADERS.length - 1).fill("")],
            [deptName, ...Array(DETAIL_HEADERS.length - 1).fill("")],
            DETAIL_HEADERS,
          ];
          const merges: XLSX.Range[] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: DETAIL_HEADERS.length - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: DETAIL_HEADERS.length - 1 } },
          ];
          const addMerge = (c: number, r1: number, r2: number) => {
            if (r2 > r1) merges.push({ s: { r: r1, c }, e: { r: r2, c } });
          };
          const rows: any[][] = [...titleRows];

          let sno = 1;
          for (const person of staffArr) {
            const subs: any[] = person.subs || [];
            const totalScore = subs.reduce((s: number, sub: any) => s + Number(sub.finalScore ?? 0), 0);
            if (subs.length === 0) {
              rows.push([sno++, person.name, "-", "-", "-", "-", "-", "-", "-", "-", "-"]);
              continue;
            }

            const criteriaMap = new Map<string, any[]>();
            for (const sub of subs) {
              const key = sub.criteriaName || sub.formTitle || "-";
              if (!criteriaMap.has(key)) criteriaMap.set(key, []);
              criteriaMap.get(key)!.push(sub);
            }

            const facStart = rows.length;
            let firstFac = true;
            for (const [criteriaKey, critSubs] of criteriaMap) {
              const critStart = rows.length;
              const subModMap = new Map<string, any[]>();
              for (const sub of critSubs) {
                const smKey = sub.moduleName || "-";
                if (!subModMap.has(smKey)) subModMap.set(smKey, []);
                subModMap.get(smKey)!.push(sub);
              }
              let firstCrit = true;
              for (const [smKey, smSubs] of subModMap) {
                const smStart = rows.length;
                smSubs.forEach((sub: any, smIdx: number) => {
                  const isLast = sub === subs[subs.length - 1];
                  rows.push([
                    firstFac ? sno : "",
                    firstFac ? person.name : "",
                    firstCrit ? criteriaKey : "",
                    smIdx === 0 ? smKey : "",
                    sub.taskName || "-",
                    sub.maxMarks ?? "-",
                    sub.claimedScore ?? "-",
                    sub.reviewerScore ?? "-",
                    sub.appealerScore ?? "-",
                    sub.finalScore ?? "-",
                    isLast ? totalScore : "",
                  ]);
                  firstFac = false;
                  firstCrit = false;
                });
                addMerge(3, smStart, rows.length - 1);
              }
              addMerge(2, critStart, rows.length - 1);
            }
            addMerge(0, facStart, rows.length - 1);
            addMerge(1, facStart, rows.length - 1);
            sno++;
          }

          const ws = XLSX.utils.aoa_to_sheet(rows);
          ws["!merges"] = merges;
          ws["!cols"] = DETAIL_WIDTHS;
          return ws;
        };

        Object.entries(byDept).sort(([a], [b]) => a.localeCompare(b)).forEach(([dept, arr]) => {
          const safeName = dept.replace(/[:\\/?*[\]]/g, "").slice(0, 31);
          if ((arr as any[]).length)
            XLSX.utils.book_append_sheet(wb, buildDetailSheet(dept, arr as any[]), safeName);
        });
        if ((deans as any[]).length)
          XLSX.utils.book_append_sheet(wb, buildDetailSheet("Deans", deans), "Deans");

        if (wb.SheetNames.length === 0) return;
        XLSX.writeFile(wb, `${collegeName.replace(/[/\\?*[\]:]/g, "-")}-detailed-report.xlsx`);
      } catch {
        // silent
      }
    };

    // ── SHARED PDF BUILDER ──
    const buildFacultyPDF = (
      depts: { name: string; staff: any[] }[],
      principalName: string,
      hodName: string,
    ) => {
      const collegeName = String(user.college || "VISHNU INSTITUTE OF TECHNOLOGY").toUpperCase();
      const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pw = doc.internal.pageSize.getWidth();   // 297
      const ph = doc.internal.pageSize.getHeight();  // 210
      const ML = 14; const MR = 14;
      const usableW = pw - ML - MR; // 269

      // Column widths that sum to exactly usableW (269mm)
      // S.No(12) + Name(100) + Desig(48) + Subs(22) + Score(22) + Target(22) + Status(43) = 269
      const COL_WIDTHS = [12, 100, 48, 22, 22, 22, 43];

      const addPageHeader = (deptName?: string) => {
        doc.setFillColor(0, 31, 63);
        doc.rect(0, 0, pw, 18, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text(collegeName, pw / 2, 8, { align: "center" });
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Faculty Performance Report", pw / 2, 14, { align: "center" });
        doc.setTextColor(0, 0, 0);
        if (deptName) {
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text(`Department: ${deptName}`, ML, 24);
        }
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Date: ${dateStr}`, pw - MR, 24, { align: "right" });
      };

      const drawSignatures = (topY: number, resolvedHodName: string) => {
        const hodX = pw * 0.22;
        const principalX = pw * 0.78;
        const boxH = 34;

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 31, 63);
        doc.text("Verified & Forwarded by", hodX, topY, { align: "center" });
        doc.text("Approved by", principalX, topY, { align: "center" });

        ([
          [hodX, "Head of Department", resolvedHodName],
          [principalX, "Principal", principalName],
        ] as [number, string, string][]).forEach(([x, role, name]) => {
          const bx = x - 46; const by = topY + 4;
          doc.setDrawColor(180, 180, 180);
          doc.setFillColor(250, 250, 252);
          doc.roundedRect(bx, by, 92, boxH, 1, 1, "FD");
          doc.setFontSize(8.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text("Signature:", bx + 4, by + 9);
          doc.setDrawColor(160, 160, 160);
          doc.line(bx + 26, by + 9, bx + 88, by + 9);
          doc.text("Name:", bx + 4, by + 18);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          doc.text(name || "—", bx + 26, by + 18);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text("Designation:", bx + 4, by + 27);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 31, 63);
          doc.text(role, bx + 26, by + 27);
        });
        doc.setTextColor(0, 0, 0);
      };

      // actual drawn height: label(6) + gap(4) + box(34) = 44mm
      const SIG_BLOCK_H = 44;
      const FOOTER_H = 10;

      const getStatusLabel = (subs: any[]) => {
        if (!subs.length) return "Not Submitted";
        const hasAccepted = subs.some((s: any) => ["accepted", "appeal-resolved", "auto-approved", "appeal-expired"].includes(s.status));
        if (subs.some((s: any) => s.status === "appealed")) return "Appealed";
        if (hasAccepted && subs.some((s: any) => s.status === "submitted")) return "Partial";
        if (hasAccepted) return "Completed";
        return "Pending Review";
      };

      let isFirst = true;
      for (const dept of depts) {
        if (!isFirst) doc.addPage();
        isFirst = false;
        addPageHeader(dept.name);

        const rows = dept.staff.map((s: any, idx: number) => {
          const subs = s.submissions || [];
          const score = subs.reduce((sum: number, sub: any) =>
            sum + Number(sub.finalScore ?? sub.reviewerScore ?? sub.claimedScore ?? 0), 0);
          const targetReached = s.designationTarget && score >= Number(s.designationTarget);
          return [
            idx + 1,
            s.name || s.email || "—",
            s.designation || "—",
            subs.length,
            score,
            s.designationTarget || "—",
            targetReached ? "✓ Reached" : getStatusLabel(subs),
          ];
        });

        autoTable(doc, {
          head: [["S.No", "Name of the Faculty", "Designation", "Submissions", "Score", "Target", "Status"]],
          body: rows,
          startY: 30,
          margin: { left: ML, right: MR },
          tableWidth: usableW,
          styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
          headStyles: { fillColor: [0, 31, 63], textColor: 255, fontStyle: "bold", halign: "center" },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: {
            0: { cellWidth: COL_WIDTHS[0], halign: "center" },
            1: { cellWidth: COL_WIDTHS[1] },
            2: { cellWidth: COL_WIDTHS[2] },
            3: { cellWidth: COL_WIDTHS[3], halign: "center" },
            4: { cellWidth: COL_WIDTHS[4], halign: "center" },
            5: { cellWidth: COL_WIDTHS[5], halign: "center" },
            6: { cellWidth: COL_WIDTHS[6], halign: "center" },
          },
          didDrawCell: (data: any) => {
            if (data.section === "body" && data.column.index === 6) {
              const val = String(data.cell.text?.[0] || "");
              doc.setTextColor(val.includes("Reached") ? 22 : 0, val.includes("Reached") ? 163 : 0, val.includes("Reached") ? 74 : 0);
            }
          },
        });

        // Resolve the HOD name for this specific department
        const deptHodName =
          dept.staff.find((s: any) => String(s.role || "").toLowerCase() === "hod")?.name ||
          hodName;

        // Draw signatures after the table — on same page if there's room, else new page
        const tableEndY = (doc as any).lastAutoTable?.finalY ?? 30;
        const roomLeft = ph - tableEndY - FOOTER_H;
        let sigTop: number;
        if (roomLeft >= SIG_BLOCK_H + 6) {
          sigTop = tableEndY + 10;
        } else {
          // Continuation page: minimal header (no full banner) to avoid repeating college name
          doc.addPage();
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 31, 63);
          doc.text(`Department: ${dept.name}`, ML, 14);
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(80, 80, 80);
          doc.text(`Date: ${dateStr}`, pw - MR, 14, { align: "right" });
          doc.setDrawColor(0, 31, 63);
          doc.line(ML, 17, pw - MR, 17);
          doc.setTextColor(0, 0, 0);
          sigTop = 28;
        }
        drawSignatures(sigTop, deptHodName);
      }

      // Page numbers footer on every page
      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Page ${i} of ${total}  |  ${collegeName}  |  Generated: ${dateStr}`,
          pw / 2, ph - 4, { align: "center" },
        );
      }

      doc.save(`${collegeName.replace(/[/\\?*[\]:]/g, "-")}-faculty-report.pdf`);
    };

    // ── PRINCIPAL PDF EXPORT ──
    const exportPrincipalPDF = () => {
      const adminRoles = new Set(["committee", "principle", "vice principle", "director", "internal committee"]);
      const faculty = staffList.filter((s: any) => !adminRoles.has(String(s.role || "").toLowerCase()));

      const deptMap: Record<string, any[]> = {};
      const deans: any[] = [];
      faculty.forEach((s: any) => {
        if (String(s.role || "").toLowerCase().includes("dean")) deans.push(s);
        else if (s.department) {
          if (!deptMap[s.department]) deptMap[s.department] = [];
          deptMap[s.department].push(s);
        }
      });

      const depts = Object.entries(deptMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, staff]) => ({ name, staff }));
      if (deans.length) depts.push({ name: "Deans", staff: deans });

      buildFacultyPDF(depts, displayName, "Head of Department");
    };

    // ── HOD PDF EXPORT ──
    const exportHodPDF = () => {
      const dept = user.department || "Department";
      buildFacultyPDF(
        [{ name: dept, staff: staffList }],
        "Principal",
        user.name || user.email || "HOD",
      );
    };

    // ── HOD EXCEL EXPORT ──
    const exportHodExcel = () => {
      const collegeName = String(user.college || "VISHNU INSTITUTE OF TECHNOLOGY").toUpperCase();
      const dept = user.department || "Department";
      const NCOLS = 7;
      const HEADERS = ["S.No", "Name of the Faculty", "Designation", "Submissions", "Score", "Target", "Status"];
      const WIDTHS = [{ wch: 6 }, { wch: 32 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 18 }];

      const getStatus = (subs: any[]) => {
        if (!subs.length) return "Not Submitted";
        if (subs.some((s: any) => ["accepted", "appeal-resolved", "auto-approved", "appeal-expired"].includes(s.status)))
          return subs.some((s: any) => s.status === "submitted") ? "Partially Reviewed" : "Completed";
        if (subs.some((s: any) => s.status === "appealed")) return "Appealed";
        return "Pending Review";
      };

      const rows: any[][] = [
        [collegeName, "", "", "", "", "", ""],
        [dept, "", "", "", "", "", ""],
        HEADERS,
      ];
      const merges: XLSX.Range[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: NCOLS - 1 } },
      ];
      staffList.forEach((f: any, idx: number) => {
        const subs = f.submissions || [];
        const score = subs.reduce((sum: number, s: any) =>
          sum + Number(s.finalScore ?? s.reviewerScore ?? s.claimedScore ?? 0), 0);
        rows.push([idx + 1, f.name || f.email || "—", f.designation || "—",
          subs.length, score, f.designationTarget || "—", getStatus(subs)]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!merges"] = merges;
      ws["!cols"] = WIDTHS;
      const wb = XLSX.utils.book_new();
      const sheetName = dept.replace(/[:\\/?*[\]]/g, "").slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${collegeName.replace(/[/\\?*[\]:]/g, "-")}-${sheetName}-report.xlsx`);
    };

    return (
      <DashboardLayout
        title={`${displayName}'s Dashboard`}
        subtitle={
          user.role === "principle"
            ? "Principal View"
            : user.role === "vice principle"
              ? "Vice Principal View"
              : user.role === "director"
                ? "Director View"
                : user.role === "hod"
                  ? "HOD View"
                  : "Committee View"
        }
      >
        {user?.role !== "committee" && (
          <div className="mb-8">
            <DeadlineAlert />
          </div>
        )}

        {user?.role !== "committee" && (
          <StatusCards
            role={user?.role || "committee"}
            submissions={
              isHod || user.role === "faculty" ? submissions : undefined
            }
            committeeData={
              !(isHod || user.role === "faculty") ? committeeData : undefined
            }
          />
        )}

        {(isHod || isInternalCommittee) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {/* Score Overview */}
            <ScoreOverview
              submissions={submissions}
              userTarget={userTarget}
              targetLabel={
                userDesignationPhd !== null
                  ? userDesignationPhd
                    ? "with PhD"
                    : "without PhD"
                  : undefined
              }
            />

            {/* Right Column */}
            <div className="space-y-6">
              {/* User Profile */}
              {user && <UserProfile user={user} />}

              {/* Target Card */}
              <Card className="shadow-sm border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Your Target
                  </CardTitle>
                  <CardDescription>
                    {user?.designation || "Designation"}
                    {userDesignationPhd === true && (
                      <span className="ml-1 text-xs font-semibold text-primary">
                        (PhD)
                      </span>
                    )}
                    {userDesignationPhd === false && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (No PhD)
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>

                <CardContent className="text-center py-4">
                  <p className="text-4xl font-bold text-primary">
                    {userTarget}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {userTarget === "Not assigned" || userTarget === "Not found"
                      ? "Contact admin"
                      : "Target points"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <QuickActions />
          </div>
        )}

        {(isHod || isInternalCommittee) && (
          <>
            {/* Recent Activity */}
            <div className="mt-10 mb-10">
              <RecentActivity submissions={submissions} />
            </div>

            {/* FPMS Section */}
            <div className="mt-10 mb-10 space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  My FPMS Categories
                </h2>
                <p className="text-sm text-muted-foreground">
                  Your own annual performance submission progress
                </p>
              </div>

              <FPMSFormOverview submissions={submissions} />
            </div>
          </>
        )}

        {/* ── COMMITTEE: College-first card grid ── */}
        {user?.role === "committee" && (
          <div className="mt-8 mb-6 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <School className="h-5 w-5 text-primary" />
                  Colleges Overview
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Click any college card to explore roles and staff
                </p>
              </div>
              <Button variant="outline" onClick={exportCommitteeCollegeWiseExcel}>
                Export Excel
              </Button>
            </div>

            {/* Summary strip — counts come from committeeSummary (no cap) */}
            {(() => {
              const sumTotals = committeeSummary?.totals;
              const sumColleges = committeeSummary?.colleges || [];
              const displayStaff = sumTotals?.totalStaff ?? staffList.filter((s: any) => s.college && s.role !== "committee").length;
              const displaySubs = sumTotals?.totalSubmissions ?? totalSubmissions;
              const displayCompleted = sumTotals?.totalCompleted ?? totalCompleted;
              const displayColleges = sumColleges.length > 0 ? sumColleges.length : Object.keys(groupedData).length;
              const completedPct = displaySubs > 0 ? Math.round((displayCompleted / displaySubs) * 100) : 0;
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="shadow-sm">
                    <CardContent className="pt-5 pb-4 text-center">
                      <p className="text-3xl font-bold text-primary">{displayColleges}</p>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                        <School className="h-3.5 w-3.5" /> Colleges
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardContent className="pt-5 pb-4 text-center">
                      <p className="text-3xl font-bold text-primary">{displayStaff}</p>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                        <Users className="h-3.5 w-3.5" /> Total Staff
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardContent className="pt-5 pb-4 text-center">
                      <p className="text-3xl font-bold text-primary">{displaySubs}</p>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                        <FileText className="h-3.5 w-3.5" /> Submissions
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardContent className="pt-5 pb-4 text-center">
                      <p className="text-3xl font-bold text-primary">{completedPct}%</p>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" /> Completed
                      </p>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}

            {/* College cards grid — uses accurate summary data when loaded */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {(committeeSummary?.colleges?.length > 0
                ? committeeSummary.colleges
                : Object.entries(groupedData)
                    .filter(([n]) => n !== "Unknown College")
                    .map(([name, roles]: any) => {
                      const cs = staffList.filter((s: any) => (s.college || "") === name);
                      const subs = cs.flatMap((s: any) => s.submissions || []);
                      const completed = subs.filter((s: any) =>
                        ["accepted", "appeal-resolved", "auto-approved", "appeal-expired"].includes(s.status),
                      ).length;
                      const appealed = subs.filter((s: any) => s.status === "appealed").length;
                      return {
                        name,
                        staffCount: cs.length,
                        roleCount: Object.keys(roles).length,
                        submissionCount: subs.length,
                        completedCount: completed,
                        appealedCount: appealed,
                        completionPct: subs.length > 0 ? Math.round((completed / subs.length) * 100) : 0,
                      };
                    })
              ).map((college: any) => {
                const collegeName = college.name;
                const isSelected = selectedCollegeDetail === collegeName;
                return (
                  <Card
                    key={collegeName}
                    className={`cursor-pointer transition-all hover:shadow-lg border-2 ${
                      isSelected ? "border-primary shadow-md" : "border-border hover:border-primary/40"
                    }`}
                    onClick={async () => {
                      if (isSelected) {
                        setSelectedCollegeDetail(null);
                        setCollegeDetailStaff([]);
                      } else {
                        setSelectedCollegeDetail(collegeName);
                        try {
                          const r = await api.get("/api/auth/dashboard-data", {
                            params: { college: collegeName },
                            headers: { "x-user-id": user.uid, "x-user-role": user.role },
                          });
                          setCollegeDetailStaff(r.data?.data?.staff || []);
                        } catch {
                          setCollegeDetailStaff(staffList.filter((s: any) => s.college === collegeName));
                        }
                      }
                    }}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-start gap-2 text-base">
                        <School className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span>{collegeName}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-muted/40 rounded-lg py-2">
                          <p className="text-lg font-bold">{college.roleCount}</p>
                          <p className="text-xs text-muted-foreground">Roles</p>
                        </div>
                        <div className="bg-muted/40 rounded-lg py-2">
                          <p className="text-lg font-bold">{college.staffCount}</p>
                          <p className="text-xs text-muted-foreground">Staff</p>
                        </div>
                        <div className="bg-muted/40 rounded-lg py-2">
                          <p className="text-lg font-bold">{college.completionPct}%</p>
                          <p className="text-xs text-muted-foreground">Completion</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="bg-muted/30 rounded-md py-1.5">
                          <span className="font-semibold">{college.submissionCount}</span>
                          <span className="text-muted-foreground ml-1">Submissions</span>
                        </div>
                        <div className={`rounded-md py-1.5 ${college.appealedCount > 0 ? "bg-amber-50 text-amber-700" : "bg-muted/30"}`}>
                          <span className="font-semibold">{college.appealedCount}</span>
                          <span className="ml-1">Appeals</span>
                        </div>
                      </div>
                      <p className="text-right text-xs text-primary font-medium">
                        {isSelected ? "▲ Hide details" : "▼ View details"}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* College Detail Panel */}
            {selectedCollegeDetail && (groupedData[selectedCollegeDetail] as any) && (
              <Card className="border-primary/20 shadow-sm overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <School className="h-5 w-5 text-primary" />
                        {selectedCollegeDetail}
                      </CardTitle>
                      <CardDescription>
                        {(collegeDetailStaff.length > 0 ? collegeDetailStaff : staffList.filter(
                          (s: any) => (s.college || "Unknown College") === selectedCollegeDetail,
                        )).filter((s: any) => s.role !== "committee").length}{" "}
                        staff — departments &amp; leadership
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCollegeDetail(null)}>
                      Close ✕
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {(() => {
                    const detailStaff = (collegeDetailStaff.length > 0 ? collegeDetailStaff : staffList.filter(
                      (s: any) => (s.college || "Unknown College") === selectedCollegeDetail,
                    )).filter((s: any) => s.role !== "committee");

                    const isLeaderRole = (role: string) => {
                      const r = String(role || "").toLowerCase().trim();
                      return r === "principle" || r === "vice principle" || r === "director" || r.includes("dean");
                    };
                    const leaders = detailStaff.filter((s: any) => isLeaderRole(s.role));
                    const deptStaff = detailStaff.filter((s: any) => !isLeaderRole(s.role));

                    const departments = deptStaff.reduce((acc: any, s: any) => {
                      const dept = s.department || "No Department";
                      if (!acc[dept]) acc[dept] = { hods: [], faculty: [], others: [] };
                      const r = String(s.role || "").toLowerCase();
                      if (r === "hod") acc[dept].hods.push(s);
                      else if (r === "faculty" || r === "internal committee") acc[dept].faculty.push(s);
                      else acc[dept].others.push(s);
                      return acc;
                    }, {});

                    const staffRow = (s: any) => {
                      const subs = s.submissions || [];
                      const claimedTotal = subs.reduce((sum: number, sub: any) => sum + Number(sub.claimedScore ?? 0), 0);
                      const reviewerTotal = subs.reduce((sum: number, sub: any) => sub.reviewerScore != null ? sum + Number(sub.reviewerScore) : sum, 0);
                      const appealTotal = subs.reduce((sum: number, sub: any) => sub.appealerScore != null ? sum + Number(sub.appealerScore) : sum, 0);
                      const finalTotal = subs.reduce((sum: number, sub: any) => sum + getConfirmedScore(sub), 0);
                      const hasAppeal = subs.some((sub: any) => sub.appealerScore != null);
                      const done = subs.filter(
                        (sub: any) => sub.status === "accepted" || sub.status === "appeal-resolved" || sub.status === "auto-approved" || sub.status === "appeal-expired",
                      ).length;
                      const pct = subs.length > 0 ? Math.round((done / subs.length) * 100) : 0;
                      return (
                        <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-3 font-medium whitespace-nowrap">{s.name || "—"}</td>
                          <td className="px-3 py-3 text-muted-foreground text-xs">{s.email || "—"}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{s.designation || "—"}</td>
                          <td className="px-3 py-3 text-center">
                            <Badge variant="outline">{subs.length}</Badge>
                          </td>
                          <td className="px-3 py-3 text-center text-muted-foreground">
                            {s.designationTarget ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-center">{claimedTotal}</td>
                          <td className="px-3 py-3 text-center">{reviewerTotal}</td>
                          <td className="px-3 py-3 text-center">{hasAppeal ? appealTotal : "—"}</td>
                          <td className="px-3 py-3 text-center font-semibold text-primary">{finalTotal}</td>
                          <td className="px-3 py-3 text-center text-xs font-medium">{pct}%</td>
                        </tr>
                      );
                    };

                    const staffTable = (rows: any[]) => (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">Name</th>
                              <th className="text-left px-3 py-2.5 font-medium">Email</th>
                              <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">Designation</th>
                              <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap">Submissions</th>
                              <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap">Target</th>
                              <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap">Claimed</th>
                              <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap">Reviewer</th>
                              <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap">Appeal</th>
                              <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap">Final</th>
                              <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap">Completion</th>
                            </tr>
                          </thead>
                          <tbody>{rows.map(staffRow)}</tbody>
                        </table>
                      </div>
                    );

                    return (
                      <>
                        {/* Departments */}
                        {Object.keys(departments).length > 0 && (
                          <div>
                            <div className="px-5 py-3 bg-muted/30 border-b flex items-center gap-2 text-sm font-semibold">
                              <BookOpen className="h-4 w-4 text-primary" /> Departments
                            </div>
                            <Accordion type="single" collapsible className="divide-y">
                              {Object.entries(departments)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([deptName, deptData]: any) => (
                                  <AccordionItem key={deptName} value={`dept-${deptName}`}>
                                    <AccordionTrigger className="px-5 py-3 hover:bg-muted/20 transition-colors data-[state=open]:bg-muted/10">
                                      <div className="flex justify-between w-full pr-4">
                                        <span className="font-medium">{deptName}</span>
                                        <div className="flex gap-3 text-xs text-muted-foreground">
                                          {deptData.hods.length > 0 && (
                                            <span>{deptData.hods.length} HOD</span>
                                          )}
                                          <span>{deptData.faculty.length} Faculty</span>
                                          {deptData.others.length > 0 && (
                                            <span>{deptData.others.length} Other</span>
                                          )}
                                        </div>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-5 pb-5 pt-3 space-y-4">
                                      {deptData.hods.length > 0 && (
                                        <div>
                                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                            HOD
                                          </p>
                                          {staffTable(deptData.hods)}
                                        </div>
                                      )}
                                      {deptData.faculty.length > 0 && (
                                        <div>
                                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                            Faculty
                                          </p>
                                          {staffTable(deptData.faculty)}
                                        </div>
                                      )}
                                      {deptData.others.length > 0 && (
                                        <div>
                                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                            Other
                                          </p>
                                          {staffTable(deptData.others)}
                                        </div>
                                      )}
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                            </Accordion>
                          </div>
                        )}

                        {/* Deans / Leadership */}
                        {leaders.length > 0 && (
                          <div className={Object.keys(departments).length > 0 ? "border-t" : ""}>
                            <div className="px-5 py-3 bg-muted/30 border-b flex items-center gap-2 text-sm font-semibold">
                              <Award className="h-4 w-4 text-primary" /> Deans &amp; Leadership
                            </div>
                            <div className="p-5">{staffTable(leaders)}</div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── COMMITTEE: Submissions & Staff Overview ── */}
        {user?.role === "committee" && (() => {
          // College list for the dropdown — prefer summary data (complete) over capped staffList
          const allColleges = committeeSummary?.colleges?.length > 0
            ? committeeSummary.colleges.map((c: any) => c.name).sort()
            : Array.from(new Set(
                staffList.filter((s: any) => s.role !== "committee" && s.college).map((s: any) => s.college).filter(Boolean)
              )).sort();

          // Detail data only available after college is selected
          const nonCommitteeStaff = overviewStaff.filter(
            (s: any) => s.role !== "committee" && s.college,
          );

          // Derive unique filter options from full dataset
          const colleges = allColleges;
          const depts = Array.from(new Set(
            nonCommitteeStaff
              .filter((s: any) => cFilterCollege === "All" || s.college === cFilterCollege)
              .map((s: any) => s.department).filter(Boolean)
          )).sort();
          const desigs = Array.from(new Set(
            nonCommitteeStaff
              .filter((s: any) =>
                (cFilterCollege === "All" || s.college === cFilterCollege) &&
                (cFilterDept === "All" || s.department === cFilterDept)
              )
              .map((s: any) => s.designation).filter(Boolean)
          )).sort();
          const roles = Array.from(new Set(nonCommitteeStaff.map((s: any) => s.role).filter(Boolean))).sort();

          // Apply all filters
          const filteredStaff = nonCommitteeStaff.filter((s: any) => {
            if (cFilterCollege !== "All" && s.college !== cFilterCollege) return false;
            if (cFilterDept !== "All" && s.department !== cFilterDept) return false;
            if (cFilterDesig !== "All" && s.designation !== cFilterDesig) return false;
            if (cFilterRole !== "All" && s.role !== cFilterRole) return false;
            if (cSearch) {
              const q = cSearch.toLowerCase();
              if (
                !String(s.name || "").toLowerCase().includes(q) &&
                !String(s.email || "").toLowerCase().includes(q) &&
                !String(s.designation || "").toLowerCase().includes(q)
              ) return false;
            }
            return true;
          });

          // All submissions from filtered staff, optionally filtered by status
          const allSubs = filteredStaff.flatMap((s: any) =>
            (s.submissions || []).map((sub: any) => ({ ...sub, staffName: s.name || s.email, staffRole: s.role, staffCollege: s.college, staffDept: s.department, staffDesig: s.designation }))
          );
          const filteredSubs = cFilterStatus === "All" ? allSubs : allSubs.filter((sub: any) => sub.status === cFilterStatus);
          const appealSubs = allSubs.filter((sub: any) => sub.status === "appealed");

          // Summary counts across full staffList (unfiltered)
          const totalAllSubs = nonCommitteeStaff.flatMap((s: any) => s.submissions || []);
          const totalAppeals = totalAllSubs.filter((s: any) => s.status === "appealed").length;
          const totalAccepted = totalAllSubs.filter((s: any) => s.status === "accepted" || s.status === "appeal-resolved" || s.status === "auto-approved" || s.status === "appeal-expired").length;
          const totalPending = totalAllSubs.filter((s: any) => s.status === "submitted").length;
          const totalTargetReached = nonCommitteeStaff.filter((s: any) => {
            if (!s.designationTarget) return false;
            const score = (s.submissions || []).reduce((sum: number, sub: any) => sum + (sub.finalScore ?? sub.reviewerScore ?? sub.claimedScore ?? 0), 0);
            return score >= Number(s.designationTarget);
          }).length;

          const resetDeptFilters = () => {
            setCFilterDept("All");
            setCFilterDesig("All");
          };

          // ── Export Overview Excel (same format as principal report) ──
          const exportOverviewExcel = () => {
            if (cFilterCollege === "All" || nonCommitteeStaff.length === 0) return;

            const HEADERS = [
              "S.No", "Name of the Faculty", "Modules", "Sub Modules", "Tasks",
              "Points", "Points Claimed", "Points given by Reviewer",
              "Appeal Points", "Final Points", "Total Points",
            ];
            const COL_WIDTHS = [
              { wch: 6 }, { wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 32 }, { wch: 8 },
              { wch: 15 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
            ];

            const buildSheetRows = (staffArr: any[]) => {
              const rows: any[][] = [HEADERS];
              const merges: any[] = [];
              const addMerge = (c: number, r1: number, r2: number) => {
                if (r2 > r1) merges.push({ s: { r: r1, c }, e: { r: r2, c } });
              };
              let sno = 1;
              for (const person of staffArr) {
                const subs: any[] = (person.submissions || person.subs || []).slice().sort((a: any, b: any) => {
                  const cn = String(a.criteriaName || "").localeCompare(String(b.criteriaName || ""));
                  if (cn !== 0) return cn;
                  const mn = String(a.moduleName || "").localeCompare(String(b.moduleName || ""));
                  if (mn !== 0) return mn;
                  return String(a.taskName || "").localeCompare(String(b.taskName || ""));
                });
                if (subs.length === 0) {
                  rows.push([sno++, person.name, "-", "-", "-", "-", "-", "-", "-", "-", "-"]);
                  continue;
                }
                const totalFinal = subs.reduce((s: number, sub: any) => s + Number(sub.finalScore ?? 0), 0);
                const criteriaMap = new Map<string, any[]>();
                for (const sub of subs) {
                  const key = sub.criteriaName || sub.formTitle || "-";
                  if (!criteriaMap.has(key)) criteriaMap.set(key, []);
                  criteriaMap.get(key)!.push(sub);
                }
                const facultyRowStart = rows.length;
                let isFirstFacultyRow = true;
                for (const [criteriaKey, critSubs] of criteriaMap) {
                  const criteriaRowStart = rows.length;
                  const subModMap = new Map<string, any[]>();
                  for (const sub of critSubs) {
                    const smKey = sub.moduleName || "-";
                    if (!subModMap.has(smKey)) subModMap.set(smKey, []);
                    subModMap.get(smKey)!.push(sub);
                  }
                  let isFirstInCriteria = true;
                  for (const [smKey, smSubs] of subModMap) {
                    const smRowStart = rows.length;
                    smSubs.forEach((sub: any, smIdx: number) => {
                      const isLast = sub === subs[subs.length - 1];
                      rows.push([
                        isFirstFacultyRow ? sno : "",
                        isFirstFacultyRow ? person.name : "",
                        isFirstInCriteria ? criteriaKey : "",
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
                    addMerge(3, smRowStart, rows.length - 1);
                  }
                  addMerge(2, criteriaRowStart, rows.length - 1);
                }
                addMerge(0, facultyRowStart, rows.length - 1);
                addMerge(1, facultyRowStart, rows.length - 1);
                sno++;
              }
              return { rows, merges };
            };

            const wb = XLSX.utils.book_new();
            const isDean = (role: string) => String(role || "").toLowerCase().includes("dean");

            const deans = nonCommitteeStaff.filter((s: any) => isDean(s.role));
            const byDept: Record<string, any[]> = {};
            nonCommitteeStaff.filter((s: any) => !isDean(s.role) && s.department).forEach((s: any) => {
              if (!byDept[s.department]) byDept[s.department] = [];
              byDept[s.department].push(s);
            });

            Object.entries(byDept).sort(([a], [b]) => a.localeCompare(b)).forEach(([dept, staff]) => {
              const safeName = dept.replace(/[:\\/?*[\]]/g, "").slice(0, 31);
              if (!staff.length) return;
              const { rows, merges } = buildSheetRows(staff);
              const ws = XLSX.utils.aoa_to_sheet(rows);
              ws["!merges"] = merges;
              ws["!cols"] = COL_WIDTHS;
              XLSX.utils.book_append_sheet(wb, ws, safeName);
            });
            if (deans.length > 0) {
              const { rows, merges } = buildSheetRows(deans);
              const ws = XLSX.utils.aoa_to_sheet(rows);
              ws["!merges"] = merges;
              ws["!cols"] = COL_WIDTHS;
              XLSX.utils.book_append_sheet(wb, ws, "Deans");
            }
            if (wb.SheetNames.length === 0) return;
            XLSX.writeFile(wb, `${cFilterCollege.replace(/[/\\?*[\]:]/g, "-")}-report.xlsx`);
          };

          return (
            <div className="mt-10 mb-6 space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Submissions &amp; Staff Overview
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Live view of all staff submissions across colleges — filter, search, and track
                  </p>
                </div>
                {cFilterCollege !== "All" && nonCommitteeStaff.length > 0 && (
                  <Button variant="outline" onClick={exportOverviewExcel} className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" /> Export Report
                  </Button>
                )}
              </div>

              {/* Summary Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Total Staff", value: cFilterCollege === "All" ? "—" : nonCommitteeStaff.length, icon: Users, color: "text-primary", bg: "bg-primary/10" },
                  { label: "Submissions", value: cFilterCollege === "All" ? "—" : totalAllSubs.length, icon: FileText, color: "text-blue-600", bg: "bg-blue-500/10" },
                  { label: "Pending Review", value: cFilterCollege === "All" ? "—" : totalPending, icon: CircleDot, color: "text-amber-600", bg: "bg-amber-500/10" },
                  { label: "Accepted", value: cFilterCollege === "All" ? "—" : totalAccepted, icon: CircleCheck, color: "text-green-600", bg: "bg-green-500/10" },
                  { label: "Appeals", value: cFilterCollege === "All" ? "—" : totalAppeals, icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <Card key={label} className="shadow-sm">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${bg}`}>
                          <Icon className={`h-4 w-4 ${color}`} />
                        </div>
                        <div>
                          <p className="text-xl font-bold">{value}</p>
                          <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Filter Bar */}
              <Card className="shadow-sm">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-wrap gap-3 items-end">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search name, email, designation..."
                        value={cSearch}
                        onChange={(e) => setCSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {/* College */}
                    <Select value={cFilterCollege} onValueChange={(v) => { setCFilterCollege(v); resetDeptFilters(); }}>
                      <SelectTrigger className="w-[160px]"><SelectValue placeholder="College" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Colleges</SelectItem>
                        {colleges.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* Role */}
                    <Select value={cFilterRole} onValueChange={setCFilterRole}>
                      <SelectTrigger className="w-[140px]"><SelectValue placeholder="Role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Roles</SelectItem>
                        {roles.map((r: string) => <SelectItem key={r} value={r}>{formatRoleLabel(r)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* Department */}
                    <Select value={cFilterDept} onValueChange={(v) => { setCFilterDept(v); setCFilterDesig("All"); }}>
                      <SelectTrigger className="w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Departments</SelectItem>
                        {depts.map((d: string) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* Designation */}
                    <Select value={cFilterDesig} onValueChange={setCFilterDesig}>
                      <SelectTrigger className="w-[160px]"><SelectValue placeholder="Designation" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Designations</SelectItem>
                        {desigs.map((d: string) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* Status (for submissions tab) */}
                    <Select value={cFilterStatus} onValueChange={setCFilterStatus}>
                      <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Statuses</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="reviewed">Under Review</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="appealed">Appealed</SelectItem>
                        <SelectItem value="appeal-resolved">Appeal Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                    {/* Reset */}
                    {(cSearch || cFilterCollege !== "All" || cFilterDept !== "All" || cFilterDesig !== "All" || cFilterRole !== "All" || cFilterStatus !== "All") && (
                      <Button variant="ghost" size="sm" onClick={() => {
                        setCSearch("");
                        setCFilterCollege("All");
                        setCFilterDept("All");
                        setCFilterDesig("All");
                        setCFilterRole("All");
                        setCFilterStatus("All");
                      }}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                  {filteredStaff.length !== nonCommitteeStaff.length && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing {filteredStaff.length} of {nonCommitteeStaff.length} staff
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Tabs: Staff | Submissions | Appeals */}
              {cFilterCollege === "All" ? (
                <Card className="shadow-sm">
                  <CardContent className="py-16 text-center text-muted-foreground">
                    <Filter className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Select a college to load data</p>
                    <p className="text-sm mt-1">Choose a college from the filter above to view staff and submissions</p>
                  </CardContent>
                </Card>
              ) : isOverviewLoading ? (
                <Card className="shadow-sm">
                  <CardContent className="py-16 text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
                    <p className="text-sm">Loading data for {cFilterCollege}...</p>
                  </CardContent>
                </Card>
              ) : (
              <Tabs value={cActiveTab} onValueChange={setCActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="staff">Staff ({filteredStaff.length})</TabsTrigger>
                  <TabsTrigger value="submissions">Submissions ({filteredSubs.length})</TabsTrigger>
                  <TabsTrigger value="appeals">Appeals ({appealSubs.length})</TabsTrigger>
                </TabsList>

                {/* ── STAFF TAB ── */}
                <TabsContent value="staff">
                  <Card className="shadow-sm rounded-xl overflow-hidden">
                    <CardContent className="p-0">
                      {filteredStaff.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">
                          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                          <p>No staff match the current filters</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/40">
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-8">#</th>
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Name</th>
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">College</th>
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Department</th>
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Designation</th>
                                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Subs</th>
                                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Score</th>
                                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Target</th>
                                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {filteredStaff.map((s: any, idx: number) => {
                                const subs = s.submissions || [];
                                const score = subs.reduce((sum: number, sub: any) => sum + (sub.finalScore ?? sub.reviewerScore ?? sub.claimedScore ?? 0), 0);
                                const maxScore = subs.reduce((sum: number, sub: any) => sum + (sub.maxMarks ?? 0), 0);
                                const target = s.designationTarget ? Number(s.designationTarget) : null;
                                const targetReached = target !== null && score >= target;
                                const hasAppealed = subs.some((sub: any) => sub.status === "appealed");
                                const hasPending = subs.some((sub: any) => sub.status === "submitted");
                                const hasAccepted = subs.some((sub: any) => sub.status === "accepted" || sub.status === "appeal-resolved" || sub.status === "auto-approved" || sub.status === "appeal-expired");
                                return (
                                  <tr key={s.id || s.uid || idx} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                                    <td className="px-4 py-3">
                                      <div className="font-medium">{s.name || s.email}</div>
                                      {s.name && s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatRoleLabel(s.role)}</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.college || "—"}</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.department || "—"}</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.designation || "—"}</td>
                                    <td className="px-4 py-3 text-center font-semibold">{subs.length}</td>
                                    <td className="px-4 py-3 text-center">
                                      <span className="font-semibold">{score}</span>
                                      {maxScore > 0 && <span className="text-muted-foreground text-xs">/{maxScore}</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {target !== null ? (
                                        targetReached
                                          ? <span className="inline-flex items-center gap-1 text-green-600 text-xs font-semibold"><CircleCheck className="h-3.5 w-3.5" /> Reached</span>
                                          : <span className="text-xs text-muted-foreground">{score}/{target}</span>
                                      ) : <span className="text-xs text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {subs.length === 0 ? (
                                        <Badge variant="outline" className="text-xs">Not Submitted</Badge>
                                      ) : hasAppealed ? (
                                        <Badge variant="warning" className="text-xs">Appealed</Badge>
                                      ) : hasPending ? (
                                        <Badge variant="secondary" className="text-xs">Pending Review</Badge>
                                      ) : hasAccepted ? (
                                        <Badge variant="success" className="text-xs">Accepted</Badge>
                                      ) : (
                                        <Badge variant="default" className="text-xs">Under Review</Badge>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── SUBMISSIONS TAB ── */}
                <TabsContent value="submissions">
                  <Card className="shadow-sm rounded-xl overflow-hidden">
                    <CardContent className="p-0">
                      {filteredSubs.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">
                          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                          <p>No submissions match the current filters</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/40">
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-8">#</th>
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Staff</th>
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">College / Dept</th>
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Form / Criteria</th>
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Module / Task</th>
                                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Claimed</th>
                                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Reviewer</th>
                                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Final</th>
                                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {filteredSubs.map((sub: any, idx: number) => {
                                const sc = statusConfig[sub.status] || { label: sub.status, variant: "outline" as const };
                                return (
                                  <tr key={sub.id || idx} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                                    <td className="px-4 py-3">
                                      <div className="font-medium text-sm">{sub.staffName}</div>
                                      <div className="text-xs text-muted-foreground">{formatRoleLabel(sub.staffRole)}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="text-xs font-medium">{sub.staffCollege}</div>
                                      <div className="text-xs text-muted-foreground">{sub.staffDept || "—"}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="text-xs font-medium">{sub.formTitle || "—"}</div>
                                      <div className="text-xs text-muted-foreground">{sub.criteriaName || "—"}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="text-xs font-medium">{sub.moduleName || "—"}</div>
                                      <div className="text-xs text-muted-foreground">{sub.taskName || "—"}</div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm">{sub.claimedScore ?? "—"}</td>
                                    <td className="px-4 py-3 text-center text-sm">{sub.reviewerScore ?? "—"}</td>
                                    <td className="px-4 py-3 text-center font-semibold text-sm">{sub.finalScore ?? sub.reviewerScore ?? sub.claimedScore ?? "—"}</td>
                                    <td className="px-4 py-3 text-center">
                                      <Badge variant={sc.variant} className="text-xs">{sc.label}</Badge>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── APPEALS TAB ── */}
                <TabsContent value="appeals">
                  <Card className="shadow-sm rounded-xl overflow-hidden">
                    <CardContent className="p-0">
                      {appealSubs.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">
                          <CircleCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                          <p>No active appeals</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/40">
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-8">#</th>
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Staff</th>
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">College / Dept</th>
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Form / Criteria</th>
                                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Task</th>
                                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Claimed</th>
                                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Reviewer Score</th>
                                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Max</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {appealSubs.map((sub: any, idx: number) => (
                                <tr key={sub.id || idx} className="hover:bg-red-50/50 transition-colors">
                                  <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                                  <td className="px-4 py-3">
                                    <div className="font-medium">{sub.staffName}</div>
                                    <div className="text-xs text-muted-foreground">{formatRoleLabel(sub.staffRole)}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-xs font-medium">{sub.staffCollege}</div>
                                    <div className="text-xs text-muted-foreground">{sub.staffDept || "—"}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-xs font-medium">{sub.formTitle || "—"}</div>
                                    <div className="text-xs text-muted-foreground">{sub.criteriaName || "—"}</div>
                                  </td>
                                  <td className="px-4 py-3 text-xs">{sub.taskName || "—"}</td>
                                  <td className="px-4 py-3 text-center text-sm">{sub.claimedScore ?? "—"}</td>
                                  <td className="px-4 py-3 text-center text-sm">{sub.reviewerScore ?? "—"}</td>
                                  <td className="px-4 py-3 text-center text-sm">{sub.maxMarks ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
              )}
            </div>
          );
        })()}

        {/* ── PRINCIPAL / VICE PRINCIPAL: Department-first layout ── */}
        {isDean && (() => {
          const adminRoles = new Set(["committee", "principle", "vice principle", "director", "internal committee"]);
          const allCollegeStaff = staffList.filter((s: any) => !adminRoles.has(String(s.role || "").toLowerCase()));
          const allCollegeSubs = allCollegeStaff.flatMap((s: any) => s.submissions || []);
          const totalSubs = allCollegeSubs.length;
          const totalAccepted = allCollegeSubs.filter((s: any) => ["accepted", "appeal-resolved", "auto-approved", "appeal-expired"].includes(s.status)).length;
          const totalPendingReview = allCollegeSubs.filter((s: any) => s.status === "submitted").length;
          const totalAppeals = allCollegeSubs.filter((s: any) => s.status === "appealed").length;

          const deptMap = allCollegeStaff
            .filter((s: any) => s.department)
            .reduce((acc: any, s: any) => {
              const dept = s.department;
              if (!acc[dept]) acc[dept] = { hods: [], faculty: [] };
              const r = String(s.role || "").toLowerCase();
              if (r === "hod") acc[dept].hods.push(s);
              else acc[dept].faculty.push(s);
              return acc;
            }, {});

          const allDeptStaff = allCollegeStaff.filter((s: any) => s.department);
          const totalWithTarget = allDeptStaff.filter((s: any) => s.designationTarget);
          const totalTargetsReached = totalWithTarget.filter((s: any) => {
            const achieved = (s.submissions || []).reduce((sum: number, sub: any) => sum + getConfirmedScore(sub), 0);
            return achieved >= Number(s.designationTarget);
          }).length;

          const filteredDepts = Object.entries(deptMap)
            .filter(([name]) => !deptCardSearch || name.toLowerCase().includes(deptCardSearch.toLowerCase()))
            .sort(([a], [b]) => a.localeCompare(b));

          const deans = staffList.filter((s: any) => {
            const r = String(s.role || "").toLowerCase();
            return r.includes("dean") || (!s.department && r !== "hod" && r !== "faculty");
          });

          const targetPct = totalWithTarget.length > 0 ? Math.round((totalTargetsReached / totalWithTarget.length) * 100) : 0;

          return (
            <div className="mt-8 mb-6 space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Departments Overview
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {user.college} · {Object.keys(deptMap).length} department{Object.keys(deptMap).length !== 1 ? "s" : ""} · {allDeptStaff.length} staff
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={exportPrincipalReport}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Summary
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportDetailedReport}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Detailed
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportPrincipalPDF}>
                    <FileText className="mr-2 h-4 w-4" /> PDF
                  </Button>
                </div>
              </div>

              {/* 6-stat summary strip */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Departments", value: Object.keys(deptMap).length, icon: BookOpen, color: "text-primary", bg: "bg-primary/10" },
                  { label: "Total Staff", value: allDeptStaff.length, icon: Users, color: "text-blue-600", bg: "bg-blue-500/10" },
                  { label: "Submissions", value: totalSubs, icon: FileText, color: "text-indigo-600", bg: "bg-indigo-500/10" },
                  { label: "Accepted", value: totalAccepted, icon: CircleCheck, color: "text-green-600", bg: "bg-green-500/10" },
                  { label: "Pending Review", value: totalPendingReview, icon: CircleDot, color: "text-amber-600", bg: "bg-amber-500/10" },
                  { label: "Appeals", value: totalAppeals, icon: AlertCircle, color: totalAppeals > 0 ? "text-red-500" : "text-muted-foreground", bg: totalAppeals > 0 ? "bg-red-500/10" : "bg-muted/30" },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <Card key={label} className="shadow-sm">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${bg}`}>
                          <Icon className={`h-4 w-4 ${color}`} />
                        </div>
                        <div>
                          <p className="text-xl font-bold">{value}</p>
                          <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Target achievement progress bar */}
              <Card className="shadow-sm">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold">Target Achievement Progress</span>
                    </div>
                    <span className="text-sm font-bold text-green-600">
                      {totalTargetsReached} / {totalWithTarget.length} staff ({targetPct}%)
                    </span>
                  </div>
                  <Progress value={targetPct} className="h-2.5" />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {totalTargetsReached} of {totalWithTarget.length} staff have reached their designation target
                  </p>
                </CardContent>
              </Card>

              {/* Department search */}
              <div className="flex items-center gap-3">
                <div className="relative max-w-xs flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search departments..."
                    value={deptCardSearch}
                    onChange={(e) => setDeptCardSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {deptCardSearch && (
                  <p className="text-sm text-muted-foreground">
                    {filteredDepts.length} of {Object.keys(deptMap).length} departments
                  </p>
                )}
              </div>

              {/* Department cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredDepts.map(([deptName, deptData]: any) => {
                  const deptAllStaff = [...deptData.hods, ...deptData.faculty];
                  const deptWithTarget = deptAllStaff.filter((s: any) => s.designationTarget);
                  const deptTargetsReached = deptWithTarget.filter((s: any) => {
                    const achieved = (s.submissions || []).reduce((sum: number, sub: any) => sum + getConfirmedScore(sub), 0);
                    return achieved >= Number(s.designationTarget);
                  }).length;
                  const deptSubs = deptAllStaff.flatMap((s: any) => s.submissions || []);
                  const deptCompleted = deptSubs.filter((s: any) => ["accepted", "appeal-resolved", "auto-approved", "appeal-expired"].includes(s.status)).length;
                  const deptAppealed = deptSubs.filter((s: any) => s.status === "appealed").length;
                  const deptPending = deptSubs.filter((s: any) => s.status === "submitted").length;
                  const completionPct = deptSubs.length > 0 ? Math.round((deptCompleted / deptSubs.length) * 100) : 0;
                  const deptTargetPct = deptWithTarget.length > 0 ? Math.round((deptTargetsReached / deptWithTarget.length) * 100) : 0;
                  const isSelected = selectedDeptDetail === deptName;

                  return (
                    <Card
                      key={deptName}
                      className={`cursor-pointer transition-all hover:shadow-lg border-2 ${
                        isSelected ? "border-primary shadow-md" : "border-border hover:border-primary/40"
                      }`}
                      onClick={() => setSelectedDeptDetail(isSelected ? null : deptName)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-start gap-2 text-base">
                          <BookOpen className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <span>{deptName}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Staff counts */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-muted/40 rounded-lg py-2 text-center">
                            <p className="text-lg font-bold">{deptData.hods.length}</p>
                            <p className="text-xs text-muted-foreground">HOD</p>
                          </div>
                          <div className="bg-muted/40 rounded-lg py-2 text-center">
                            <p className="text-lg font-bold">{deptData.faculty.length}</p>
                            <p className="text-xs text-muted-foreground">Faculty</p>
                          </div>
                        </div>

                        {/* Submission stats */}
                        <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                          <div className="bg-muted/30 rounded-md py-1.5">
                            <span className="font-semibold block">{deptSubs.length}</span>
                            <span className="text-muted-foreground">Subs</span>
                          </div>
                          <div className={`rounded-md py-1.5 ${deptPending > 0 ? "bg-amber-50 text-amber-700" : "bg-muted/30"}`}>
                            <span className="font-semibold block">{deptPending}</span>
                            <span>Pending</span>
                          </div>
                          <div className={`rounded-md py-1.5 ${deptAppealed > 0 ? "bg-red-50 text-red-600" : "bg-muted/30"}`}>
                            <span className="font-semibold block">{deptAppealed}</span>
                            <span>Appeals</span>
                          </div>
                        </div>

                        {/* Progress bars */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Completion</span>
                            <span className="font-medium">{completionPct}%</span>
                          </div>
                          <Progress value={completionPct} className="h-1.5" />
                          {deptWithTarget.length > 0 && (
                            <>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Target Reached</span>
                                <span className={`font-medium ${deptTargetPct === 100 ? "text-green-600" : ""}`}>
                                  {deptTargetsReached}/{deptWithTarget.length}
                                </span>
                              </div>
                              <Progress value={deptTargetPct} className="h-1.5" />
                            </>
                          )}
                        </div>

                        <p className="text-right text-xs text-primary font-medium">
                          {isSelected ? "▲ Hide details" : "▼ View details"}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Deans & Leadership */}
              {deans.length > 0 && (
                <Card className="border-primary/20 shadow-sm overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Award className="h-5 w-5 text-primary" />
                      Deans &amp; Leadership
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left px-4 py-2.5 font-medium">Name</th>
                            <th className="text-left px-4 py-2.5 font-medium">Role</th>
                            <th className="text-left px-4 py-2.5 font-medium">Designation</th>
                            <th className="text-center px-4 py-2.5 font-medium">Subs</th>
                            <th className="text-center px-4 py-2.5 font-medium">Score / Target</th>
                            <th className="text-center px-4 py-2.5 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deans.map((s: any) => {
                            const subs = s.submissions || [];
                            const achieved = subs.reduce((sum: number, sub: any) => sum + getConfirmedScore(sub), 0);
                            const target = s.designationTarget ? Number(s.designationTarget) : null;
                            const targetReached = target !== null && achieved >= target;
                            const accepted = subs.filter((sub: any) => ["accepted", "appeal-resolved", "auto-approved", "appeal-expired"].includes(sub.status)).length;
                            const appealed = subs.filter((sub: any) => sub.status === "appealed").length;
                            const pending = subs.filter((sub: any) => sub.status === "submitted").length;
                            return (
                              <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                                <td className="px-4 py-3 font-medium">{s.name || "—"}</td>
                                <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{formatRoleLabel(s.role || "")}</td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">{s.designation || "—"}</td>
                                <td className="px-4 py-3 text-center"><Badge variant="outline">{subs.length}</Badge></td>
                                <td className="px-4 py-3 text-center">
                                  {target !== null ? (
                                    targetReached
                                      ? <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs"><CircleCheck className="h-3.5 w-3.5" />{achieved}/{target}</span>
                                      : <span className="text-xs text-muted-foreground">{achieved} / {target}</span>
                                  ) : (
                                    <span className="font-semibold text-primary">{achieved}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {subs.length === 0 ? (
                                    <Badge variant="outline">Not Submitted</Badge>
                                  ) : appealed > 0 ? (
                                    <Badge variant="warning">{appealed} Appeal{appealed > 1 ? "s" : ""}</Badge>
                                  ) : pending > 0 ? (
                                    <Badge variant="secondary">{pending} Pending</Badge>
                                  ) : accepted > 0 ? (
                                    <Badge variant="success">{accepted} Accepted</Badge>
                                  ) : (
                                    <Badge variant="default">Under Review</Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Department Detail Panel */}
              {selectedDeptDetail && deptMap[selectedDeptDetail] && (
                <Card className="border-primary/20 shadow-sm overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <BookOpen className="h-5 w-5 text-primary" />
                          {selectedDeptDetail}
                        </CardTitle>
                        <CardDescription>
                          {deptMap[selectedDeptDetail].hods.length} HOD · {deptMap[selectedDeptDetail].faculty.length} Faculty
                        </CardDescription>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedDeptDetail(null)}>
                        Close ✕
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {(() => {
                      const staffRow = (s: any) => {
                        const subs = s.submissions || [];
                        const achieved = subs.reduce((sum: number, sub: any) => sum + Number(sub.finalScore ?? sub.reviewerScore ?? sub.claimedScore ?? 0), 0);
                        const maxScore = subs.reduce((sum: number, sub: any) => sum + (sub.maxMarks ?? 0), 0);
                        const target = s.designationTarget ? Number(s.designationTarget) : null;
                        const targetReached = target !== null && achieved >= target;
                        const done = subs.filter((sub: any) => ["accepted", "appeal-resolved", "auto-approved", "appeal-expired"].includes(sub.status)).length;
                        const hasAppealed = subs.some((sub: any) => sub.status === "appealed");
                        const hasPending = subs.some((sub: any) => sub.status === "submitted");
                        const pct = subs.length > 0 ? Math.round((done / subs.length) * 100) : 0;
                        const scorePct = maxScore > 0 ? Math.min(100, (achieved / maxScore) * 100) : 0;
                        return (
                          <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium">{s.name || "—"}</div>
                              {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{s.designation || "—"}</td>
                            <td className="px-4 py-3 text-center"><Badge variant="outline">{subs.length}</Badge></td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-center gap-1 min-w-[90px]">
                                <span className="font-semibold text-sm">
                                  {achieved}
                                  {maxScore > 0 && <span className="text-muted-foreground font-normal text-xs">/{maxScore}</span>}
                                </span>
                                {maxScore > 0 && <Progress value={scorePct} className="h-1.5 w-20" />}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {target !== null ? (
                                targetReached
                                  ? <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs"><CircleCheck className="h-3.5 w-3.5" /> Reached</span>
                                  : <span className="text-xs text-muted-foreground">{achieved}/{target}</span>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center text-xs font-medium">{pct}%</td>
                            <td className="px-4 py-3 text-center">
                              {subs.length === 0 ? (
                                <Badge variant="outline" className="text-xs">Not Submitted</Badge>
                              ) : hasAppealed ? (
                                <Badge variant="warning" className="text-xs">Appealed</Badge>
                              ) : hasPending ? (
                                <Badge variant="secondary" className="text-xs">Pending</Badge>
                              ) : done > 0 ? (
                                <Badge variant="success" className="text-xs">Accepted</Badge>
                              ) : (
                                <Badge variant="default" className="text-xs">Under Review</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      };
                      const staffTable = (rows: any[]) => (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/30">
                                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                                <th className="text-left px-4 py-2.5 font-medium">Designation</th>
                                <th className="text-center px-4 py-2.5 font-medium">Subs</th>
                                <th className="text-center px-4 py-2.5 font-medium">Score</th>
                                <th className="text-center px-4 py-2.5 font-medium">Target</th>
                                <th className="text-center px-4 py-2.5 font-medium">Done%</th>
                                <th className="text-center px-4 py-2.5 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody>{rows.map(staffRow)}</tbody>
                          </table>
                        </div>
                      );
                      return (
                        <>
                          {deptMap[selectedDeptDetail].hods.length > 0 && (
                            <div>
                              <div className="px-5 py-3 bg-muted/30 border-b flex items-center gap-2 text-sm font-semibold">
                                <User className="h-4 w-4 text-primary" /> HOD
                              </div>
                              <div className="py-2">{staffTable(deptMap[selectedDeptDetail].hods)}</div>
                            </div>
                          )}
                          {deptMap[selectedDeptDetail].faculty.length > 0 && (
                            <div className={deptMap[selectedDeptDetail].hods.length > 0 ? "border-t" : ""}>
                              <div className="px-5 py-3 bg-muted/30 border-b flex items-center gap-2 text-sm font-semibold">
                                <Users className="h-4 w-4 text-primary" /> Faculty
                              </div>
                              <div className="py-2">{staffTable(deptMap[selectedDeptDetail].faculty)}</div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })()}

        {/* ── HOD: Department Faculty Dashboard ── */}
        {isHod && (
          <div className="mt-8 mb-10 space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Department Faculty Overview
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {user?.department} · {staffList.length} faculty member{staffList.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Summary Stat Cards */}
            {(() => {
              const totalFaculty = staffList.length;
              const submitted = staffList.filter((f: any) => (f.submissions?.length || 0) > 0).length;
              const targetReached = staffList.filter((f: any) => {
                if (!f.designationTarget) return false;
                const score = (f.submissions || []).reduce((sum: number, s: any) => sum + (s.finalScore ?? s.reviewerScore ?? s.claimedScore ?? 0), 0);
                return score >= Number(f.designationTarget);
              }).length;
              const pendingReview = staffList.filter((f: any) =>
                (f.submissions || []).some((s: any) => s.status === "submitted")
              ).length;

              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="shadow-sm">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{totalFaculty}</p>
                          <p className="text-xs text-muted-foreground">Total Faculty</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <FileText className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{submitted}</p>
                          <p className="text-xs text-muted-foreground">Submitted</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/10">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{targetReached}</p>
                          <p className="text-xs text-muted-foreground">Target Reached</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                          <CircleDot className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{pendingReview}</p>
                          <p className="text-xs text-muted-foreground">Pending Review</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}

            {/* Faculty Table */}
            <Card className="shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between gap-4 bg-gradient-to-r from-primary/5 to-primary/10">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    Faculty Details
                  </CardTitle>
                  <CardDescription>Submission scores and status for each faculty member</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <div className="relative w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search faculty..."
                      value={hodSearch}
                      onChange={(e) => setHodSearch(e.target.value)}
                      className="pl-9 bg-background"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={exportHodExcel}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportHodPDF}>
                    <FileText className="mr-2 h-4 w-4" /> Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {(() => {
                  const filtered = staffList.filter((f: any) =>
                    !hodSearch || (f.name || f.email || "").toLowerCase().includes(hodSearch.toLowerCase()) ||
                    (f.designation || "").toLowerCase().includes(hodSearch.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <div className="py-16 text-center text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No faculty found</p>
                        {hodSearch && <p className="text-sm mt-1">Try a different search term</p>}
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground w-10">#</th>
                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Name</th>
                            <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Designation</th>
                            <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Submissions</th>
                            <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Score</th>
                            <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Target</th>
                            <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filtered.map((faculty: any, idx: number) => {
                            const subs = faculty.submissions || [];
                            const totalSubs = subs.length;
                            const finalScore = subs.reduce((sum: number, s: any) => sum + (s.finalScore ?? s.reviewerScore ?? s.claimedScore ?? 0), 0);
                            const maxScore = subs.reduce((sum: number, s: any) => sum + (s.maxMarks ?? 0), 0);
                            const target = faculty.designationTarget ? Number(faculty.designationTarget) : null;
                            const targetReached = target !== null && finalScore >= target;
                            const hasAccepted = subs.some((s: any) => s.status === "accepted" || s.status === "appeal-resolved" || s.status === "auto-approved" || s.status === "appeal-expired");
                            const hasPending = subs.some((s: any) => s.status === "submitted");
                            const hasAppealed = subs.some((s: any) => s.status === "appealed");
                            const progress = maxScore > 0 ? Math.min(100, (finalScore / maxScore) * 100) : 0;

                            return (
                              <tr key={faculty.id || faculty.uid || idx} className="hover:bg-muted/30 transition-colors">
                                <td className="px-5 py-3.5 text-muted-foreground">{idx + 1}</td>
                                <td className="px-5 py-3.5">
                                  <div className="font-medium">{faculty.name || faculty.email}</div>
                                  {faculty.email && faculty.name && (
                                    <div className="text-xs text-muted-foreground">{faculty.email}</div>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-muted-foreground">{faculty.designation || "—"}</td>
                                <td className="px-5 py-3.5 text-center">
                                  <span className="font-semibold">{totalSubs}</span>
                                </td>
                                <td className="px-5 py-3.5">
                                  <div className="flex flex-col items-center gap-1 min-w-[90px]">
                                    <span className="font-semibold text-sm">{finalScore}<span className="text-muted-foreground font-normal text-xs">/{maxScore}</span></span>
                                    {maxScore > 0 && (
                                      <Progress value={progress} className="h-1.5 w-20" />
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-center">
                                  {target !== null ? (
                                    targetReached ? (
                                      <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs">
                                        <CircleCheck className="h-4 w-4" /> Reached
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">{finalScore}/{target}</span>
                                    )
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-center">
                                  {totalSubs === 0 ? (
                                    <Badge variant="outline" className="text-xs">Not Submitted</Badge>
                                  ) : hasAppealed ? (
                                    <Badge variant="warning" className="text-xs">Appealed</Badge>
                                  ) : hasPending ? (
                                    <Badge variant="secondary" className="text-xs">Pending Review</Badge>
                                  ) : hasAccepted ? (
                                    <Badge variant="success" className="text-xs">Accepted</Badge>
                                  ) : (
                                    <Badge variant="default" className="text-xs">Under Review</Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}


        {/* ── Staff & Submissions Explorer (principal / HOD / IC) ── */}
        {["principle", "vice principle", "director", "hod", "internal committee"].includes(user?.role || "") && (
          <div className="mt-8 mb-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  Staff &amp; Submissions Explorer
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Filter by role, department, staff member, criteria or module
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={exportFilteredExcel} disabled={filteredData.length === 0} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Export Excel
              </Button>
            </div>

            {/* Modern filter bar */}
            <Card className="shadow-sm">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <Select value={selectedRole} onValueChange={(v) => { setSelectedRole(v); setSelectedDepartment("All"); setSelectedStaff("All"); setSelectedCriteria("All"); setSelectedModule("All"); }}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Roles</SelectItem>
                      {staffList.map((s: any) => s.role).filter((v: any, i: any, a: any) => v && a.indexOf(v) === i).sort().map((r: string) => (
                        <SelectItem key={r} value={r}>{formatRoleLabel(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedDepartment} onValueChange={(v) => { setSelectedDepartment(v); setSelectedStaff("All"); setSelectedCriteria("All"); setSelectedModule("All"); }}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Department" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Departments</SelectItem>
                      {staffList.filter((s: any) => selectedRole === "All" || s.role === selectedRole).map((s: any) => s.department).filter((v: any, i: any, a: any) => v && a.indexOf(v) === i).sort().map((d: string) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedStaff} onValueChange={(v) => { setSelectedStaff(v); setSelectedCriteria("All"); setSelectedModule("All"); }}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Staff Member" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Staff</SelectItem>
                      {staffList.filter((s: any) => (selectedRole === "All" || s.role === selectedRole) && (selectedDepartment === "All" || s.department === selectedDepartment)).map((s: any) => s.name).filter((v: any, i: any, a: any) => v && a.indexOf(v) === i).sort().map((n: string) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedCriteria} onValueChange={(v) => { setSelectedCriteria(v); setSelectedModule("All"); }}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Criteria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Criteria</SelectItem>
                      {staffList.filter((s: any) => (selectedRole === "All" || s.role === selectedRole) && (selectedStaff === "All" || s.name === selectedStaff)).flatMap((s: any) => s.submissions || []).map((s: any) => s.criteriaName).filter((v: any, i: any, a: any) => v && a.indexOf(v) === i).sort().map((c: string) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedModule} onValueChange={setSelectedModule}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Module" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Modules</SelectItem>
                      {staffList.filter((s: any) => (selectedRole === "All" || s.role === selectedRole) && (selectedStaff === "All" || s.name === selectedStaff)).flatMap((s: any) => s.submissions || []).filter((sub: any) => selectedCriteria === "All" || sub.criteriaName === selectedCriteria).map((sub: any) => sub.moduleName).filter((v: any, i: any, a: any) => v && a.indexOf(v) === i).sort().map((m: string) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={applyFilter}>Apply</Button>
                  {(selectedRole !== "All" || selectedDepartment !== "All" || selectedStaff !== "All" || selectedCriteria !== "All" || selectedModule !== "All") && (
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedRole("All"); setSelectedDepartment("All"); setSelectedStaff("All"); setSelectedCriteria("All"); setSelectedModule("All"); setFilteredData([]); }}>
                      Clear
                    </Button>
                  )}
                </div>
                {filteredData.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">{filteredData.length} submission{filteredData.length !== 1 ? "s" : ""} found</p>
                )}
              </CardContent>
            </Card>

            {/* Results table */}
            {filteredData.length > 0 && (
              <Card className="shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-3 bg-muted/30 border-b">
                  <CardTitle className="text-base">Results</CardTitle>
                  <p className="text-sm text-muted-foreground">{filteredData.length} submission{filteredData.length !== 1 ? "s" : ""}</p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-8">#</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Staff</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Criteria / Module</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Task</th>
                          <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Max</th>
                          <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Claimed</th>
                          <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Reviewer</th>
                          <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Final</th>
                          <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredData.map((sub: any, idx: number) => {
                          const staff = staffList.find((s: any) => (s.submissions || []).some((ss: any) => ss.id === sub.id));
                          const sc = statusConfig[sub.status] || { label: sub.status, variant: "outline" as const };
                          return (
                            <tr key={sub.id || idx} className="hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                              <td className="px-4 py-3">
                                <div className="font-medium">{staff?.name || sub.userName || "—"}</div>
                                <div className="text-xs text-muted-foreground">{staff?.department || "—"}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-xs font-medium">{sub.criteriaName || sub.formTitle || "—"}</div>
                                <div className="text-xs text-muted-foreground">{sub.moduleName || "—"}</div>
                              </td>
                              <td className="px-4 py-3 text-xs">{sub.taskName || "—"}</td>
                              <td className="px-4 py-3 text-center text-sm">{sub.maxMarks ?? "—"}</td>
                              <td className="px-4 py-3 text-center text-sm">{sub.claimedScore ?? "—"}</td>
                              <td className="px-4 py-3 text-center text-sm">{sub.reviewerScore ?? "—"}</td>
                              <td className="px-4 py-3 text-center font-semibold text-sm">{sub.finalScore ?? sub.reviewerScore ?? sub.claimedScore ?? "—"}</td>
                              <td className="px-4 py-3 text-center">
                                <Badge variant={sc.variant} className="text-xs">{sc.label}</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── PLACEHOLDER so old filter div doesn't break (removed below) ── */}
        {false && (
          <div className="mt-10 mb-10 bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Filter Submissions
                  </h3>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Refine the list using the options below
                  </p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="p-6 space-y-5">
              {/* College - only for committee */}
              {user?.role === "committee" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    College
                  </label>
                  <select
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors"
                    value={selectedCollege}
                    onChange={(e) => {
                      setSelectedCollege(e.target.value);
                      setSelectedStaff("All");
                    }}
                  >
                    <option value="All">All Colleges</option>
                    {staffList
                      .map((s) => s.college)
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .sort()
                      .map((college) => (
                        <option key={college} value={college}>
                          {college}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Role
                </label>
                <select
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors"
                  value={selectedRole}
                  onChange={(e) => {
                    setSelectedRole(e.target.value);
                    setSelectedDepartment("All");
                    setSelectedStaff("All");
                    setSelectedCriteria("All");
                    setSelectedModule("All");
                  }}
                >
                  <option value="All">All Roles</option>
                  {staffList
                    .filter(
                      (s) =>
                        selectedCollege === "All" ||
                        s.college === selectedCollege,
                    )
                    .map((s) => s.role)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .sort()
                    .map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Department
                </label>
                <select
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors"
                  value={selectedDepartment}
                  onChange={(e) => {
                    setSelectedDepartment(e.target.value);
                    setSelectedStaff("All");
                    setSelectedCriteria("All");
                    setSelectedModule("All");
                  }}
                >
                  <option value="All">All Departments</option>
                  {staffList
                    .filter(
                      (s) =>
                        (selectedCollege === "All" ||
                          s.college === selectedCollege) &&
                        (selectedRole === "All" || s.role === selectedRole),
                    )
                    .map((s) => s.department)
                    .filter((v: string, i: number, a: string[]) => v && a.indexOf(v) === i)
                    .sort()
                    .map((dept: string) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                </select>
              </div>

              {/* Staff */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Staff Member
                </label>
                <select
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors"
                  value={selectedStaff}
                  onChange={(e) => {
                    setSelectedStaff(e.target.value);
                    setSelectedCriteria("All");
                    setSelectedModule("All");
                  }}
                >
                  <option value="All">All Staff</option>
                  {staffList
                    .filter(
                      (s) =>
                        (selectedCollege === "All" ||
                          s.college === selectedCollege) &&
                        (selectedRole === "All" || s.role === selectedRole) &&
                        (selectedDepartment === "All" ||
                          s.department === selectedDepartment),
                    )
                    .map((s) => s.name)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .sort()
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Criteria */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Criteria
                </label>
                <select
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors"
                  value={selectedCriteria}
                  onChange={(e) => {
                    setSelectedCriteria(e.target.value);
                    setSelectedModule("All");
                  }}
                >
                  <option value="All">All Criteria</option>
                  {staffList
                    .filter(
                      (s) =>
                        (selectedCollege === "All" ||
                          s.college === selectedCollege) &&
                        (selectedRole === "All" || s.role === selectedRole) &&
                        (selectedStaff === "All" || s.name === selectedStaff),
                    )
                    .flatMap((s) => s.submissions || [])
                    .map((s) => s.criteriaName)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .sort()
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Module */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Module
                </label>
                <select
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors"
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                >
                  <option value="All">All Modules</option>
                  {staffList
                    .filter(
                      (s) =>
                        (selectedCollege === "All" ||
                          s.college === selectedCollege) &&
                        (selectedRole === "All" || s.role === selectedRole) &&
                        (selectedStaff === "All" || s.name === selectedStaff),
                    )
                    .flatMap((s) => s.submissions || [])
                    .filter(
                      (sub) =>
                        selectedCriteria === "All" ||
                        sub.criteriaName === selectedCriteria,
                    )
                    .map((sub) => sub.moduleName)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .sort()
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Apply + Export Buttons */}
              <div className="flex gap-3 mt-3">
                <button
                  onClick={applyFilter}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1"
                >
                  Apply Filters
                </button>
                <button
                  onClick={exportFilteredExcel}
                  disabled={filteredData.length === 0}
                  className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow transition-colors focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-1"
                >
                  Export Excel
                </button>
              </div>
            </div>
          </div>
        )}

        {filteredData.length > 0 && (
          <div className="mt-8 mb-10 bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <svg
                    className="w-5 h-5 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Filtered Submissions
                </h3>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {filteredData.map((sub) => (
                <div
                  key={sub.id}
                  className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow"
                >
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <h4 className="font-medium text-gray-900">
                      {sub.taskName}
                    </h4>
                    {/* <span 
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                statusConfig[sub.status]?.variant === "success" ? "bg-green-100 text-green-800" :
                statusConfig[sub.status]?.variant === "warning" ? "bg-yellow-100 text-yellow-800" :
                statusConfig[sub.status]?.variant === "destructive" ? "bg-red-100 text-red-800" :
                "bg-gray-100 text-gray-800"
              }`}
            >
              {statusConfig[sub.status]?.label || sub.status}
            </span> */}
                  </div>

                  <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Staff:</span>{" "}
                      {staffList.find((staff) =>
                        (staff.submissions || []).some((s) => s.id === sub.id),
                      )?.name ?? "Unknown"}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Form:</span>{" "}
                      {sub.formTitle}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">
                        Claimed:
                      </span>{" "}
                      {sub.claimedScore}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">
                        Reviewer:
                      </span>{" "}
                      {sub.reviewerScore ?? "—"}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Final:</span>{" "}
                      {sub.status === "accepted" || sub.status === "appeal-resolved" || sub.status === "auto-approved" || sub.status === "appeal-expired"
                        ? sub.finalScore
                        : "Pending"}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">
                        Max Marks:
                      </span>{" "}
                      {sub.maxMarks}
                    </div>
                  </div>
                </div>
              ))}

              {filteredData.length === 0 && (
                <div className="py-12 text-center text-gray-500">
                  No submissions match the selected filters
                </div>
              )}
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  const totalSubmissions = submissions.length;
  let totalClaimed = 0;
  let totalReviewer = 0;
  let totalFinal = 0;
  let totalMax = 0;
  let completedCount = 0;
  let appealedCount = 0;
  submissions.forEach((sub: any) => {
    totalClaimed += sub.claimedScore ?? 0;
    totalReviewer += sub.reviewerScore ?? 0;
    totalFinal += sub.finalScore ?? 0;
    totalMax += sub.maxMarks ?? 0;
    if (sub.status === "accepted" || sub.status === "appeal-resolved" || sub.status === "auto-approved" || sub.status === "appeal-expired")
      completedCount++;
    if (sub.status === "appealed") appealedCount++;
  });

  return (
    <DashboardLayout
      title={`${displayName}'s Dashboard`}
      subtitle={`Welcome back, ${displayName.split(" ")[0]}!`}
    >
      {user?.role !== "committee" && (
        <div className="mb-6">
          <DeadlineAlert
            onCompleteClick={() => {
              window.location.href = "/submit-performance";
            }}
          />
        </div>
      )}

      <div className="space-y-8">
        <StatusCards role={user?.role || "faculty"} submissions={submissions} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ScoreOverview
            submissions={submissions}
            userTarget={userTarget}
            targetLabel={
              userDesignationPhd !== null
                ? userDesignationPhd
                  ? "with PhD"
                  : "without PhD"
                : undefined
            }
          />

          {user && (
            <div className="space-y-6">
              {/* User Profile */}
              <UserProfile user={user} />

              {/* Target Card */}
              <Card className="shadow-sm border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Your Target
                  </CardTitle>
                  <CardDescription>
                    {user.designation || "Designation"}
                    {userDesignationPhd === true && (
                      <span className="ml-1 text-xs font-semibold text-primary">
                        (PhD)
                      </span>
                    )}
                    {userDesignationPhd === false && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (No PhD)
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>

                <CardContent className="text-center py-4">
                  <p className="text-4xl font-bold text-primary">
                    {userTarget}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {userTarget === "Not assigned" || userTarget === "Not found"
                      ? "Contact admin"
                      : "Target points"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <QuickActions />
        </div>

        <RecentActivity submissions={submissions}></RecentActivity>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              FPMS Categories
            </h2>
            <p className="text-sm text-muted-foreground">
              Complete all sections to submit your annual performance report
            </p>
          </div>
          <FPMSFormOverview submissions={submissions}></FPMSFormOverview>
        </div>
      </div>
    </DashboardLayout>
  );
}
