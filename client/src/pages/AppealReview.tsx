import { useState, useEffect, useMemo } from "react";
import { api } from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCollegePhase } from "@/hooks/useCollegePhase";
import { PhaseBanner } from "@/components/dashboard/PhaseBanner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface SubmissionItem {
  id: string;
  formId: string | null;
  formTitle: string | null;
  criteriaId: string | null;
  criteriaName: string | null;
  taskId: string | null;
  taskName: string | null;
  moduleId: string | null;
  moduleName: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userRole: string | null;
  college: string | null;
  department: string | null;
  claimedScore: number | null;
  evidence: string | null;
  description: string | null;
  maxMarks: number | null;
  marksType: string | null;
  minMarks: number | null;
  reviewerScore: number | null;
  reviewerReason: string | null;
  reviewerId: string | null;
  reviewerRole: string | null;
  isAppealed: boolean;
  appealReason: string | null;
  appealRequestedScore: number | null;
  appealerScore: number | null;
  appealerReason: string | null;
  appealerId: string | null;
  appealerRole: string | null;
  status: string;
  finalScore: number | null;
  submitToRoleIds: string[];
  appealToRoleIds: string[];
  createdAt: any;
  updatedAt: any;
}

export default function AppealReview() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { phase, deadlineLabel } = useCollegePhase();

  const [queue, setQueue] = useState<SubmissionItem[]>([]);
  const [resolvedItems, setResolvedItems] = useState<SubmissionItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<Record<string, boolean>>({});
  const [reviewInputs, setReviewInputs] = useState<
    Record<string, { appealerScore: string; appealerReason: string }>
  >({});

  const [openCollege, setOpenCollege] = useState<string | null>(null);
  const [openRole, setOpenRole] = useState<string | null>(null);
  const [openFaculty, setOpenFaculty] = useState<string | null>(null);

  const normalizedUserRole = String(user?.role || "")
    .trim()
    .toLowerCase();

  const canReviewAppeal =
    normalizedUserRole === "dean" ||
    normalizedUserRole === "principle" ||
    normalizedUserRole === "committee" ||
    normalizedUserRole === "internal committee" ||
    normalizedUserRole.includes("vice") ||
    !!user?.internalCommittee;

  const isCommittee =
    normalizedUserRole === "committee" ||
    normalizedUserRole === "internal committee" ||
    !!user?.internalCommittee;
  const isInternalCommittee =
    normalizedUserRole === "internal committee" || !!user?.internalCommittee;
  const currentUserCollege = String(user?.college || "")
    .trim()
    .toLowerCase();

  const visibleQueue = useMemo(() => {
    if (!isInternalCommittee || !currentUserCollege) return queue;
    return queue.filter(
      (item) =>
        String(item.college || "")
          .trim()
          .toLowerCase() === currentUserCollege,
    );
  }, [queue, isInternalCommittee, currentUserCollege]);

  const visibleResolvedItems = useMemo(() => {
    if (!isInternalCommittee || !currentUserCollege) return resolvedItems;
    return resolvedItems.filter(
      (item) =>
        String(item.college || "")
          .trim()
          .toLowerCase() === currentUserCollege,
    );
  }, [resolvedItems, isInternalCommittee, currentUserCollege]);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const [pendingRes, resolvedRes] = await Promise.all([
        api.get("/api/submissions/appeal-queue"),
        api.get("/api/submissions/my-resolved-appeals"),
      ]);

      const pending: SubmissionItem[] = Array.isArray(pendingRes.data?.data)
        ? pendingRes.data.data
        : [];
      const resolved: SubmissionItem[] = Array.isArray(resolvedRes.data?.data)
        ? resolvedRes.data.data
        : [];

      setQueue(pending);
      setResolvedItems(resolved);

      setReviewInputs((prev) => {
        const next = { ...prev };
        pending.forEach((item) => {
          const id = String(item.id || "").trim();
          if (!id || next[id]) return;
          const defaultScore =
            item.appealRequestedScore ??
            item.reviewerScore ??
            item.claimedScore;
          next[id] = {
            appealerScore:
              defaultScore !== null && Number.isFinite(Number(defaultScore))
                ? String(defaultScore)
                : "",
            appealerReason: "",
          };
        });
        return next;
      });
    } catch (error) {
      console.error("Failed to fetch appeal queue:", error);
      toast({
        title: "Error",
        description: "Failed to load appeal queue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !canReviewAppeal) {
      setLoading(false);
      return;
    }
    fetchQueue();
  }, [user?.id, user?.role, user?.internalCommittee]);

  if (!user) return null;

  if (!canReviewAppeal) {
    return (
      <DashboardLayout title="Review Appeals">
        <div className="text-left text-muted-foreground py-16 pl-6">
          Access restricted to authorized roles (Dean, Principal, Committee,
          Vice Principal, etc.)
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout title="Review Appeals">
        <div className="flex flex-col justify-center items-center h-64 gap-3 text-muted-foreground">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
          <span className="text-sm">Loading appeals...</span>
        </div>
      </DashboardLayout>
    );
  }

  // ── Data preparation ────────────────────────────────────────
  const facultyMap = [...visibleQueue, ...visibleResolvedItems].reduce(
    (acc, item) => {
      const email = (item.userEmail || "unknown").trim().toLowerCase();
      if (email === "unknown") return acc;

      if (!acc[email]) {
        acc[email] = {
          name: item.userName || email.split("@")[0] || "Unknown",
          role: (item.userRole || "Unknown").trim(),
          college: (item.college || "Unknown").trim(),
          items: [],
        };
      }
      acc[email].items.push(item);
      return acc;
    },
    {} as Record<
      string,
      { name: string; role: string; college: string; items: SubmissionItem[] }
    >,
  );

  let facultyList = Object.entries(facultyMap)
    .filter(([email]) => email !== "unknown")
    .map(
      ([email, data]: [
        string,
        {
          name: string;
          role: string;
          college: string;
          items: SubmissionItem[];
        },
      ]) => ({
        email,
        name: data.name,
        role: data.role,
        college: data.college,
        total: data.items.length,
        pending: data.items.filter((i) => i.appealerScore === null).length,
      }),
    );

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase().trim();
    facultyList = facultyList.filter(
      (f) =>
        f.name.toLowerCase().includes(term) ||
        f.email.toLowerCase().includes(term) ||
        f.role.toLowerCase().includes(term) ||
        f.college.toLowerCase().includes(term),
    );
  }

  const collegeList = isCommittee
    ? Array.from(new Set(facultyList.map((f) => f.college)))
        .filter(Boolean)
        .map((college) => {
          const inCollege = facultyList.filter((f) => f.college === college);
          return {
            college,
            total: inCollege.reduce((sum, f) => sum + f.total, 0),
            pending: inCollege.reduce((sum, f) => sum + f.pending, 0),
          };
        })
    : [];

  const getRolesForCollege = (collegeName: string) =>
    Array.from(
      new Set(
        facultyList.filter((f) => f.college === collegeName).map((f) => f.role),
      ),
    )
      .filter(Boolean)
      .map((role) => {
        const inRole = facultyList.filter(
          (f) => f.college === collegeName && f.role === role,
        );
        return {
          role,
          total: inRole.reduce((sum, f) => sum + f.total, 0),
          pending: inRole.reduce((sum, f) => sum + f.pending, 0),
        };
      });

  const getFacultyForRole = (collegeName: string, roleName: string) =>
    facultyList.filter((f) => f.college === collegeName && f.role === roleName);

  const selectedFaculty = openFaculty
    ? facultyMap[openFaculty.toLowerCase()]
    : null;
  const selectedFacultyItems = selectedFaculty?.items || [];

  const criteriaGroups = selectedFacultyItems.reduce(
    (acc, item) => {
      const crit = item.criteriaName?.trim() || "Unspecified Criteria";
      if (!acc[crit]) acc[crit] = { pending: [], resolved: [] };
      if (item.appealerScore === null) {
        acc[crit].pending.push(item);
      } else {
        acc[crit].resolved.push(item);
      }
      return acc;
    },
    {} as Record<
      string,
      { pending: SubmissionItem[]; resolved: SubmissionItem[] }
    >,
  );

  const resolve = (v?: string | null) => String(v || "").trim() || "—";

  const updateAppealInput = (
    submissionId: string,
    field: "appealerScore" | "appealerReason",
    value: string,
    maxMarks?: number,
    marksType?: string,
  ) => {
    const clamped =
      field === "appealerScore"
        ? (() => {
            const trimmed = value.trim();
            if (!trimmed) return "";
            const num = Number(trimmed);
            if (!Number.isFinite(num)) return "";
            if (marksType === "range") return String(Math.max(0, num)); // Ref: no cap
            return String(Math.max(0, Math.min(num, Number(maxMarks || 0)))); // Max: capped
          })()
        : value;

    setReviewInputs((prev) => ({
      ...prev,
      [submissionId]: {
        ...prev[submissionId],
        [field]: clamped,
      },
    }));
  };

  const handleAppealReview = async (item: SubmissionItem) => {
    const submissionId = String(item.id || "").trim();
    if (!submissionId) return;

    const input = reviewInputs[submissionId] || {
      appealerScore: "",
      appealerReason: "",
    };
    const numericScore = Number(input.appealerScore);
    const isRef = item.marksType === "range";
    const maxMarks = Number(item.maxMarks || 0);

    if (!Number.isFinite(numericScore) || numericScore < 0 || (!isRef && numericScore > maxMarks)) {
      toast({
        title: "Invalid score",
        description: isRef
          ? "Score must be 0 or greater."
          : `Score must be between 0 and ${maxMarks}.`,
        variant: "destructive",
      });
      return;
    }

    setReviewing((prev) => ({ ...prev, [submissionId]: true }));
    try {
      await api.post(`/api/submissions/${submissionId}/review-appeal`, {
        appealerScore: numericScore,
        appealerReason: input.appealerReason.trim(),
      });

      const resolvedItem: SubmissionItem = {
        ...item,
        appealerScore: numericScore,
        appealerReason: input.appealerReason.trim(),
        status: "appeal-resolved",
        finalScore: numericScore,
      };

      setQueue((prev) => prev.filter((row) => row.id !== submissionId));
      setResolvedItems((prev) => [resolvedItem, ...prev]);

      toast({
        title: "Success",
        description: "Appeal reviewed and resolved.",
      });
    } catch (error: any) {
      toast({
        title: "Failed",
        description:
          error?.response?.data?.message || "Could not process appeal review.",
        variant: "destructive",
      });
    } finally {
      setReviewing((prev) => ({ ...prev, [submissionId]: false }));
    }
  };

  const renderAppealCard = (
    item: SubmissionItem,
    type: "pending" | "resolved",
  ) => {
    const id = String(item.id || "").trim();
    const input = reviewInputs[id] || { appealerScore: "", appealerReason: "" };
    const isReviewing = !!reviewing[id];
    const max = Number(item.maxMarks || 0);
    const status = (item.status || "appealed").toLowerCase();

    return (
      <Card key={id} className="border shadow-sm rounded-lg overflow-hidden">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-semibold">
                {item.taskName || "Task"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {item.moduleName || "Module"} •{" "}
                {item.userName || item.userEmail}
              </p>
              <p className="text-xs text-muted-foreground">
                {resolve(item.formTitle)} • {resolve(item.criteriaName)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge
                variant={
                  status === "appealed"
                    ? "destructive"
                    : status === "appeal-resolved"
                      ? "default"
                      : "secondary"
                }
                className="text-xs"
              >
                {status}
              </Badge>
              {!!item.appealToRoleIds?.length && (
                <Badge variant="outline" className="text-xs">
                  To: {item.appealToRoleIds.join(", ")}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Score row */}
          <div className="flex items-center gap-6 text-sm bg-muted/40 rounded px-3 py-2">
            <span>
              <span className="font-medium">Claimed:</span>{" "}
              {Number(item.claimedScore || 0)}
              {item.marksType === "range"
                ? <span className="text-muted-foreground ml-1">(ref: {max})</span>
                : <span className="text-muted-foreground ml-1">/ {max}</span>}
            </span>
            {item.reviewerScore != null && (
              <span>
                <span className="font-medium">Reviewer:</span>{" "}
                {item.reviewerScore}
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Evidence
              </p>
              <p className="break-all text-muted-foreground">
                {item.evidence || "—"}
              </p>
            </div>
            <div>
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Description
              </p>
              <p className="whitespace-pre-wrap text-muted-foreground line-clamp-3">
                {item.description || "—"}
              </p>
            </div>
          </div>

          {item.reviewerScore !== null && item.reviewerReason && (
            <div className="border border-blue-200 bg-blue-50/50 rounded p-3 text-sm">
              <p className="font-medium text-blue-800 mb-1">
                Reviewer Evaluation
              </p>
              <p className="text-blue-700">
                <strong>Score:</strong> {item.reviewerScore}
                {item.marksType !== "range" && ` / ${max}`}
              </p>
              <p className="text-blue-700 mt-0.5">
                <strong>Remarks:</strong> {item.reviewerReason}
              </p>
            </div>
          )}

          {item.isAppealed && item.appealReason && (
            <div className="border border-amber-200 bg-amber-50/50 rounded p-3 text-sm">
              <p className="font-medium text-amber-800 mb-1">Appeal Reason</p>
              <p className="text-amber-700">{item.appealReason}</p>
              {item.appealRequestedScore !== null && (
                <p className="text-amber-700 mt-0.5">
                  Requested: <strong>{item.appealRequestedScore}</strong>
                </p>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Final Score
              </label>
              <Input
                type="number"
                min={0}
                {...(item.marksType !== "range" ? { max } : {})}
                value={
                  type === "pending"
                    ? input.appealerScore
                    : (item.appealerScore ?? "")
                }
                onChange={(e) =>
                  updateAppealInput(id, "appealerScore", e.target.value, max, item.marksType ?? undefined)
                }
                disabled={type === "resolved"}
                className={type === "resolved" ? "bg-muted" : ""}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Remarks
              </label>
              <Textarea
                value={
                  type === "pending"
                    ? input.appealerReason
                    : (item.appealerReason ?? "")
                }
                onChange={(e) =>
                  updateAppealInput(id, "appealerReason", e.target.value)
                }
                placeholder="Enter remarks..."
                rows={2}
                disabled={type === "resolved"}
                className={`min-h-[72px] ${type === "resolved" ? "bg-muted" : ""}`}
              />
            </div>
          </div>

          <div className="flex justify-end">
            {type === "resolved" ? (
              <Badge
                variant="secondary"
                className="bg-green-50 text-green-700 border border-green-200"
              >
                Resolved
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={() => handleAppealReview(item)}
                disabled={isReviewing || !["appeal", "appeal-review"].includes(phase)}
              >
                {isReviewing && (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                )}
                {isReviewing ? "Saving..." : "Submit Review"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout
      title="Review Appeals"
      subtitle="Faculty Appeal Review Queue"
    >
      <PhaseBanner phase={phase} deadlineLabel={deadlineLabel} allowedPhases={["appeal", "appeal-review"]} />
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total Appeals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {visibleQueue.length + visibleResolvedItems.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {visibleQueue.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {visibleResolvedItems.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <Input
          placeholder="Search name, email, role, college..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xl"
        />
      </div>

      <div className="space-y-6">
        {isCommittee ? (
          collegeList.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No colleges with appeals found
            </Card>
          ) : (
            <div className="space-y-5">
              {collegeList.map((c) => (
                <Card
                  key={c.college}
                  className="overflow-hidden shadow-md border"
                >
                  <Accordion
                    type="single"
                    collapsible
                    value={openCollege === c.college ? c.college : ""}
                  >
                    <AccordionItem value={c.college} className="border-none">
                      <AccordionTrigger
                        className="px-5 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:bg-muted/20"
                        onClick={() => {
                          setOpenCollege(
                            openCollege === c.college ? null : c.college,
                          );
                          setOpenRole(null);
                          setOpenFaculty(null);
                        }}
                      >
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="text-left">
                            <div className="font-semibold">{c.college}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {c.total} appeals
                            </div>
                          </div>
                          {c.pending > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              {c.pending} pending
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Completed
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-6 pb-8 pt-4 bg-white">
                        <div className="space-y-4">
                          {getRolesForCollege(c.college).map((r) => (
                            <Card key={r.role} className="border shadow-sm">
                              <Accordion
                                type="single"
                                collapsible
                                value={openRole === r.role ? r.role : ""}
                              >
                                <AccordionItem
                                  value={r.role}
                                  className="border-none"
                                >
                                  <AccordionTrigger
                                    className="px-5 py-3 hover:no-underline hover:bg-muted/20 data-[state=open]:bg-muted/10"
                                    onClick={() => {
                                      setOpenRole(
                                        openRole === r.role ? null : r.role,
                                      );
                                      setOpenFaculty(null);
                                    }}
                                  >
                                    <div className="flex justify-between w-full items-center pr-4">
                                      <span className="text-sm font-semibold capitalize">
                                        {r.role}
                                      </span>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>{r.total} appeals</span>
                                        {r.pending > 0 ? (
                                          <Badge
                                            variant="destructive"
                                            className="text-xs"
                                          >
                                            {r.pending} pending
                                          </Badge>
                                        ) : (
                                          <Badge
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            Reviewed
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </AccordionTrigger>

                                  <AccordionContent className="px-6 pb-6 pt-2">
                                    <div className="space-y-3">
                                      {getFacultyForRole(c.college, r.role).map(
                                        (f) => (
                                          <Card
                                            key={f.email}
                                            className="border"
                                          >
                                            <Accordion
                                              type="single"
                                              collapsible
                                              value={
                                                openFaculty === f.email
                                                  ? f.email
                                                  : ""
                                              }
                                            >
                                              <AccordionItem
                                                value={f.email}
                                                className="border-none"
                                              >
                                                <AccordionTrigger
                                                  className="px-4 py-3 hover:no-underline hover:bg-muted/20"
                                                  onClick={() =>
                                                    setOpenFaculty(
                                                      openFaculty === f.email
                                                        ? null
                                                        : f.email,
                                                    )
                                                  }
                                                >
                                                  <div className="flex justify-between w-full items-center pr-4">
                                                    <div className="text-left">
                                                      <div className="text-sm font-medium">
                                                        {f.name}
                                                      </div>
                                                      <div className="text-xs text-muted-foreground">
                                                        {f.email}
                                                      </div>
                                                    </div>
                                                    {f.pending > 0 ? (
                                                      <Badge
                                                        variant="destructive"
                                                        className="text-xs"
                                                      >
                                                        {f.pending} pending
                                                      </Badge>
                                                    ) : (
                                                      <Badge
                                                        variant="secondary"
                                                        className="text-xs"
                                                      >
                                                        Done
                                                      </Badge>
                                                    )}
                                                  </div>
                                                </AccordionTrigger>

                                                <AccordionContent className="px-6 pb-8 pt-4">
                                                  {openFaculty === f.email && (
                                                    <div className="space-y-8">
                                                      {Object.keys(
                                                        criteriaGroups,
                                                      ).length === 0 ? (
                                                        <Card className="p-8 text-center text-muted-foreground bg-slate-50">
                                                          No appeals found for
                                                          this faculty member
                                                        </Card>
                                                      ) : (
                                                        <Accordion
                                                          type="single"
                                                          collapsible
                                                          className="space-y-5"
                                                        >
                                                          {Object.entries(
                                                            criteriaGroups,
                                                          ).map(
                                                            ([
                                                              crit,
                                                              {
                                                                pending,
                                                                resolved,
                                                              },
                                                            ]) => (
                                                              <Card
                                                                key={crit}
                                                                className="border shadow-sm"
                                                              >
                                                                <AccordionItem
                                                                  value={crit}
                                                                  className="border-none"
                                                                >
                                                                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/20 text-sm">
                                                                    <div className="flex items-center justify-between w-full pr-4">
                                                                      <span className="font-medium">
                                                                        {crit}
                                                                      </span>
                                                                      <div className="flex gap-3 text-xs">
                                                                        {pending.length >
                                                                          0 && (
                                                                          <span className="text-destructive font-medium">
                                                                            {
                                                                              pending.length
                                                                            }{" "}
                                                                            pending
                                                                          </span>
                                                                        )}
                                                                        <span className="text-muted-foreground">
                                                                          {
                                                                            resolved.length
                                                                          }{" "}
                                                                          resolved
                                                                        </span>
                                                                      </div>
                                                                    </div>
                                                                  </AccordionTrigger>

                                                                  <AccordionContent className="px-4 pb-4 pt-3 space-y-6">
                                                                    {pending.length >
                                                                      0 && (
                                                                      <div>
                                                                        <h4 className="text-xs font-medium uppercase tracking-wide text-destructive mb-3 flex items-center gap-2">
                                                                          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                                                                          Pending
                                                                          (
                                                                          {
                                                                            pending.length
                                                                          }
                                                                          )
                                                                        </h4>
                                                                        <div className="space-y-3">
                                                                          {pending.map(
                                                                            (
                                                                              item,
                                                                            ) =>
                                                                              renderAppealCard(
                                                                                item,
                                                                                "pending",
                                                                              ),
                                                                          )}
                                                                        </div>
                                                                      </div>
                                                                    )}
                                                                    {resolved.length >
                                                                      0 && (
                                                                      <div>
                                                                        <h4 className="text-xs font-medium uppercase tracking-wide text-green-700 mb-3 flex items-center gap-2">
                                                                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                                                          Resolved
                                                                          (
                                                                          {
                                                                            resolved.length
                                                                          }
                                                                          )
                                                                        </h4>
                                                                        <div className="space-y-3">
                                                                          {resolved.map(
                                                                            (
                                                                              item,
                                                                            ) =>
                                                                              renderAppealCard(
                                                                                item,
                                                                                "resolved",
                                                                              ),
                                                                          )}
                                                                        </div>
                                                                      </div>
                                                                    )}
                                                                  </AccordionContent>
                                                                </AccordionItem>
                                                              </Card>
                                                            ),
                                                          )}
                                                        </Accordion>
                                                      )}
                                                    </div>
                                                  )}
                                                </AccordionContent>
                                              </AccordionItem>
                                            </Accordion>
                                          </Card>
                                        ),
                                      )}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </Card>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {facultyList.length === 0 ? (
              <div className="text-center py-16 border rounded-lg bg-muted/30 text-muted-foreground text-sm">
                No appeals available
              </div>
            ) : (
              facultyList.map((f) => (
                <Card
                  key={f.email}
                  className="border shadow-sm hover:shadow-md transition-shadow"
                >
                  <Accordion
                    type="single"
                    collapsible
                    value={openFaculty === f.email ? f.email : ""}
                  >
                    <AccordionItem value={f.email} className="border-none">
                      <AccordionTrigger
                        className="px-5 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:bg-muted/20"
                        onClick={() =>
                          setOpenFaculty(
                            openFaculty === f.email ? null : f.email,
                          )
                        }
                      >
                        <div className="flex justify-between w-full items-center pr-4">
                          <div className="text-left">
                            <div className="font-semibold">{f.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {f.email} •{" "}
                              <span className="capitalize">{f.role}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {f.total} appeals
                            </span>
                            {f.pending > 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                {f.pending} pending
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                All clear
                              </Badge>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-5 pb-5 pt-3">
                        {openFaculty === f.email && (
                          <div>
                            {Object.keys(criteriaGroups).length === 0 ? (
                              <div className="text-center py-10 text-muted-foreground text-sm">
                                No appeals found
                              </div>
                            ) : (
                              <Accordion
                                type="single"
                                collapsible
                                className="space-y-2"
                              >
                                {Object.entries(criteriaGroups).map(
                                  ([crit, { pending, resolved }]) => (
                                    <AccordionItem
                                      key={crit}
                                      value={crit}
                                      className="border rounded-md"
                                    >
                                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/20 text-sm">
                                        <div className="flex items-center justify-between w-full pr-4">
                                          <span className="font-medium">
                                            {crit}
                                          </span>
                                          <div className="flex gap-3 text-xs">
                                            {pending.length > 0 && (
                                              <span className="text-destructive font-medium">
                                                {pending.length} pending
                                              </span>
                                            )}
                                            <span className="text-muted-foreground">
                                              {resolved.length} resolved
                                            </span>
                                          </div>
                                        </div>
                                      </AccordionTrigger>

                                      <AccordionContent className="px-4 pb-4 pt-3 space-y-6">
                                        {pending.length > 0 && (
                                          <div>
                                            <h4 className="text-xs font-medium uppercase tracking-wide text-destructive mb-3 flex items-center gap-2">
                                              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                                              Pending ({pending.length})
                                            </h4>
                                            <div className="space-y-3">
                                              {pending.map((item) =>
                                                renderAppealCard(
                                                  item,
                                                  "pending",
                                                ),
                                              )}
                                            </div>
                                          </div>
                                        )}
                                        {resolved.length > 0 && (
                                          <div>
                                            <h4 className="text-xs font-medium uppercase tracking-wide text-green-700 mb-3 flex items-center gap-2">
                                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                              Resolved ({resolved.length})
                                            </h4>
                                            <div className="space-y-3">
                                              {resolved.map((item) =>
                                                renderAppealCard(
                                                  item,
                                                  "resolved",
                                                ),
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </AccordionContent>
                                    </AccordionItem>
                                  ),
                                )}
                              </Accordion>
                            )}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
