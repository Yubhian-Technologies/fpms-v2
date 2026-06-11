import { useState, useEffect } from "react";
import { api } from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCollegePhase } from "@/hooks/useCollegePhase";
import { useReviewAccess } from "@/hooks/useReviewAccess";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhaseBanner } from "@/components/dashboard/PhaseBanner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// Minimal Evidence viewer - keeps old card layout
function EvidenceViewer({ evidence }: { evidence: string | null }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!evidence?.trim()) {
    return <p className="text-muted-foreground line-clamp-3 break-words">—</p>;
  }

  const url = evidence.trim();
  const lower = url.toLowerCase();
  // Strip query params / hash before checking extensions so URLs like
  // …/file.pdf?fl_attachment=false are still recognised as PDFs.
  const urlPath = lower.split("?")[0].split("#")[0];

  // Cloudinary-specific: /image/upload/ = displayable image; /raw/upload/ = raw
  // file served with Content-Disposition: attachment by default → must route
  // through gview so it renders inline instead of triggering a download.
  const isCloudinaryImg =
    lower.includes("res.cloudinary.com") &&
    lower.includes("/image/upload/") &&
    !/\.pdf$/i.test(urlPath);
  const isCloudinaryRaw =
    lower.includes("res.cloudinary.com") && lower.includes("/raw/upload/");

  const isImage =
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(urlPath) || isCloudinaryImg;

  // Only embed Drive FILE links (/file/d/) or Docs/Sheets/Slides.
  // Folder links (/drive/folders/) cannot be embedded — gview returns raw HTML.
  const isDriveFile = lower.includes("drive.google.com/file/d/");
  const isDocsFile = lower.includes("docs.google.com");
  const isPlainPdf = /\.pdf$/i.test(urlPath);
  const isPdf =
    !isImage && (isDriveFile || isDocsFile || isPlainPdf || isCloudinaryRaw);

  let embedUrl = url;
  if (isDriveFile) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match?.[1])
      embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
  } else if (isPlainPdf || isCloudinaryRaw) {
    embedUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
  }

  return (
    <>
      <p className="text-muted-foreground line-clamp-2 break-all mb-2">{url}</p>

      {isImage && (
        <div className="mt-2">
          <img
            src={url}
            alt="Evidence"
            className="max-h-32 object-contain cursor-pointer hover:opacity-90"
            onClick={() => setPreviewOpen(true)}
            loading="lazy"
          />
        </div>
      )}

      {isPdf && (
        <div className="mt-2 border rounded h-64 overflow-hidden">
          <iframe
            src={embedUrl}
            title="Document Preview"
            width="100%"
            height="100%"
            className="border-0"
            loading="lazy"
          />
        </div>
      )}

      <div className="mt-3">
        <Button
          size="sm"
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          className="bg-[#001f3f] hover:bg-[#0a3d6e] text-white border-none"
        >
          Open in new tab
        </Button>
      </div>

      {/* Full view dialog - only for images */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Evidence View</DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex justify-center bg-muted/40 p-2 rounded">
            <img
              src={url}
              alt="Full evidence"
              className="max-w-full max-h-[70vh] object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export default function Review() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [queue, setQueue] = useState<SubmissionItem[]>([]);
  const [reviewedItems, setReviewedItems] = useState<SubmissionItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "reviewed">("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterCriteria, setFilterCriteria] = useState("all");
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [reviewInputs, setReviewInputs] = useState<
    Record<string, { verifiedScore: string; remarks: string }>
  >({});
  const [selectedFacultyEmail, setSelectedFacultyEmail] = useState<
    string | null
  >(null);
  const { phase, deadlineLabel } = useCollegePhase();

  const isHOD = (user?.role || "").toLowerCase() === "hod";
  const isCommittee = user?.role === "committee";
  const isprincipal = user?.role === "principal";
  const { canReview, isLoading: accessLoading } = useReviewAccess();

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const [pendingRes, reviewedRes] = await Promise.all([
        api.get("/api/submissions/review-queue"),
        api.get("/api/submissions/my-reviewed"),
      ]);

      const pending = Array.isArray(pendingRes.data?.data)
        ? pendingRes.data.data
        : [];
      const reviewed = Array.isArray(reviewedRes.data?.data)
        ? reviewedRes.data.data
        : [];

      setQueue(pending);
      setReviewedItems(reviewed);

      setReviewInputs((prev) => {
        const next = { ...prev };
        [...pending, ...reviewed].forEach((item) => {
          const id = String(item.id || "").trim();
          if (!id || next[id]) return;
          next[id] = {
            verifiedScore:
              item.claimedScore !== null &&
              Number.isFinite(Number(item.claimedScore))
                ? String(item.claimedScore)
                : "",
            remarks: "",
          };
        });
        return next;
      });
    } catch (error) {
      console.error("Failed to fetch review queue:", error);
      toast({
        title: "Error",
        description: "Failed to fetch review queue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || accessLoading) return;
    if (!canReview) {
      setLoading(false);
      return;
    }
    fetchQueue();
  }, [user?.id, user?.role, user?.internalCommittee, canReview, accessLoading]);

  if (!user) return null;
  if (accessLoading) {
    return (
      <DashboardLayout title="Review Submissions">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }
  if (!canReview) {
    return (
      <DashboardLayout title="Review Submissions">
        <div className="text-center text-muted-foreground py-16">
          Access restricted to reviewer roles.
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout title="Review Submissions">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin h-10 w-10 text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const displayUser = (item: SubmissionItem) =>
    isHOD ? item.userName || item.userEmail || "—" : "Faculty Member";

  // ─── Grouping helpers ─────────────────────────────────────────────────
  const allItems = [...queue, ...reviewedItems];

  // Derive unique values for dropdowns
  const uniqueDepts = Array.from(
    new Set(allItems.map((i) => i.department?.trim()).filter(Boolean))
  ).sort() as string[];
  const uniqueCriteria = Array.from(
    new Set(allItems.map((i) => i.criteriaName?.trim()).filter(Boolean))
  ).sort() as string[];

  const filteredItems = allItems.filter((item) => {
    if (filterStatus === "pending" && item.reviewerScore != null) return false;
    if (filterStatus === "reviewed" && item.reviewerScore == null) return false;
    if (filterDept !== "all" && item.department?.trim() !== filterDept) return false;
    if (filterCriteria !== "all" && item.criteriaName?.trim() !== filterCriteria) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      return [item.userName, item.userEmail, item.college, item.department, item.criteriaName, item.taskName, item.moduleName]
        .some((v) => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const hasActiveFilters = filterStatus !== "all" || filterDept !== "all" || filterCriteria !== "all" || searchTerm.trim() !== "";

  type FacultyEntry = { name: string; email: string; items: SubmissionItem[] };

  const groupByCriteria = (items: SubmissionItem[]) =>
    items.reduce(
      (acc, item) => {
        const c = item.criteriaName?.trim() || "Unspecified Criteria";
        if (!acc[c]) acc[c] = { pending: [], reviewed: [] };
        if (item.reviewerScore == null) acc[c].pending.push(item);
        else acc[c].reviewed.push(item);
        return acc;
      },
      {} as Record<
        string,
        { pending: SubmissionItem[]; reviewed: SubmissionItem[] }
      >,
    );

  const groupByFaculty = (
    items: SubmissionItem[],
  ): Record<string, FacultyEntry> =>
    items.reduce(
      (acc, item) => {
        const key = item.userEmail || "unknown";
        if (!acc[key])
          acc[key] = {
            name: item.userName || key.split("@")[0] || "Unknown",
            email: key,
            items: [],
          };
        acc[key].items.push(item);
        return acc;
      },
      {} as Record<string, FacultyEntry>,
    );

  const groupByKey = (
    items: SubmissionItem[],
    keyFn: (i: SubmissionItem) => string,
  ) =>
    items.reduce(
      (acc, item) => {
        const k = keyFn(item);
        if (!acc[k]) acc[k] = [];
        acc[k].push(item);
        return acc;
      },
      {} as Record<string, SubmissionItem[]>,
    );

  // Deepest tier: Faculty → Criteria → Submissions
  const renderFacultyTier = (fMap: Record<string, FacultyEntry>) => {
    const entries = Object.entries(fMap).sort(([, a], [, b]) => {
      const ap = a.items.filter((i) => i.reviewerScore == null).length;
      const bp = b.items.filter((i) => i.reviewerScore == null).length;
      return bp - ap;
    });

    if (entries.length === 0)
      return (
        <div className="py-8 text-center text-muted-foreground border border-dashed rounded-lg">
          No submissions found
        </div>
      );

    return (
      <Accordion type="single" collapsible className="space-y-2">
        {entries.map(([email, faculty]) => {
          const pendingCount = faculty.items.filter(
            (i) => i.reviewerScore == null,
          ).length;
          const total = faculty.items.length;
          const isComplete = pendingCount === 0;
          const statusBg = isComplete
            ? "bg-green-50 text-green-700 border border-green-200"
            : pendingCount === total
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-amber-50 text-amber-700 border border-amber-200";
          const statusLabel = isComplete
            ? "Completed"
            : pendingCount === total
              ? "Pending"
              : "In Progress";
          const criteriaMap = groupByCriteria(faculty.items);

          return (
            <AccordionItem
              key={email}
              value={email}
              className="border rounded-lg"
            >
              <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:bg-muted/20">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="text-left">
                    <div className="font-semibold">{faculty.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {email}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {total} items
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${statusBg}`}
                    >
                      {statusLabel}
                    </span>
                    {pendingCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {pendingCount} pending
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5 pt-2">
                <Accordion type="single" collapsible className="space-y-2">
                  {Object.entries(criteriaMap).map(
                    ([criteria, { pending, reviewed }]) => (
                      <AccordionItem
                        key={criteria}
                        value={criteria}
                        className="border rounded-md"
                      >
                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/20 text-sm">
                          <div className="flex items-center justify-between w-full pr-4">
                            <span className="font-medium">{criteria}</span>
                            <div className="flex gap-3 text-xs">
                              {pending.length > 0 && (
                                <span className="text-destructive font-medium">
                                  {pending.length} pending
                                </span>
                              )}
                              <span className="text-muted-foreground">
                                {reviewed.length} reviewed
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pt-3 space-y-6">
                          {pending.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-destructive" />
                                Pending Review ({pending.length})
                              </h4>
                              <div className="space-y-4">
                                {pending.map((item) =>
                                  renderSubmissionCard(item, "pending"),
                                )}
                              </div>
                            </div>
                          )}
                          {reviewed.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                Reviewed ({reviewed.length})
                              </h4>
                              <div className="space-y-4">
                                {reviewed.map((item) =>
                                  renderSubmissionCard(item, "reviewed"),
                                )}
                              </div>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ),
                  )}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

  // Mid tier: one grouping level wrapping renderFacultyTier
  const renderGroupTier = (
    groups: Record<string, SubmissionItem[]>,
    countLabel: string,
  ) => {
    const entries = Object.entries(groups);
    if (entries.length === 0) return null;
    return (
      <Accordion type="single" collapsible className="space-y-4">
        {entries.map(([key, items]) => {
          const pendingCount = items.filter(
            (i) => i.reviewerScore == null,
          ).length;
          const memberCount = new Set(items.map((i) => i.userEmail)).size;
          return (
            <AccordionItem
              key={key}
              value={key}
              className="border rounded-xl overflow-hidden"
            >
              <AccordionTrigger className="px-6 py-4 text-base font-bold bg-muted/20 hover:bg-muted/40 hover:no-underline data-[state=open]:bg-muted/30">
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="capitalize">{key}</span>
                  <div className="flex gap-4 text-sm font-normal text-muted-foreground">
                    <span>
                      {memberCount} {countLabel}
                    </span>
                    {pendingCount > 0 && (
                      <span className="text-destructive font-medium">
                        {pendingCount} pending
                      </span>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-4">
                {renderFacultyTier(groupByFaculty(items))}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

  // Committee: College → Role+Dept → Faculty → Criteria
  const renderCommitteeView = () => {
    const byCollege = groupByKey(
      filteredItems,
      (i) => i.college?.trim() || "Unknown College",
    );
    return (
      <Accordion type="single" collapsible className="space-y-4">
        {Object.entries(byCollege).map(([college, collegeItems]) => {
          const pendingCount = collegeItems.filter(
            (i) => i.reviewerScore == null,
          ).length;
          const staffCount = new Set(collegeItems.map((i) => i.userEmail)).size;
          const byRoleDept = groupByKey(
            collegeItems,
            (i) =>
              `${i.userRole || "Staff"}${i.department ? ` — ${i.department}` : ""}`,
          );
          return (
            <AccordionItem
              key={college}
              value={college}
              className="border rounded-xl overflow-hidden"
            >
              <AccordionTrigger className="px-6 py-5 text-lg font-bold bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 hover:no-underline data-[state=open]:from-primary/10">
                <div className="flex items-center justify-between w-full pr-4">
                  <span>{college}</span>
                  <div className="flex gap-4 text-sm font-normal text-muted-foreground">
                    <span>{staffCount} staff</span>
                    {pendingCount > 0 && (
                      <span className="text-destructive font-medium">
                        {pendingCount} pending
                      </span>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-4">
                <Accordion type="single" collapsible className="space-y-3">
                  {Object.entries(byRoleDept).map(([roleDept, rdItems]) => {
                    const rdPending = rdItems.filter(
                      (i) => i.reviewerScore == null,
                    ).length;
                    const rdCount = new Set(rdItems.map((i) => i.userEmail))
                      .size;
                    return (
                      <AccordionItem
                        key={roleDept}
                        value={roleDept}
                        className="border rounded-lg"
                      >
                        <AccordionTrigger className="px-5 py-3 font-semibold hover:no-underline hover:bg-muted/30 data-[state=open]:bg-muted/20">
                          <div className="flex items-center justify-between w-full pr-4">
                            <span className="capitalize">{roleDept}</span>
                            <div className="flex gap-4 text-sm font-normal text-muted-foreground">
                              <span>{rdCount} people</span>
                              {rdPending > 0 && (
                                <span className="text-destructive font-medium">
                                  {rdPending} pending
                                </span>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-5 pb-4 pt-3">
                          {renderFacultyTier(groupByFaculty(rdItems))}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

  const resolveFormTitle = (formTitle?: string | null) =>
    String(formTitle || "").trim() || "—";
  const resolveCriteriaName = (criteriaName?: string | null) =>
    String(criteriaName || "").trim() || "—";

  const updateReviewInput = (
    submissionId: string,
    field: "verifiedScore" | "remarks",
    value: string,
    maxMarks?: number,
    marksType?: string,
  ) => {
    const clamp = () => {
      if (field !== "verifiedScore") return value;
      const trimmed = value.trim();
      if (!trimmed) return "";
      const num = Number(trimmed);
      if (!Number.isFinite(num)) return "";
      if (marksType === "range") return String(Math.max(0, num)); // Ref: no cap
      return String(Math.max(0, Math.min(num, Number(maxMarks || 0)))); // Max: capped
    };

    setReviewInputs((prev) => ({
      ...prev,
      [submissionId]: {
        ...prev[submissionId],
        [field]: clamp(),
      },
    }));
  };

  const handleReview = async (item: SubmissionItem) => {
    const id = String(item.id || "").trim();
    if (!id) return;

    const input = reviewInputs[id] || { verifiedScore: "", remarks: "" };
    const score = Number(input.verifiedScore);
    const isRef = item.marksType === "range";
    const max = Number(item.maxMarks || 0);

    if (!Number.isFinite(score) || score < 0 || (!isRef && score > max)) {
      toast({
        title: "Invalid score",
        description: isRef
          ? "Score must be 0 or greater."
          : `Score must be between 0 and ${max}.`,
        variant: "destructive",
      });
      return;
    }

    setReviewing((prev) => ({ ...prev, [id]: true }));
    try {
      await api.post(`/api/submissions/${id}/review`, {
        reviewerScore: score,
        reviewerReason: input.remarks,
      });

      const updated: SubmissionItem = {
        ...item,
        reviewerScore: score,
        reviewerReason: input.remarks,
        status: "reviewed",
        finalScore: score,
      };

      setQueue((prev) => prev.filter((r) => r.id !== id));
      setReviewedItems((prev) => [updated, ...prev]);

      toast({
        title: "Success",
        description: "Review submitted successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Review failed",
        description: err?.response?.data?.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setReviewing((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (item: SubmissionItem) => {
    const id = String(item.id || "").trim();
    if (!id) return;
    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      await api.delete(`/api/submissions/${id}`);
      setQueue((prev) => prev.filter((r) => r.id !== id));
      setReviewedItems((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Submission deleted", description: "Faculty can now resubmit this task." });
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err?.response?.data?.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
    }
  };

  const renderSubmissionCard = (
    item: SubmissionItem,
    type: "pending" | "reviewed",
  ) => {
    const id = String(item.id || "").trim();
    const input = reviewInputs[id] || { verifiedScore: "", remarks: "" };
    const isReviewing = !!reviewing[id];
    const max = Number(item.maxMarks || 0);
    const statusLower = (item.status || "submitted").toLowerCase();
    const isAppeal = item.isAppealed && item.appealToRoleIds?.length > 0;

    return (
      <Card key={id} className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-base">
                {item.taskName || "Task"}
              </CardTitle>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>
                  {item.moduleName || "—"} • {displayUser(item)}
                </div>
                <div>
                  Form: {resolveFormTitle(item.formTitle)} •{" "}
                  {resolveCriteriaName(item.criteriaName)}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge
                variant={
                  statusLower === "appealed"
                    ? "destructive"
                    : statusLower === "reviewed"
                      ? "default"
                      : "secondary"
                }
              >
                {statusLower}
              </Badge>
              {isAppeal && <Badge variant="outline">Appeal</Badge>}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-1">
          <div className="flex justify-between items-center text-sm bg-muted/50 rounded px-3 py-2.5">
            <div>
              <span className="font-medium">Claimed:</span>{" "}
              {item.claimedScore ?? 0}
              {item.marksType === "range"
                ? <span className="text-muted-foreground ml-1">(ref: {max})</span>
                : <span className="text-muted-foreground ml-1">/ {max}</span>}
            </div>
            {item.reviewerScore != null && (
              <div className="font-medium">
                Awarded:{" "}
                <span
                  className={
                    item.reviewerScore === item.claimedScore
                      ? "text-green-600"
                      : "text-amber-600"
                  }
                >
                  {item.reviewerScore}
                </span>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <div className="font-medium mb-1">Evidence</div>
              <EvidenceViewer evidence={item.evidence} />
            </div>
            <div>
              <div className="font-medium mb-1">Description</div>
              <p className="text-muted-foreground whitespace-pre-wrap line-clamp-3">
                {item.description || "—"}
              </p>
            </div>
          </div>

          {item.isAppealed && item.appealReason && (
            <div className="border border-amber-200 bg-amber-50/70 rounded p-3 text-sm">
              <div className="font-medium text-amber-900 mb-1.5">
                Appeal Request
              </div>
              <p className="text-amber-800">{item.appealReason}</p>
              {item.appealRequestedScore != null && (
                <p className="mt-2 text-amber-800">
                  Requested: <strong>{item.appealRequestedScore}</strong>
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Verified Score
              </label>
              <Input
                type="number"
                min={0}
                {...(item.marksType !== "range" ? { max } : {})}
                value={
                  type === "pending"
                    ? input.verifiedScore
                    : (item.reviewerScore ?? "")
                }
                onChange={(e) =>
                  type === "pending" &&
                  updateReviewInput(id, "verifiedScore", e.target.value, max, item.marksType ?? undefined)
                }
                disabled={type === "reviewed" || isReviewing}
                className={type === "reviewed" ? "bg-muted" : ""}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Remarks
              </label>
              <Textarea
                value={
                  type === "pending"
                    ? input.remarks
                    : (item.reviewerReason ?? "")
                }
                onChange={(e) =>
                  type === "pending" &&
                  updateReviewInput(id, "remarks", e.target.value)
                }
                placeholder="Optional remarks..."
                rows={2}
                disabled={type === "reviewed" || isReviewing}
                className={`min-h-[80px] ${type === "reviewed" ? "bg-muted" : ""}`}
              />
            </div>
          </div>

          {type === "pending" ? (
            <div className="flex justify-end items-center gap-3 pt-2">
              {phase !== "evaluation" && (
                <p className="text-xs text-muted-foreground">
                  {phase === "submission" ? "Evaluation not started yet" : "Evaluation period closed"}
                </p>
              )}
              <Button
                size="sm"
                onClick={() => handleReview(item)}
                disabled={isReviewing || phase !== "evaluation"}
              >
                {isReviewing && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isReviewing ? "Saving..." : "Submit Review"}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end pt-1">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {item.status === "appealed" ? "Appealed" : "Reviewed"}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout
      title="Review Submissions"
      subtitle="Faculty Performance Review"
    >
      <PhaseBanner phase={phase} deadlineLabel={deadlineLabel} allowedPhases={["evaluation"]} />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
            <FileText className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {queue.length + reviewedItems.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-destructive rotate-180" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {queue.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reviewed
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {reviewedItems.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search by name, email, criteria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64"
        />
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "pending" | "reviewed")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
          </SelectContent>
        </Select>
        {uniqueDepts.length > 0 && (
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {uniqueDepts.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {uniqueCriteria.length > 0 && (
          <Select value={filterCriteria} onValueChange={setFilterCriteria}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Criteria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Criteria</SelectItem>
              {uniqueCriteria.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearchTerm(""); setFilterStatus("all"); setFilterDept("all"); setFilterCriteria("all"); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Grouped Content */}
      {allItems.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/30 text-muted-foreground">
          No submissions available
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/30 text-muted-foreground">
          No results match the selected filters
        </div>
      ) : isCommittee ? (
        // Committee: College → Role+Dept → Faculty → Criteria
        renderCommitteeView()
      ) : isprincipal ? (
        // principal/VP: Role+Dept → Faculty → Criteria
        renderGroupTier(
          groupByKey(
            filteredItems,
            (i) =>
              `${i.userRole || "Staff"}${i.department ? ` — ${i.department}` : ""}`,
          ),
          "faculty",
        )
      ) : isHOD ? (
        // HOD: Faculty → Criteria (within their department)
        renderFacultyTier(groupByFaculty(filteredItems))
      ) : (
        // Dean / others: Department → Faculty → Criteria
        renderGroupTier(
          groupByKey(
            filteredItems,
            (i) => i.department?.trim() || "Unknown Department",
          ),
          "faculty",
        )
      )}
    </DashboardLayout>
  );
}
