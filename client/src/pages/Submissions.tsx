import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Clock,
  CheckCircle2,
  Eye,
  BookOpen,
  Layers,
  LinkIcon,
  User,
  Scale,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatRoleLabel } from "@/lib/utils";
import { api } from "@/api/api";
import { resolveEvidenceLink } from "@/lib/utils";
import jsPDF from "jspdf";

interface Submission {
  id: string;
  formId: string;
  formTitle: string;
  criteriaId: string;
  criteriaName: string;
  moduleId: string;
  moduleName: string;
  taskId: string;
  taskName: string;
  status: string;
  claimedScore: number;
  finalScore: number | null;
  maxMarks: number;
  createdAt: any;
  updatedAt: any;
  description?: string;
  evidence?: string;
  reviewerScore?: number;
  reviewerReason?: string;
  reviewerId?: string;
  reviewerRole?: string;
  peerReviewScore?: number;
  peerReviewReason?: string;
  peerReviewerName?: string;
  appealReason?: string;
  appealRequestedScore?: number;
  appealerScore?: number;
  appealerReason?: string;
  appealerId?: string;
  appealerRole?: string;
  isAppealed: boolean;
  submitToRoleIds?: string[];
  appealToRoleIds?: string[];
  userName: string;
  userEmail: string;
  userRole: string;
  college: string;
  department: string;
  academicYear?: string;
  criteriaTotalMarks?: number;
  moduleTotalMarks?: number;
}

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
      | "info";
    icon: any;
  }
> = {
  pending: { label: "Pending", variant: "outline", icon: Clock },
  submitted: { label: "Submitted", variant: "secondary", icon: Clock },
  reviewed: { label: "Under Review", variant: "default", icon: Clock },
  accepted: { label: "Accepted", variant: "success", icon: CheckCircle2 },
  appealed: { label: "Appealed", variant: "warning", icon: Scale },
  "appeal-resolved": {
    label: "Appeal Resolved",
    variant: "success",
    icon: CheckCircle2,
  },
  "auto-approved": {
    label: "Claim Accepted",
    variant: "success",
    icon: CheckCircle2,
  },
  "appeal-expired": {
    label: "Appeal Expired",
    variant: "secondary",
    icon: Clock,
  },
};

type Phase = "submission" | "evaluation" | "appeal" | "appeal-review" | "locked";

const toEndOfDay = (s: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  d.setHours(23, 59, 59, 999);
  return d;
};

export default function Submissions() {
  const { user, isLoading: authLoading } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [formOrder, setFormOrder] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("submission");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
    {},
  );
  const [appealDialogOpen, setAppealDialogOpen] = useState(false);
  const [appealFormData, setAppealFormData] = useState({
    submissionId: "",
    reason: "",
  });

  // Priority: appealerScore > reviewerScore > null (no fallback to claimed)
  const getEffectiveScore = (sub: Submission): number | null => {
    if (sub.appealerScore != null) return sub.appealerScore;
    if (sub.reviewerScore != null) return sub.reviewerScore;
    return null;
  };

  useEffect(() => {
    if (!user || authLoading) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch form order to sort criteria groups (non-fatal)
        api.get("/api/submissions/form-order").then((orderRes) => {
          const forms: { id: string; formTitle: string; order: number }[] = orderRes.data?.data?.forms || [];
          const map: Record<string, number> = {};
          forms.forEach((f) => { map[f.formTitle] = f.order; });
          setFormOrder(map);
        }).catch(() => {});

        const [subResponse, deadlineResponse] = await Promise.all([
          api.get("/api/submissions/my-submissions", {
            headers: {
              "x-user-id": user.uid || user.id,
              "x-user-email": user.email || "",
              "x-user-name": user.name || "",
              "x-user-role": user.role || "faculty",
              "x-college": user.college || "",
              "x-department": user.department || "",
            },
          }),
          api.get("/api/colleges/user-deadline", {
            headers: {
              "x-user-id": user.uid || user.id || "",
              "x-user-role": user.role || "",
              "x-college": user.college || "",
            },
          }),
        ]);

        if (subResponse.data?.success) {
          const sorted = [...(subResponse.data.data || [])].sort((a, b) => {
            const ta = a.createdAt?.seconds * 1000 || 0;
            const tb = b.createdAt?.seconds * 1000 || 0;
            return tb - ta;
          });
          setSubmissions(sorted);
        } else {
          setError("Failed to load submissions");
        }

        if (deadlineResponse.data?.success) {
          const d = deadlineResponse.data.data;
          const now = new Date();
          const dl = toEndOfDay(d.assessmentEnd || d.deadline || null);
          const ev = toEndOfDay(d.evaluationEnd || null);
          const ap = toEndOfDay(d.appealEnd || null);
          const apRev = toEndOfDay(d.appealReviewEnd || null);
          if (!dl || now <= dl) setPhase("submission");
          else if (!ev || now <= ev) setPhase("evaluation");
          else if (!ap || now <= ap) setPhase("appeal");
          else if (!apRev || now <= apRev) setPhase("appeal-review");
          else setPhase("locked");
        }
      } catch (err: any) {
        console.error("Error:", err);
        setError(err.response?.data?.message || "Failed to load submissions");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, authLoading]);

  // Achievement shows after evaluation ends; per-task final shows after appeal ends
  const showAchievement =
    phase === "appeal" || phase === "appeal-review" || phase === "locked";
  const showPerTaskFinal = phase === "appeal-review" || phase === "locked";

  const totalClaimed = submissions.reduce(
    (sum, sub) => sum + sub.claimedScore,
    0,
  );
  const totalAwarded = submissions.reduce(
    (sum, sub) => sum + (getEffectiveScore(sub) ?? 0),
    0,
  );
  const totalMax = submissions.reduce((sum, sub) => sum + sub.maxMarks, 0);
  const achievementPercent = Math.max(
    0,
    Math.min(100, (totalAwarded / 300) * 100),
  );

  const statusVisualConfig: Record<string, { color: string }> = {
    accepted: { color: "bg-emerald-500" },
    "appeal-resolved": { color: "bg-teal-500" },
    "auto-approved": { color: "bg-green-400" },
    appealed: { color: "bg-amber-500" },
    reviewed: { color: "bg-blue-500" },
    submitted: { color: "bg-violet-500" },
    pending: { color: "bg-slate-400" },
  };

  const statusOrder = [
    "accepted",
    "appeal-resolved",
    "appealed",
    "reviewed",
    "submitted",
    "pending",
  ];

  const statusDistribution = statusOrder
    .map((status) => {
      const count = submissions.filter((sub) => sub.status === status).length;
      const percent = submissions.length
        ? (count / submissions.length) * 100
        : 0;

      return {
        status,
        label: statusConfig[status]?.label || status,
        count,
        percent,
        color: statusVisualConfig[status]?.color || "bg-slate-300",
      };
    })
    .filter((item) => item.count > 0);

  const getEvidenceHref = (evidence?: string) => resolveEvidenceLink(evidence);

  const groupedDetailed = submissions.reduce(
    (acc, sub) => {
      const crit = sub.criteriaName || "Unknown Criteria";
      const mod = sub.moduleName || "Unknown Module";

      if (!acc[crit]) {
        acc[crit] = {
          formId: sub.formId || "",
          modules: {},
          totalClaimed: 0,
          totalFinal: 0,
          totalMax: 0,
          criteriaTotalMarks: sub.criteriaTotalMarks || 0,
          hasReviewed: false,
          hasAppealed: false,
        };
      }

      if (
        sub.criteriaTotalMarks &&
        sub.criteriaTotalMarks > acc[crit].criteriaTotalMarks
      ) {
        acc[crit].criteriaTotalMarks = sub.criteriaTotalMarks;
      }

      if (!acc[crit].modules[mod]) {
        acc[crit].modules[mod] = {
          tasks: [],
          totalClaimed: 0,
          totalFinal: 0,
          totalMax: 0,
          moduleTotalMarks: sub.moduleTotalMarks || 0,
        };
      }

      if (
        sub.moduleTotalMarks &&
        sub.moduleTotalMarks > acc[crit].modules[mod].moduleTotalMarks
      ) {
        acc[crit].modules[mod].moduleTotalMarks = sub.moduleTotalMarks;
      }

      acc[crit].modules[mod].tasks.push(sub);
      acc[crit].modules[mod].totalClaimed += sub.claimedScore;
      acc[crit].modules[mod].totalFinal += getEffectiveScore(sub) ?? 0;
      acc[crit].modules[mod].totalMax += sub.maxMarks;

      acc[crit].totalClaimed += sub.claimedScore;
      acc[crit].totalFinal += getEffectiveScore(sub) ?? 0;
      acc[crit].totalMax += sub.maxMarks;
      if (sub.status === "reviewed") acc[crit].hasReviewed = true;
      if (sub.status === "appealed") acc[crit].hasAppealed = true;

      return acc;
    },
    {} as Record<
      string,
      {
        formId: string;
        modules: Record<
          string,
          {
            tasks: Submission[];
            totalClaimed: number;
            totalFinal: number;
            totalMax: number;
            moduleTotalMarks: number;
          }
        >;
        totalClaimed: number;
        totalFinal: number;
        totalMax: number;
        criteriaTotalMarks: number;
        hasReviewed: boolean;
        hasAppealed: boolean;
      }
    >,
  );

  const handleAccept = async (submission: Submission) => {
    try {
      setActionLoading((prev) => ({ ...prev, [submission.id]: true }));
      await api.post(`/api/submissions/${submission.id}/accept`);

      setSubmissions((prev) =>
        prev.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                status: "accepted",
                finalScore:
                  item.reviewerScore !== undefined &&
                  item.reviewerScore !== null
                    ? item.reviewerScore
                    : item.finalScore,
              }
            : item,
        ),
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to accept review");
    } finally {
      setActionLoading((prev) => ({ ...prev, [submission.id]: false }));
    }
  };

  const handleAppeal = async (submission: Submission) => {
    setAppealFormData({ submissionId: submission.id, reason: "" });
    setAppealDialogOpen(true);
  };

  const handleAppealSubmit = async () => {
    if (!appealFormData.reason.trim()) {
      setError("Appeal reason is required");
      return;
    }

    const submission = submissions.find(
      (item) => item.id === appealFormData.submissionId,
    );
    if (!submission) {
      setError("Submission not found");
      return;
    }

    try {
      setActionLoading((prev) => ({
        ...prev,
        [appealFormData.submissionId]: true,
      }));
      await api.post(`/api/submissions/${appealFormData.submissionId}/appeal`, {
        appealReason: appealFormData.reason.trim(),
        appealRequestedScore:
          submission.claimedScore ?? submission.reviewerScore ?? 0,
      });

      setSubmissions((prev) =>
        prev.map((item) =>
          item.id === appealFormData.submissionId
            ? {
                ...item,
                status: "appealed",
                isAppealed: true,
                appealReason: appealFormData.reason.trim(),
                appealRequestedScore:
                  item.claimedScore ?? item.reviewerScore ?? 0,
              }
            : item,
        ),
      );
      setAppealDialogOpen(false);
      setAppealFormData({ submissionId: "", reason: "" });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to submit appeal");
    } finally {
      setActionLoading((prev) => ({
        ...prev,
        [appealFormData.submissionId]: false,
      }));
    }
  };

  const downloadReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("FPMS Submissions Report", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 20, 35);

    doc.setFontSize(14);
    doc.text("User Details", 20, 50);
    doc.setLineWidth(0.3);
    doc.line(20, 53, 190, 53);
    doc.setFontSize(11);
    doc.text(`Name: ${user.name || "Unknown"}`, 25, 62);
    doc.text(`Email: ${user.email}`, 25, 70);
    doc.text(`Role: ${formatRoleLabel(user.role) || "Faculty"}`, 25, 78);

    let y = 110;
    doc.setFontSize(14);
    doc.text("Overall Scores", 20, y);
    doc.line(20, y + 3, 190, y + 3);
    y += 12;
    doc.setFontSize(11);
    doc.text(`Total Claimed: ${totalClaimed} / 300`, 25, y);
    y += 8;
    doc.text(`Total Final: ${totalAwarded} / 300`, 25, y);
    y += 8;
    doc.text(`Achievement: ${Math.round((totalAwarded / 300) * 100)}%`, 25, y);
    y += 15;

    doc.setFontSize(14);
    doc.text("All Submissions", 20, y);
    doc.line(20, y + 3, 190, y + 3);
    y += 12;

    submissions.forEach((sub, idx) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.text(`${idx + 1}. ${sub.taskName}`, 20, y);
      y += 8;
      doc.setFontSize(10);
      doc.text(`Criteria: ${sub.criteriaName}`, 25, y);
      y += 7;
      doc.text(`Module: ${sub.moduleName}`, 25, y);
      y += 7;
      doc.text(
        `Status: ${statusConfig[sub.status]?.label || sub.status}`,
        25,
        y,
      );
      y += 7;
      doc.text(`Claimed: ${sub.claimedScore} / ${sub.maxMarks}`, 25, y);
      y += 7;
      doc.text(`Final: ${getEffectiveScore(sub) ?? "Pending"}`, 25, y);
      y += 7;

      if (sub.reviewerScore !== undefined) {
        doc.text(
          `Reviewer: ${sub.reviewerScore} (${sub.reviewerRole?.toUpperCase() || "N/A"})`,
          25,
          y,
        );
        y += 7;
      }
      if (sub.appealerScore !== undefined) {
        doc.text(
          `Appeal: ${sub.appealerScore} (${sub.appealerRole?.toUpperCase() || "N/A"})`,
          25,
          y,
        );
        y += 7;
      }
      if (sub.description) {
        doc.text(`Description: ${sub.description.substring(0, 120)}...`, 25, y);
        y += 7;
      }
      if (sub.evidence) {
        doc.text(`Evidence: ${sub.evidence.substring(0, 80)}...`, 25, y);
        y += 7;
      }
      if (sub.reviewerReason) {
        doc.text(
          `Reviewer Remark: ${sub.reviewerReason.substring(0, 120)}...`,
          25,
          y,
        );
        y += 7;
      }
      if (sub.appealReason) {
        doc.text(
          `Appeal Reason: ${sub.appealReason.substring(0, 120)}...`,
          25,
          y,
        );
        y += 7;
      }
      if (sub.appealerReason) {
        doc.text(
          `Appeal Resolution: ${sub.appealerReason.substring(0, 120)}...`,
          25,
          y,
        );
        y += 7;
      }
      y += 10;
    });

    doc.save("fpms-submissions-report.pdf");
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout title="My Submissions">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Clock className="h-6 w-6 animate-spin" />
            <span>Loading your submissions...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="My Submissions">
        <div className="text-center py-16 text-destructive">
          <p className="text-xl font-medium">{error}</p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="My Submissions"
      subtitle="Track and manage your FPMS submissions"
    >
      <div className="space-y-10 pb-12">
        {/* Overall Total Score */}
        <Card>
          <div className="flex justify-between">
            <CardHeader>
              <CardTitle>Overall Performance</CardTitle>
              <CardDescription>
                Total scores from all your submitted tasks (out of 300)
              </CardDescription>
            </CardHeader>
            <div className="p-7">
              <Button
                className="h-10 flex gap-2"
                variant="outline"
                onClick={downloadReport}
              >
                <FileText className="h-5 w-5" />
                <span>Download Report</span>
              </Button>
            </div>
          </div>

          <CardContent className="space-y-6">
            <div className="rounded-xl bg-muted/50 p-5">
              {showAchievement ? (
                <>
                  <div className="mb-3 flex items-end justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total Final Score
                      </p>
                      <p className="text-4xl font-bold text-primary">
                        {totalAwarded}
                        <span className="text-xl font-normal text-muted-foreground ml-1">
                          /300
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-emerald-600">
                        {Math.round((totalAwarded / 300) * 100)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Achievement</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Score Progress
                      </p>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${achievementPercent}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>0</span>
                        <span>75</span>
                        <span>150</span>
                        <span>225</span>
                        <span>300</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-4 text-center text-muted-foreground">
                  <p className="text-sm font-medium">
                    Achievement scores will be available after the evaluation period ends.
                  </p>
                  <p className="text-xs mt-1">
                    {submissions.length} submission{submissions.length !== 1 ? "s" : ""} recorded
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detailed Task Submissions</CardTitle>
            <CardDescription>Grouped by criteria and module</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion
              type="single"
              collapsible
              defaultValue={Object.keys(groupedDetailed)[0] || ""}
            >
              {Object.entries(groupedDetailed)
                .sort(([nameA], [nameB]) => (formOrder[nameA] ?? 999) - (formOrder[nameB] ?? 999))
                .map(([criteriaName, critData]) => (
                  <AccordionItem
                    key={criteriaName}
                    value={criteriaName}
                    className="border rounded-lg mb-4"
                  >
                    <AccordionTrigger className="px-5 py-4">
                      <div className="flex flex-1 items-center justify-between">
                        <div className="flex items-center gap-4">
                          <BookOpen className="h-5 w-5 text-primary" />
                          <div>
                            <h3 className="font-semibold text-lg">
                              {criteriaName}
                            </h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                              {Object.keys(critData.modules).length} modules
                              {showPerTaskFinal && (
                                <> • {critData.totalFinal} / {critData.totalMax}</>
                              )}
                              <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                                Criteria Max:{" "}
                                {critData.criteriaTotalMarks || "0"}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mr-2">
                          {critData.hasReviewed && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              Needs Acceptance
                            </span>
                          )}
                          {critData.hasAppealed && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                              Appealed
                            </span>
                          )}
                          <Badge className="font-bold text-sm">
                            {showPerTaskFinal
                              ? `${critData.totalFinal} / ${critData.criteriaTotalMarks}`
                              : `— / ${critData.criteriaTotalMarks}`}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-5 pb-6">
                      <Accordion type="multiple">
                        {Object.entries(critData.modules).map(
                          ([moduleName, modData]) => (
                            <AccordionItem
                              key={moduleName}
                              value={`${criteriaName}-${moduleName}`}
                            >
                              <AccordionTrigger>
                                <div className="flex flex-1 items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Layers className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">
                                      {moduleName}
                                    </span>
                                    <Badge variant="secondary" className="ml-2">
                                      {modData.tasks.length} task
                                      {modData.tasks.length !== 1 ? "s" : ""}
                                    </Badge>
                                  </div>
                                  <Badge className="font-medium">
                                    {showPerTaskFinal
                                      ? modData.totalFinal
                                      : "—"}{" "}
                                    / {modData.moduleTotalMarks}
                                    <span className="ml-2 text-xs opacity-75">
                                      Module Max:{" "}
                                      {modData.moduleTotalMarks || "0"}
                                    </span>
                                  </Badge>
                                </div>
                              </AccordionTrigger>

                              <AccordionContent className="pt-4 space-y-4">
                                {modData.tasks.map((sub) => (
                                  <Card key={sub.id} className="border">
                                    <CardHeader className="pb-3">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <CardTitle className="text-base">
                                            {sub.taskName}
                                          </CardTitle>
                                          <CardDescription className="text-xs mt-1">
                                            {sub.createdAt
                                              ?.toDate?.()
                                              ?.toLocaleDateString("en-IN") ||
                                              "—"}
                                          </CardDescription>
                                        </div>
                                        <Badge
                                          variant={
                                            statusConfig[sub.status]?.variant
                                          }
                                        >
                                          {statusConfig[sub.status]?.label ||
                                            sub.status}
                                        </Badge>
                                      </div>
                                    </CardHeader>

                                    <CardContent className="space-y-5">
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div>
                                          <p className="text-xs text-muted-foreground">
                                            Claimed
                                          </p>
                                          <p className="font-medium">
                                            {sub.claimedScore}/{sub.maxMarks}
                                          </p>
                                        </div>
                                        {sub.reviewerScore != null && (
                                          <div>
                                            <p className="text-xs text-muted-foreground">
                                              Reviewer
                                            </p>
                                            <p className="font-medium">
                                              {sub.reviewerScore}/{sub.maxMarks}
                                            </p>
                                          </div>
                                        )}
                                        {sub.appealerScore != null && (
                                          <div>
                                            <p className="text-xs text-muted-foreground">
                                              Appeal
                                            </p>
                                            <p className="font-medium text-violet-600">
                                              {sub.appealerScore}/{sub.maxMarks}
                                            </p>
                                          </div>
                                        )}
                                        {sub.finalScore != null && (
                                          <div>
                                            <p className="text-xs text-muted-foreground">
                                              Final
                                            </p>
                                            <p className="font-semibold text-emerald-600">
                                              {sub.finalScore}/{sub.maxMarks}
                                            </p>
                                          </div>
                                        )}
                                      </div>

                                      {sub.evidence &&
                                        getEvidenceHref(sub.evidence) && (
                                          <a
                                            href={
                                              getEvidenceHref(sub.evidence) ||
                                              "#"
                                            }
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-blue-600 hover:underline"
                                          >
                                            <LinkIcon className="h-4 w-4" />
                                            View Evidence
                                          </a>
                                        )}

                                      {sub.description && (
                                        <div>
                                          <p className="text-muted-foreground mb-1">
                                            Description
                                          </p>
                                          <p className="text-sm">
                                            {sub.description}
                                          </p>
                                        </div>
                                      )}

                                      {(sub.reviewerReason ||
                                        sub.reviewerScore != null) && (
                                        <div className="border-t pt-4">
                                          <p className="font-medium mb-3 flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            Review by{" "}
                                            {sub.reviewerRole?.toUpperCase() ||
                                              "Reviewer"}
                                          </p>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {sub.reviewerScore != null && (
                                              <div>
                                                <p className="text-xs text-muted-foreground">
                                                  Score given
                                                </p>
                                                <p className="font-semibold">
                                                  {sub.reviewerScore} /{" "}
                                                  {sub.maxMarks}
                                                </p>
                                              </div>
                                            )}
                                            {sub.reviewerReason && (
                                              <div className="md:col-span-2">
                                                <p className="text-xs text-muted-foreground mb-1">
                                                  Remarks
                                                </p>
                                                <p className="text-sm bg-blue-50/50 p-3 rounded border border-blue-100 whitespace-pre-wrap">
                                                  {sub.reviewerReason}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {sub.peerReviewScore != null && (
                                        <div className="border-t pt-4">
                                          <p className="font-medium mb-3 flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            Peer Review
                                            {sub.peerReviewerName && (
                                              <span className="text-muted-foreground font-normal text-sm">
                                                by {sub.peerReviewerName}
                                              </span>
                                            )}
                                          </p>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                              <p className="text-xs text-muted-foreground">
                                                Score given
                                              </p>
                                              <p className="font-semibold">
                                                {sub.peerReviewScore} /{" "}
                                                {sub.maxMarks}
                                              </p>
                                            </div>
                                            {sub.peerReviewReason && (
                                              <div className="md:col-span-2">
                                                <p className="text-xs text-muted-foreground mb-1">
                                                  Remarks
                                                </p>
                                                <p className="text-sm bg-green-50/50 p-3 rounded border border-green-100 whitespace-pre-wrap">
                                                  {sub.peerReviewReason}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {sub.isAppealed && (
                                        <div className="border-t pt-4 bg-amber-50/30 rounded-lg p-4">
                                          <p className="font-medium mb-3 flex items-center gap-2 text-amber-800">
                                            <Scale className="h-4 w-4" />
                                            Appeal Details (
                                            {sub.appealerRole?.toUpperCase() ||
                                              "Committee"}
                                            )
                                          </p>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                                            {sub.appealRequestedScore !==
                                              undefined && (
                                              <div>
                                                <p className="text-muted-foreground">
                                                  Requested Score
                                                </p>
                                                <p className="font-medium">
                                                  {sub.appealRequestedScore} /{" "}
                                                  {sub.maxMarks}
                                                </p>
                                              </div>
                                            )}
                                            {sub.appealerScore !==
                                              undefined && (
                                              <div>
                                                <p className="text-muted-foreground">
                                                  Final Appeal Score
                                                </p>
                                                <p className="font-medium text-emerald-700">
                                                  {sub.appealerScore} /{" "}
                                                  {sub.maxMarks}
                                                </p>
                                              </div>
                                            )}
                                            {sub.appealReason && (
                                              <div className="md:col-span-2">
                                                <p className="text-muted-foreground mb-1">
                                                  Appeal Reason
                                                </p>
                                                <p className="bg-amber-50 p-3 rounded border border-amber-200 whitespace-pre-wrap">
                                                  {sub.appealReason}
                                                </p>
                                              </div>
                                            )}
                                            {sub.appealerReason && (
                                              <div className="md:col-span-2">
                                                <p className="text-muted-foreground mb-1">
                                                  Resolution Remarks
                                                </p>
                                                <p className="bg-emerald-50 p-3 rounded border border-emerald-200 whitespace-pre-wrap">
                                                  {sub.appealerReason}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {sub.status === "reviewed" && phase === "appeal" && (
                                        <div className="border-t pt-4 flex flex-wrap items-center gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => handleAccept(sub)}
                                            disabled={!!actionLoading[sub.id]}
                                          >
                                            {actionLoading[sub.id] ? "Processing..." : "Accept"}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleAppeal(sub)}
                                            disabled={!!actionLoading[sub.id]}
                                          >
                                            Appeal
                                          </Button>
                                        </div>
                                      )}
                                      {(sub.status === "auto-approved" || sub.status === "accepted") && phase === "appeal" && !sub.isAppealed && (
                                        <div className="border-t pt-4 flex flex-wrap items-center gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleAppeal(sub)}
                                            disabled={!!actionLoading[sub.id]}
                                          >
                                            Appeal
                                          </Button>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </AccordionContent>
                            </AccordionItem>
                          ),
                        )}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                ),
              )}
            </Accordion>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Submission History</CardTitle>
            <CardDescription>Your previous task submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList className="mb-6">
                <TabsTrigger value="all">All Submissions</TabsTrigger>
                <TabsTrigger value="finalized">Finalized</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-2">
                <Accordion type="multiple" className="space-y-3">
                  {submissions.map((sub) => (
                    <AccordionItem
                      key={sub.id}
                      value={sub.id}
                      className="border rounded-lg overflow-hidden shadow-sm"
                    >
                      <AccordionTrigger className="px-5 py-4 hover:bg-muted/50 transition-colors no-underline">
                        <div className="w-full flex items-center justify-between gap-6">
                          <div className="flex-1 min-w-0 pr-4">
                            <p className="font-medium text-base truncate text-left">
                              {sub.taskName}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5 truncate text-left">
                              {sub.criteriaName} • {sub.moduleName}
                            </p>
                          </div>

                          <div className="flex items-center gap-5 shrink-0">
                            <div className="text-right min-w-[100px]">
                              <p className="font-bold text-primary text-lg">
                                {sub.claimedScore}/{sub.maxMarks}
                              </p>
                              {showPerTaskFinal && getEffectiveScore(sub) != null && (
                                <p className="text-xs text-muted-foreground">
                                  Final: {getEffectiveScore(sub)}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant={
                                statusConfig[sub.status]?.variant || "outline"
                              }
                              className="min-w-[110px] justify-center py-1 text-sm"
                            >
                              {statusConfig[sub.status]?.label || sub.status}
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-5 pb-5 pt-3 bg-muted/20 border-t">
                        <div className="space-y-5 text-sm">
                          {sub.description && (
                            <div>
                              <p className="text-muted-foreground font-medium mb-1.5">
                                Description
                              </p>
                              <p className="leading-relaxed whitespace-pre-wrap">
                                {sub.description}
                              </p>
                            </div>
                          )}

                          {sub.evidence && (
                            <div>
                              <p className="text-muted-foreground font-medium mb-1.5">
                                Evidence
                              </p>
                              {getEvidenceHref(sub.evidence) ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="gap-2"
                                >
                                  <a
                                    href={getEvidenceHref(sub.evidence) || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Eye className="h-4 w-4" />
                                    View Evidence
                                  </a>
                                </Button>
                              ) : null}
                            </div>
                          )}

                          {sub.reviewerReason && (
                            <div>
                              <p className="text-muted-foreground font-medium mb-1.5">
                                Reviewer Remarks
                              </p>
                              <p className="bg-blue-50/50 p-3 rounded border border-blue-100 whitespace-pre-wrap leading-relaxed">
                                {sub.reviewerReason}
                              </p>
                            </div>
                          )}

                          {sub.appealReason && (
                            <div>
                              <p className="text-muted-foreground font-medium mb-1.5">
                                Appeal Reason
                              </p>
                              <p className="bg-amber-50/50 p-3 rounded border border-amber-200 whitespace-pre-wrap leading-relaxed">
                                {sub.appealReason}
                              </p>
                            </div>
                          )}

                          {sub.appealerReason && (
                            <div>
                              <p className="text-muted-foreground font-medium mb-1.5">
                                Appeal Resolution
                              </p>
                              <p className="bg-emerald-50/50 p-3 rounded border border-emerald-100 whitespace-pre-wrap leading-relaxed">
                                {sub.appealerReason}
                              </p>
                            </div>
                          )}

                          {sub.status === "reviewed" && phase === "appeal" && (
                            <div className="border-t pt-4 flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleAccept(sub)}
                                disabled={!!actionLoading[sub.id]}
                              >
                                {actionLoading[sub.id] ? "Processing..." : "Accept"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAppeal(sub)}
                                disabled={!!actionLoading[sub.id]}
                              >
                                Appeal
                              </Button>
                            </div>
                          )}
                          {(sub.status === "auto-approved" || sub.status === "accepted") && phase === "appeal" && !sub.isAppealed && (
                            <div className="border-t pt-4 flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAppeal(sub)}
                                disabled={!!actionLoading[sub.id]}
                              >
                                Appeal
                              </Button>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </TabsContent>

              <TabsContent value="finalized" className="mt-2">
                <Accordion type="multiple" className="space-y-3">
                  {submissions
                    .filter((s) =>
                      ["accepted", "appeal-resolved", "auto-approved", "appeal-expired"].includes(s.status),
                    )
                    .map((sub) => (
                      <AccordionItem
                        key={sub.id}
                        value={sub.id}
                        className="border rounded-lg overflow-hidden shadow-sm"
                      >
                        <AccordionTrigger className="px-5 py-4 hover:bg-muted/50 transition-colors no-underline">
                          <div className="w-full flex items-center justify-between gap-6">
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="font-medium text-base truncate text-left">
                                {sub.taskName}
                              </p>
                              <p className="text-sm text-muted-foreground mt-0.5 truncate text-left">
                                {sub.criteriaName} • {sub.moduleName}
                              </p>
                            </div>

                            <div className="flex items-center gap-5 shrink-0">
                              <div className="text-right min-w-[100px]">
                                <p className="font-bold text-primary text-lg">
                                  {getEffectiveScore(sub) ?? sub.claimedScore}/{sub.maxMarks}
                                </p>
                              </div>
                              <Badge
                                variant="success"
                                className="min-w-[110px] justify-center py-1 text-sm"
                              >
                                Finalized
                              </Badge>
                            </div>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent className="px-5 pb-5 pt-3 bg-muted/20 border-t">
                          <div className="space-y-5 text-sm">
                            <div>
                              <p className="text-muted-foreground font-medium mb-1.5">
                                Description
                              </p>
                              <p className="leading-relaxed whitespace-pre-wrap">
                                {sub.description || "No description provided"}
                              </p>
                            </div>

                            {sub.evidence && (
                              <div>
                                <p className="text-muted-foreground font-medium mb-1.5">
                                  Evidence
                                </p>
                                {getEvidenceHref(sub.evidence) ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    asChild
                                    className="gap-2"
                                  >
                                    <a
                                      href={
                                        getEvidenceHref(sub.evidence) || "#"
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Eye className="h-4 w-4" />
                                      View Evidence
                                    </a>
                                  </Button>
                                ) : null}
                              </div>
                            )}

                            {sub.appealerReason && (
                              <div>
                                <p className="text-muted-foreground font-medium mb-1.5">
                                  Appeal Resolution
                                </p>
                                <p className="bg-emerald-50/50 p-3 rounded border border-emerald-100 whitespace-pre-wrap leading-relaxed">
                                  {sub.appealerReason}
                                </p>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                </Accordion>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={appealDialogOpen} onOpenChange={setAppealDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Appeal</DialogTitle>
            <DialogDescription>
              Provide a reason for appealing the reviewer score.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Enter appeal reason"
            value={appealFormData.reason}
            onChange={(e) =>
              setAppealFormData((prev) => ({
                ...prev,
                reason: e.target.value,
              }))
            }
            rows={4}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAppealDialogOpen(false);
                setAppealFormData({ submissionId: "", reason: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAppealSubmit}
              disabled={
                !appealFormData.submissionId ||
                !!actionLoading[appealFormData.submissionId]
              }
            >
              {appealFormData.submissionId &&
              actionLoading[appealFormData.submissionId]
                ? "Submitting..."
                : "Submit Appeal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
