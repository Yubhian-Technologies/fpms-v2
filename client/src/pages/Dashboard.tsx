import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { api } from "@/api/api";
import { formatRoleLabel } from "@/lib/utils";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
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
  const [selectedDeptDetail, setSelectedDeptDetail] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [roleFormColumnsByRole, setRoleFormColumnsByRole] = useState<
    Record<string, string[]>
  >({});

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
        if (user.role === "committee") {
          const res = await api.get("/api/auth/dashboard-data", {
            headers: { "x-user-id": user.uid, "x-user-role": user.role },
          });
          if (res.data.success) setCommitteeData(res.data.data);
          setStaffList(res.data.data.staff || []);
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
        } else if (
          user.role === "principle" ||
          user.role === "vice principle"
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

    const rows = filteredData.map((sub: any) => {
      const staff = subToStaff[sub.id] || {};
      const finalScore =
        sub.status === "accepted" || sub.status === "appeal-resolved"
          ? (sub.finalScore ?? "")
          : "";
      const submittedAt = sub.createdAt?.seconds
        ? new Date(sub.createdAt.seconds * 1000).toLocaleDateString("en-IN")
        : "";
      const reviewedAt = sub.updatedAt?.seconds
        ? new Date(sub.updatedAt.seconds * 1000).toLocaleDateString("en-IN")
        : "";

      return {
        "Staff Name": staff.name || sub.userName || "",
        "Email": staff.email || sub.userEmail || "",
        "Role": staff.role || sub.userRole || "",
        "Department": staff.department || sub.department || "",
        "College": staff.college || sub.college || "",
        "Designation": staff.designation || "",
        "Form": sub.formTitle || "",
        "Criteria": sub.criteriaName || "",
        "Module": sub.moduleName || "",
        "Task": sub.taskName || "",
        "Claimed Score": sub.claimedScore ?? "",
        "Reviewer Score": sub.reviewerScore ?? "",
        "Final Score": finalScore,
        "Max Marks": sub.maxMarks ?? "",
        "Status": sub.status || "",
        "Appealed": sub.isAppealed ? "Yes" : "No",
        "Appeal Reason": sub.appealReason || "",
        "Requested Score": sub.appealRequestedScore ?? "",
        "Appealer Score": sub.appealerScore ?? "",
        "Description": sub.description || "",
        "Evidence URL": sub.evidence || "",
        "Submitted On": submittedAt,
        "Last Updated": reviewedAt,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto-width columns
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(
        key.length,
        ...rows.map((r: any) => String(r[key] || "").length),
      ),
    }));
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Filtered Submissions");

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `fpms-filtered-submissions-${dateStr}.xlsx`);
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

  if (user?.role === "internal committee") {
    const collegeScopedStaff = staffList.filter(
      (staff: any) =>
        String(staff.college || "")
          .trim()
          .toLowerCase() ===
        String(user.college || "")
          .trim()
          .toLowerCase(),
    );

    const getScoreColumnKey = (sub: any) => {
      const criteria = String(sub?.criteriaName || "").trim();
      if (criteria) return criteria;

      const form = String(sub?.formTitle || "").trim();
      if (form) return form;

      return "Unspecified";
    };

    const formTitles = Array.from(
      new Set(
        collegeScopedStaff.flatMap((staff: any) =>
          (staff.submissions || [])
            .map((sub: any) => getScoreColumnKey(sub))
            .filter(Boolean),
        ),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const roleDefinedColumns = Object.values(roleFormColumnsByRole).flat();
    const allScoreColumns = Array.from(
      new Set([...formTitles, ...roleDefinedColumns]),
    ).sort((a, b) => a.localeCompare(b));

    const tableRows: Array<{
      name: string;
      email: string;
      role: string;
      formScores: Record<string, number>;
      targetScore: number;
      achievedScore: number;
    }> = collegeScopedStaff.map((staff: any) => {
      const submissions = Array.isArray(staff.submissions)
        ? staff.submissions
        : [];
      const formScores: Record<string, number> = {};

      allScoreColumns.forEach((title) => {
        formScores[title] = submissions
          .filter((sub: any) => getScoreColumnKey(sub) === title)
          .reduce((sum: number, sub: any) => sum + getConfirmedScore(sub), 0);
      });

      const achievedScore = submissions.reduce(
        (sum: number, sub: any) => sum + getConfirmedScore(sub),
        0,
      );

      return {
        name: String(staff.name || ""),
        email: String(staff.email || ""),
        role: String(staff.role || ""),
        formScores,
        targetScore: Number(staff.designationTarget || 0),
        achievedScore,
      };
    });

    const rowsByRole = tableRows.reduce(
      (acc, row) => {
        const roleName = row.role || "Unknown Role";
        if (!acc[roleName]) acc[roleName] = [];
        acc[roleName].push(row);
        return acc;
      },
      {} as Record<string, Array<(typeof tableRows)[number]>>,
    );

    const sortedRoleNames = Object.keys(rowsByRole).sort((a, b) =>
      a.localeCompare(b),
    );

    const visibleRoleNames = sortedRoleNames.filter((roleName) => {
      const roleSpecificColumns =
        roleFormColumnsByRole[String(roleName || "").toLowerCase()] || [];
      return roleSpecificColumns.length > 0;
    });

    const visibleScoreColumns = Array.from(
      new Set(
        visibleRoleNames.flatMap(
          (roleName) =>
            roleFormColumnsByRole[String(roleName || "").toLowerCase()] || [],
        ),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const exportInternalCommitteeExcel = () => {
      const workbook = XLSX.utils.book_new();

      visibleRoleNames.forEach((roleName) => {
        const roleKey = String(roleName || "").toLowerCase();
        const roleColumns = roleFormColumnsByRole[roleKey] || [];
        const roleRows = (rowsByRole[roleName] || []).map((row) => {
          const base: Record<string, string | number> = {
            Name: row.name,
            Email: row.email,
            Role: row.role,
          };

          roleColumns.forEach((title) => {
            base[`${title} Score`] = Number(row.formScores[title] || 0);
          });

          base["Target Score"] = row.targetScore;
          base["Achieved Score"] = row.achievedScore;
          return base;
        });

        if (roleRows.length === 0) return;

        const worksheet = XLSX.utils.json_to_sheet(roleRows);
        const safeSheetName = String(roleName || "Role")
          .replace(/[\\/?*\[\]:]/g, "-")
          .slice(0, 31);

        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          safeSheetName || "Role",
        );
      });

      if ((workbook.SheetNames || []).length === 0) return;

      XLSX.writeFile(workbook, "internal-committee-college-users.xlsx");
    };

    return (
      <DashboardLayout
        title={`${displayName}'s Dashboard`}
        subtitle="Internal Committee View"
      >
        <Card className="shadow-sm rounded-xl overflow-hidden mt-4 mb-10">
          <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-primary/5 to-primary/10">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <Building className="h-5 w-5 text-primary" />
                College Users Overview
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1">
                {user.college || "Your college"} only
              </CardDescription>
            </div>
            <Button variant="outline" onClick={exportInternalCommitteeExcel}>
              Export Excel
            </Button>
          </CardHeader>
          <CardContent>
            {visibleRoleNames.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No roles with configured FPMS forms found for your college.
              </div>
            ) : (
              <div className="space-y-6">
                {visibleRoleNames.map((roleName) => {
                  const roleRows = rowsByRole[roleName] || [];
                  const roleSpecificColumns =
                    roleFormColumnsByRole[
                      String(roleName || "").toLowerCase()
                    ] || [];
                  const visibleColumns = roleSpecificColumns;
                  return (
                    <Card
                      key={roleName}
                      className="overflow-hidden border shadow-sm"
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base capitalize">
                          {roleName}
                        </CardTitle>
                        <CardDescription>
                          {roleRows.length} user{roleRows.length > 1 ? "s" : ""}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/40">
                              <th className="text-left px-4 py-3 font-medium">
                                Name
                              </th>
                              <th className="text-left px-4 py-3 font-medium">
                                Email
                              </th>
                              {visibleColumns.map((title) => (
                                <th
                                  key={`${roleName}-${title}`}
                                  className="text-left px-4 py-3 font-medium whitespace-nowrap"
                                >
                                  {title} Score
                                </th>
                              ))}
                              <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                                Target Score
                              </th>
                              <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                                Achieved Score
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {roleRows.map((row, index) => (
                              <tr
                                key={`${roleName}-${row.email}-${index}`}
                                className="border-b last:border-b-0"
                              >
                                <td className="px-4 py-3">{row.name || "-"}</td>
                                <td className="px-4 py-3">
                                  {row.email || "-"}
                                </td>
                                {visibleColumns.map((title) => (
                                  <td
                                    key={`${roleName}-${row.email}-${title}`}
                                    className="px-4 py-3"
                                  >
                                    {Number(row.formScores[title] || 0)}
                                  </td>
                                ))}
                                <td className="px-4 py-3">{row.targetScore}</td>
                                <td className="px-4 py-3">
                                  {row.achievedScore}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (
    ["committee", "principle", "vice principle", "hod"].includes(
      user?.role || "",
    )
  ) {
    const isHod = user?.role === "hod";
    const isDean =
      user?.role === "principle" || user?.role === "vice principle";

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
          if (sub.status === "accepted" || sub.status === "appeal-resolved")
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
      if (sub.status === "accepted" || sub.status === "appeal-resolved")
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

    return (
      <DashboardLayout
        title={`${displayName}'s Dashboard`}
        subtitle={
          user.role === "principle"
            ? "Principal View"
            : user.role === "vice principle"
              ? "Vice Principal View"
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

        {isHod && (
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

        {isHod && (
          <>
            {/* Recent Activity */}
            <div className="mt-10 mb-10">
              <RecentActivity
                submissions={
                  isHod
                    ? submissions
                    : staffList.flatMap((s) => s.submissions || [])
                }
              />
            </div>

            {/* FPMS Section */}
            <div className="mt-10 mb-10 space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  FPMS Categories
                </h2>
                <p className="text-sm text-muted-foreground">
                  Complete all sections to submit your annual performance report
                </p>
              </div>

              <FPMSFormOverview
                submissions={
                  isHod
                    ? submissions
                    : staffList.flatMap((s) => s.submissions || [])
                }
              />
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

            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="shadow-sm">
                <CardContent className="pt-5 pb-4 text-center">
                  <p className="text-3xl font-bold text-primary">{Object.keys(groupedData).length}</p>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <School className="h-3.5 w-3.5" /> Colleges
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="pt-5 pb-4 text-center">
                  <p className="text-3xl font-bold text-primary">{staffList.filter((s: any) => s.college && s.role !== "committee").length}</p>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <Users className="h-3.5 w-3.5" /> Total Staff
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="pt-5 pb-4 text-center">
                  <p className="text-3xl font-bold text-primary">{totalSubmissions}</p>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> Submissions
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="pt-5 pb-4 text-center">
                  <p className="text-3xl font-bold text-primary">
                    {totalSubmissions > 0 ? Math.round((totalCompleted / totalSubmissions) * 100) : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Completed
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* College cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Object.entries(groupedData)
                .filter(([collegeName]) => collegeName !== "Unknown College")
                .map(([collegeName, roles]: any) => {
                const collegeStaff = staffList.filter(
                  (s: any) => (s.college || "Unknown College") === collegeName,
                );
                const collegeSubs = collegeStaff.flatMap(
                  (s: any) => s.submissions || [],
                );
                const collegeCompleted = collegeSubs.filter(
                  (s: any) =>
                    s.status === "accepted" || s.status === "appeal-resolved",
                ).length;
                const collegeAppeals = collegeSubs.filter(
                  (s: any) => s.status === "appealed",
                ).length;
                const completionPct =
                  collegeSubs.length > 0
                    ? Math.round((collegeCompleted / collegeSubs.length) * 100)
                    : 0;
                const staffWithTarget = collegeStaff.filter(
                  (s: any) => s.designationTarget,
                );
                const targetsReached = staffWithTarget.filter((s: any) => {
                  const achieved = (s.submissions || []).reduce(
                    (sum: number, sub: any) =>
                      sum + getConfirmedScore(sub),
                    0,
                  );
                  return achieved >= Number(s.designationTarget);
                }).length;
                const isSelected = selectedCollegeDetail === collegeName;

                return (
                  <Card
                    key={collegeName}
                    className={`cursor-pointer transition-all hover:shadow-lg border-2 ${
                      isSelected
                        ? "border-primary shadow-md"
                        : "border-border hover:border-primary/40"
                    }`}
                    onClick={() =>
                      setSelectedCollegeDetail(isSelected ? null : collegeName)
                    }
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
                          <p className="text-lg font-bold">{Object.keys(roles).length}</p>
                          <p className="text-xs text-muted-foreground">Roles</p>
                        </div>
                        <div className="bg-muted/40 rounded-lg py-2">
                          <p className="text-lg font-bold">{collegeStaff.length}</p>
                          <p className="text-xs text-muted-foreground">Staff</p>
                        </div>
                        <div className={`rounded-lg py-2 ${targetsReached === staffWithTarget.length && staffWithTarget.length > 0 ? "bg-green-100" : "bg-muted/40"}`}>
                          <p className={`text-lg font-bold ${targetsReached === staffWithTarget.length && staffWithTarget.length > 0 ? "text-green-700" : ""}`}>
                            {targetsReached}
                            <span className="text-sm font-normal text-muted-foreground"> / {staffWithTarget.length}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">Target Reached</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Completion</span>
                          <span className="font-medium">{completionPct}%</span>
                        </div>
                        <Progress value={completionPct} className="h-2" />
                      </div>
                      {collegeAppeals > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {collegeAppeals} pending appeal{collegeAppeals > 1 ? "s" : ""}
                        </div>
                      )}
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
                        {staffList.filter(
                          (s: any) =>
                            (s.college || "Unknown College") === selectedCollegeDetail &&
                            s.role !== "committee",
                        ).length}{" "}
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
                    const detailStaff = staffList.filter(
                      (s: any) =>
                        (s.college || "Unknown College") === selectedCollegeDetail &&
                        s.role !== "committee",
                    );

                    const leaderRoles = ["principle", "vice principle", "dean", "vice dean"];
                    const leaders = detailStaff.filter((s: any) =>
                      leaderRoles.includes(String(s.role || "").toLowerCase()),
                    );
                    const deptStaff = detailStaff.filter(
                      (s: any) =>
                        !leaderRoles.includes(String(s.role || "").toLowerCase()),
                    );

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
                      const achieved = subs.reduce(
                        (sum: number, sub: any) =>
                          sum + getConfirmedScore(sub),
                        0,
                      );
                      const done = subs.filter(
                        (sub: any) => sub.status === "accepted" || sub.status === "appeal-resolved",
                      ).length;
                      const pct = subs.length > 0 ? Math.round((done / subs.length) * 100) : 0;
                      return (
                        <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{s.name || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{s.email || "—"}</td>
                          <td className="px-4 py-3">{s.designation || "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline">{subs.length}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center font-medium">
                            {achieved}{s.designationTarget ? ` / ${s.designationTarget}` : ""}
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-medium">{pct}%</td>
                        </tr>
                      );
                    };

                    const staffTable = (rows: any[]) => (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left px-4 py-2.5 font-medium">Name</th>
                              <th className="text-left px-4 py-2.5 font-medium">Email</th>
                              <th className="text-left px-4 py-2.5 font-medium">Designation</th>
                              <th className="text-center px-4 py-2.5 font-medium">Submissions</th>
                              <th className="text-center px-4 py-2.5 font-medium">Score</th>
                              <th className="text-center px-4 py-2.5 font-medium">Completion</th>
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

        {/* ── PRINCIPAL / VICE PRINCIPAL: Department-first layout ── */}
        {isDean && (
          <div className="mt-8 mb-6 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Departments Overview
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Click any department card to explore HOD and faculty
                </p>
              </div>
            </div>

            {/* Summary strip */}
            {(() => {
              const deptMap = staffList
                .filter((s: any) => s.department)
                .reduce((acc: any, s: any) => {
                  const dept = s.department;
                  if (!acc[dept]) acc[dept] = { hods: [], faculty: [] };
                  const r = String(s.role || "").toLowerCase();
                  if (r === "hod") acc[dept].hods.push(s);
                  else acc[dept].faculty.push(s);
                  return acc;
                }, {});

              const allDeptStaff = staffList.filter((s: any) => s.department);
              const totalWithTarget = allDeptStaff.filter((s: any) => s.designationTarget);
              const totalTargetsReached = totalWithTarget.filter((s: any) => {
                const achieved = (s.submissions || []).reduce(
                  (sum: number, sub: any) =>
                    sum + getConfirmedScore(sub),
                  0,
                );
                return achieved >= Number(s.designationTarget);
              }).length;

              return (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="shadow-sm">
                      <CardContent className="pt-5 pb-4 text-center">
                        <p className="text-3xl font-bold text-primary">{Object.keys(deptMap).length}</p>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                          <BookOpen className="h-3.5 w-3.5" /> Departments
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                      <CardContent className="pt-5 pb-4 text-center">
                        <p className="text-3xl font-bold text-primary">{allDeptStaff.length}</p>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                          <Users className="h-3.5 w-3.5" /> Total Staff
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                      <CardContent className="pt-5 pb-4 text-center">
                        <p className="text-3xl font-bold text-primary">
                          {totalTargetsReached}
                          <span className="text-lg font-normal text-muted-foreground"> / {totalWithTarget.length}</span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Targets Reached
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Department cards grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {Object.entries(deptMap)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([deptName, deptData]: any) => {
                        const deptAllStaff = [...deptData.hods, ...deptData.faculty];
                        const deptWithTarget = deptAllStaff.filter((s: any) => s.designationTarget);
                        const deptTargetsReached = deptWithTarget.filter((s: any) => {
                          const achieved = (s.submissions || []).reduce(
                            (sum: number, sub: any) =>
                              sum + getConfirmedScore(sub),
                            0,
                          );
                          return achieved >= Number(s.designationTarget);
                        }).length;
                        const deptSubs = deptAllStaff.flatMap((s: any) => s.submissions || []);
                        const deptCompleted = deptSubs.filter(
                          (s: any) => s.status === "accepted" || s.status === "appeal-resolved",
                        ).length;
                        const completionPct = deptSubs.length > 0
                          ? Math.round((deptCompleted / deptSubs.length) * 100)
                          : 0;
                        const isSelected = selectedDeptDetail === deptName;

                        return (
                          <Card
                            key={deptName}
                            className={`cursor-pointer transition-all hover:shadow-lg border-2 ${
                              isSelected
                                ? "border-primary shadow-md"
                                : "border-border hover:border-primary/40"
                            }`}
                            onClick={() => setSelectedDeptDetail(isSelected ? null : deptName)}
                          >
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-start gap-2 text-base">
                                <BookOpen className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                                <span>{deptName}</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-muted/40 rounded-lg py-2">
                                  <p className="text-lg font-bold">{deptData.hods.length}</p>
                                  <p className="text-xs text-muted-foreground">HOD</p>
                                </div>
                                <div className="bg-muted/40 rounded-lg py-2">
                                  <p className="text-lg font-bold">{deptData.faculty.length}</p>
                                  <p className="text-xs text-muted-foreground">Faculty</p>
                                </div>
                                <div className={`rounded-lg py-2 ${deptTargetsReached === deptWithTarget.length && deptWithTarget.length > 0 ? "bg-green-100" : "bg-muted/40"}`}>
                                  <p className={`text-lg font-bold ${deptTargetsReached === deptWithTarget.length && deptWithTarget.length > 0 ? "text-green-700" : ""}`}>
                                    {deptTargetsReached}
                                    <span className="text-sm font-normal text-muted-foreground"> / {deptWithTarget.length}</span>
                                  </p>
                                  <p className="text-xs text-muted-foreground">Target Reached</p>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Completion</span>
                                  <span className="font-medium">{completionPct}%</span>
                                </div>
                                <Progress value={completionPct} className="h-2" />
                              </div>
                              <p className="text-right text-xs text-primary font-medium">
                                {isSelected ? "▲ Hide details" : "▼ View details"}
                              </p>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>

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
                            const achieved = subs.reduce(
                              (sum: number, sub: any) =>
                                sum + getConfirmedScore(sub),
                              0,
                            );
                            const done = subs.filter(
                              (sub: any) => sub.status === "accepted" || sub.status === "appeal-resolved",
                            ).length;
                            const pct = subs.length > 0 ? Math.round((done / subs.length) * 100) : 0;
                            return (
                              <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                                <td className="px-4 py-3 font-medium">{s.name || "—"}</td>
                                <td className="px-4 py-3 text-muted-foreground text-xs">{s.email || "—"}</td>
                                <td className="px-4 py-3">{s.designation || "—"}</td>
                                <td className="px-4 py-3 text-center"><Badge variant="outline">{subs.length}</Badge></td>
                                <td className="px-4 py-3 text-center font-medium">
                                  {achieved}{s.designationTarget ? ` / ${s.designationTarget}` : ""}
                                </td>
                                <td className="px-4 py-3 text-center text-xs font-medium">{pct}%</td>
                              </tr>
                            );
                          };
                          const staffTable = (rows: any[]) => (
                            <div className="overflow-x-auto rounded-lg border">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-muted/30">
                                    <th className="text-left px-4 py-2.5 font-medium">Name</th>
                                    <th className="text-left px-4 py-2.5 font-medium">Email</th>
                                    <th className="text-left px-4 py-2.5 font-medium">Designation</th>
                                    <th className="text-center px-4 py-2.5 font-medium">Submissions</th>
                                    <th className="text-center px-4 py-2.5 font-medium">Score</th>
                                    <th className="text-center px-4 py-2.5 font-medium">Completion</th>
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
                                  <div className="p-5">{staffTable(deptMap[selectedDeptDetail].hods)}</div>
                                </div>
                              )}
                              {deptMap[selectedDeptDetail].faculty.length > 0 && (
                                <div className={deptMap[selectedDeptDetail].hods.length > 0 ? "border-t" : ""}>
                                  <div className="px-5 py-3 bg-muted/30 border-b flex items-center gap-2 text-sm font-semibold">
                                    <Users className="h-4 w-4 text-primary" /> Faculty
                                  </div>
                                  <div className="p-5">{staffTable(deptMap[selectedDeptDetail].faculty)}</div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* ── HOD: Department Staff Overview ── */}
        {isHod && (
          <Card className="shadow-sm rounded-xl overflow-hidden mt-8 mb-10">
            <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-primary/5 to-primary/10">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <Building className="h-5 w-5 text-primary" />
                  {isHod
                    ? "Department Staff Overview"
                    : "College → Role → Staff Overview"}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {isHod
                    ? "Browse staff members in your department and their submissions"
                    : "Browse institutions, roles, staff, and their detailed submissions with counts"}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Accordion type="single" collapsible className="divide-y">
              {Object.entries(groupedData).map(([collegeName, roles]: any) => {
                const collegeStaffCount = (
                  Object.values(roles) as any[]
                ).reduce(
                  (sum: number, staffArray: any) => sum + staffArray.length,
                  0,
                );
                const collegeRolesCount = Object.keys(roles).length;
                return (
                  <AccordionItem key={collegeName} value={collegeName}>
                    <AccordionTrigger className="px-6 py-4 text-xl font-bold hover:bg-muted/50 transition-colors data-[state=open]:bg-muted/30">
                      <div className="flex justify-between w-full pr-4">
                        <span>{collegeName}</span>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" /> {collegeRolesCount}{" "}
                            Roles
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" /> {collegeStaffCount}{" "}
                            Staff
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-4 bg-background">
                      <Accordion type="single" collapsible className="divide-y">
                        {Object.entries(roles).map(
                          ([roleName, staffArray]: any) => {
                            const roleStaffCount = staffArray.length;
                            return (
                              <AccordionItem
                                key={roleName}
                                value={`${collegeName}-${roleName}`}
                              >
                                <AccordionTrigger className="px-5 py-3 text-lg font-semibold hover:bg-secondary/20 transition-colors data-[state=open]:bg-secondary/10">
                                  <div className="flex justify-between w-full pr-4">
                                    <span>{formatRoleLabel(roleName)}</span>
                                    <Badge
                                      variant="outline"
                                      className="text-sm"
                                    >
                                      {roleStaffCount} Staff
                                    </Badge>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-5 pb-4 bg-background">
                                  <Accordion type="single" collapsible>
                                    {staffArray.map((staff: any) => {
                                      const staffSubmissionsCount =
                                        staff.submissions?.length || 0;
                                      let staffTotalFinal = 0;
                                      let staffTotalMax = 0;
                                      let staffTotalClaimed = 0;
                                      let staffTotalReviewer = 0;
                                      let staffAppealedCount = 0;
                                      let staffCompletedCount = 0;

                                      staff.submissions?.forEach((sub: any) => {
                                        const effectiveFinal =
                                          sub.finalScore ??
                                          sub.reviewerScore ??
                                          sub.claimedScore ??
                                          0;
                                        staffTotalFinal += effectiveFinal;
                                        staffTotalMax += sub.maxMarks ?? 0;
                                        staffTotalClaimed +=
                                          sub.claimedScore ?? 0;
                                        staffTotalReviewer +=
                                          sub.reviewerScore ?? 0;
                                        if (sub.status === "appealed")
                                          staffAppealedCount++;
                                        if (
                                          sub.status === "accepted" ||
                                          sub.status === "appeal-resolved"
                                        )
                                          staffCompletedCount++;
                                      });

                                      const staffProgress =
                                        staffTotalMax > 0
                                          ? (staffTotalFinal / staffTotalMax) *
                                            100
                                          : 0;
                                      const staffCompletionRate =
                                        staffSubmissionsCount > 0
                                          ? (staffCompletedCount /
                                              staffSubmissionsCount) *
                                            100
                                          : 0;

                                      // Group submissions by criteria > module
                                      const groupedSubmissions = (
                                        staff.submissions || []
                                      ).reduce((acc: any, sub: any) => {
                                        const crit =
                                          sub.criteriaName || "Other Criteria";
                                        const mod = sub.moduleName || "General";

                                        if (!acc[crit]) acc[crit] = {};
                                        if (!acc[crit][mod])
                                          acc[crit][mod] = [];
                                        acc[crit][mod].push(sub);
                                        return acc;
                                      }, {});

                                      return (
                                        <AccordionItem
                                          key={staff.id}
                                          value={staff.id}
                                          className="my-2"
                                        >
                                          <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 rounded-md transition-colors data-[state=open]:bg-muted/20">
                                            <div className="flex justify-between w-full pr-4">
                                              <div className="flex items-center gap-3">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                {staff.name}
                                              </div>
                                              <Badge
                                                variant="outline"
                                                className="text-xs"
                                              >
                                                {staffSubmissionsCount}{" "}
                                                Submissions
                                              </Badge>
                                            </div>
                                          </AccordionTrigger>
                                          <AccordionContent className="px-4 pt-4 pb-6 bg-background">
                                            <Accordion
                                              type="single"
                                              collapsible
                                              className="space-y-4"
                                            >
                                              <AccordionItem value="details">
                                                <AccordionTrigger className="text-lg font-semibold flex items-center gap-2">
                                                  <User className="h-5 w-5 text-primary" />{" "}
                                                  Staff Details
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm p-4 border rounded-lg shadow-sm bg-card">
                                                    <div>
                                                      <span className="font-medium">
                                                        Name:
                                                      </span>{" "}
                                                      {staff.name}
                                                    </div>
                                                    <div>
                                                      <span className="font-medium">
                                                        Email:
                                                      </span>{" "}
                                                      {staff.email}
                                                    </div>
                                                    <div>
                                                      <span className="font-medium">
                                                        Department:
                                                      </span>{" "}
                                                      {staff.department ||
                                                        "N/A"}
                                                    </div>
                                                    <div>
                                                      <span className="font-medium">
                                                        College:
                                                      </span>{" "}
                                                      {staff.college}
                                                    </div>
                                                    <div>
                                                      <span className="font-medium">
                                                        Level:
                                                      </span>{" "}
                                                      {staff.level || "N/A"}
                                                    </div>
                                                    <div>
                                                      <span className="font-medium">
                                                        Role:
                                                      </span>{" "}
                                                      {staff.role || "N/A"}
                                                    </div>
                                                  </div>
                                                </AccordionContent>
                                              </AccordionItem>

                                              {/* ─── Replaced Performance Summary with ScoreOverview ─── */}
                                              <AccordionItem value="performance">
                                                <AccordionTrigger className="text-lg font-semibold flex items-center gap-2">
                                                  <BarChart2 className="h-5 w-5 text-primary" />{" "}
                                                  Score Overview
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                  <div className="p-4 border rounded-lg shadow-sm bg-card">
                                                    <ScoreOverview
                                                      submissions={
                                                        staff.submissions || []
                                                      }
                                                      userTarget={
                                                        staff.designationTarget ||
                                                        undefined
                                                      }
                                                      targetLabel={getStaffPhdLabel(
                                                        staff,
                                                      )}
                                                    />
                                                  </div>
                                                </AccordionContent>
                                              </AccordionItem>

                                              <AccordionItem value="submissions">
                                                <AccordionTrigger className="text-lg font-semibold flex items-center gap-2">
                                                  <Award className="h-5 w-5 text-primary" />{" "}
                                                  Submissions (
                                                  {staffSubmissionsCount})
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                  <div className="p-4 border rounded-lg shadow-sm bg-card">
                                                    <p className="text-sm text-muted-foreground mb-4">
                                                      Grouped by Criteria and
                                                      Module with detailed views
                                                    </p>
                                                    {Object.keys(
                                                      groupedSubmissions,
                                                    ).length === 0 ? (
                                                      <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg">
                                                        No submissions found
                                                      </div>
                                                    ) : (
                                                      <Accordion
                                                        type="single"
                                                        collapsible
                                                        className="space-y-4"
                                                      >
                                                        {Object.entries(
                                                          groupedSubmissions,
                                                        ).map(
                                                          ([
                                                            criteria,
                                                            modules,
                                                          ]: any) => {
                                                            const criteriaModulesCount =
                                                              Object.keys(
                                                                modules,
                                                              ).length;
                                                            const criteriaSubsCount =
                                                              (
                                                                Object.values(
                                                                  modules,
                                                                ) as any[]
                                                              ).reduce(
                                                                (
                                                                  sum: number,
                                                                  subs: any,
                                                                ) =>
                                                                  sum +
                                                                  subs.length,
                                                                0,
                                                              );
                                                            return (
                                                              <AccordionItem
                                                                key={criteria}
                                                                value={criteria}
                                                              >
                                                                <AccordionTrigger className="px-6 py-4 text-lg font-semibold hover:bg-muted/50 transition-colors data-[state=open]:bg-muted/30">
                                                                  <div className="flex justify-between w-full pr-4">
                                                                    <span>
                                                                      {criteria}
                                                                    </span>
                                                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                                      <span className="flex items-center gap-1">
                                                                        <BookOpen className="h-4 w-4" />{" "}
                                                                        {
                                                                          criteriaModulesCount
                                                                        }{" "}
                                                                        Modules
                                                                      </span>
                                                                      <span className="flex items-center gap-1">
                                                                        <File className="h-4 w-4" />{" "}
                                                                        {
                                                                          criteriaSubsCount
                                                                        }{" "}
                                                                        Submissions
                                                                      </span>
                                                                    </div>
                                                                  </div>
                                                                </AccordionTrigger>
                                                                <AccordionContent className="px-6 pb-6 pt-2 bg-background">
                                                                  <Accordion
                                                                    type="single"
                                                                    collapsible
                                                                    className="space-y-3"
                                                                  >
                                                                    {Object.entries(
                                                                      modules,
                                                                    ).map(
                                                                      ([
                                                                        moduleName,
                                                                        subs,
                                                                      ]: any) => {
                                                                        const moduleSubsCount =
                                                                          subs.length;
                                                                        return (
                                                                          <AccordionItem
                                                                            key={
                                                                              moduleName
                                                                            }
                                                                            value={`${criteria}-${moduleName}`}
                                                                          >
                                                                            <AccordionTrigger className="px-5 py-3 hover:bg-secondary/20 transition-colors data-[state=open]:bg-secondary/10">
                                                                              <div className="flex justify-between w-full pr-4">
                                                                                <div className="flex items-center gap-2">
                                                                                  <BookOpen className="h-4 w-4 text-primary" />
                                                                                  {
                                                                                    moduleName
                                                                                  }
                                                                                </div>
                                                                                <Badge
                                                                                  variant="outline"
                                                                                  className="ml-2 text-xs"
                                                                                >
                                                                                  {
                                                                                    moduleSubsCount
                                                                                  }{" "}
                                                                                  item
                                                                                  {moduleSubsCount !==
                                                                                  1
                                                                                    ? "s"
                                                                                    : ""}
                                                                                </Badge>
                                                                              </div>
                                                                            </AccordionTrigger>
                                                                            <AccordionContent className="px-5 pb-5 pt-3 bg-background">
                                                                              <div className="space-y-4">
                                                                                {subs.map(
                                                                                  (
                                                                                    sub: any,
                                                                                  ) => {
                                                                                    const effectiveFinal =
                                                                                      sub.finalScore ??
                                                                                      sub.reviewerScore ??
                                                                                      sub.claimedScore ??
                                                                                      0;
                                                                                    const subProgress =
                                                                                      sub.maxMarks >
                                                                                      0
                                                                                        ? (effectiveFinal /
                                                                                            sub.maxMarks) *
                                                                                          100
                                                                                        : 0;
                                                                                    return (
                                                                                      <Card
                                                                                        key={
                                                                                          sub.id
                                                                                        }
                                                                                        className="border shadow-sm hover:shadow-md transition-shadow rounded-lg overflow-hidden"
                                                                                      >
                                                                                        <CardHeader className="pb-2 bg-muted/10 px-4 py-3">
                                                                                          <div className="flex justify-between items-start">
                                                                                            <CardTitle className="text-base font-semibold">
                                                                                              {
                                                                                                sub.taskName
                                                                                              }
                                                                                            </CardTitle>
                                                                                            {/* <Badge
                                                                              variant={statusConfig[sub.status]?.variant || "outline"}
                                                                              className="text-xs px-3 py-0.5"
                                                                            >
                                                                              {statusConfig[sub.status]?.label || sub.status}
                                                                            </Badge> */}
                                                                                          </div>
                                                                                        </CardHeader>
                                                                                        <CardContent className="px-4 py-3">
                                                                                          <div className="space-y-4">
                                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                                                                              <p>
                                                                                                <span className="font-medium">
                                                                                                  Form:
                                                                                                </span>{" "}
                                                                                                {
                                                                                                  sub.formTitle
                                                                                                }
                                                                                              </p>
                                                                                              <p>
                                                                                                <span className="font-medium">
                                                                                                  Claimed:
                                                                                                </span>{" "}
                                                                                                {
                                                                                                  sub.claimedScore
                                                                                                }
                                                                                              </p>
                                                                                              <p>
                                                                                                <span className="font-medium">
                                                                                                  Reviewer:
                                                                                                </span>{" "}
                                                                                                {sub.reviewerScore ??
                                                                                                  "—"}
                                                                                              </p>
                                                                                              <p>
                                                                                                <span className="font-medium">
                                                                                                  Final:
                                                                                                </span>{" "}
                                                                                                {sub.finalScore ??
                                                                                                  sub.reviewerScore ??
                                                                                                  sub.claimedScore ??
                                                                                                  "Pending"}
                                                                                              </p>
                                                                                              <p>
                                                                                                <span className="font-medium">
                                                                                                  Max
                                                                                                  Marks:
                                                                                                </span>{" "}
                                                                                                {
                                                                                                  sub.maxMarks
                                                                                                }
                                                                                              </p>
                                                                                              {/* {sub.createdAt && (
                                                                                <p><span className="font-medium">Submitted:</span> {new Date(sub.createdAt.seconds * 1000).toLocaleDateString()}</p>
                                                                              )} */}
                                                                                            </div>
                                                                                            {/* <div className="space-y-2">
                                                                              <div className="flex justify-between text-sm">
                                                                                <span>Progress</span>
                                                                                <span>{subProgress.toFixed(1)}%</span>
                                                                              </div>
                                                                              <Progress value={subProgress} className="h-2" />
                                                                            </div> */}
                                                                                          </div>
                                                                                        </CardContent>
                                                                                      </Card>
                                                                                    );
                                                                                  },
                                                                                )}
                                                                              </div>
                                                                            </AccordionContent>
                                                                          </AccordionItem>
                                                                        );
                                                                      },
                                                                    )}
                                                                  </Accordion>
                                                                </AccordionContent>
                                                              </AccordionItem>
                                                            );
                                                          },
                                                        )}
                                                      </Accordion>
                                                    )}
                                                  </div>
                                                </AccordionContent>
                                              </AccordionItem>
                                            </Accordion>
                                          </AccordionContent>
                                        </AccordionItem>
                                      );
                                    })}
                                  </Accordion>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          },
                        )}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
            </CardContent>
          </Card>
        )}

        {["committee", "principle", "vice principle", "hod"].includes(
          user?.role || "",
        ) && (
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
                      {sub.status === "accepted" || sub.status === "appeal-resolved"
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
    if (sub.status === "accepted" || sub.status === "appeal-resolved")
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
