import { useState, useEffect } from "react";
import { api } from "@/api/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCollegePhase } from "@/hooks/useCollegePhase";
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

interface ReviewerSubmission {
  id: string;
  formTitle: string | null;
  criteriaName: string | null;
  taskName: string | null;
  moduleName: string | null;
  userName: string | null;
  userEmail: string | null;
  college: string | null;
  department: string | null;
  claimedScore: number | null;
  maxMarks: number | null;
  evidence: string | null;
  description: string | null;
  status: string;
  isAppealed?: boolean;
  appealReason?: string | null;
  appealRequestedScore?: number | null;
  peerReviewScore?: number | null;
  peerReviewReason?: string | null;
  isReviewedByMe: boolean;
}

function EvidenceViewer({ evidence }: { evidence: string | null }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!evidence?.trim())
    return <p className="text-muted-foreground line-clamp-3 break-words">—</p>;

  const url = evidence.trim();
  const lower = url.toLowerCase();
  const urlPath = lower.split("?")[0].split("#")[0];

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

export default function FacultyReview() {
  const { toast } = useToast();
  const { phase, deadlineLabel } = useCollegePhase();

  const [submissions, setSubmissions] = useState<ReviewerSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [reviewing, setReviewing] = useState<Record<string, boolean>>({});
  const [reviewInputs, setReviewInputs] = useState<
    Record<string, { verifiedScore: string; remarks: string }>
  >({});

  useEffect(() => {
    api
      .get("/api/auth/reviewer-submissions")
      .then((res) => {
        const data: ReviewerSubmission[] = Array.isArray(res.data?.data)
          ? res.data.data
          : [];
        setSubmissions(data);
        const inputs: Record<string, { verifiedScore: string; remarks: string }> = {};
        data.forEach((s) => {
          inputs[s.id] = {
            verifiedScore:
              s.claimedScore !== null && Number.isFinite(Number(s.claimedScore))
                ? String(s.claimedScore)
                : "0",
            remarks: "",
          };
        });
        setReviewInputs(inputs);
      })
      .catch(() => {
        toast({ title: "Failed to load submissions", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, []);

  const pending = submissions.filter((s) => !s.isReviewedByMe);
  const reviewed = submissions.filter((s) => s.isReviewedByMe);

  const allItems = submissions;
  const filteredItems = searchTerm.trim()
    ? allItems.filter((s) =>
        [s.userName, s.userEmail, s.criteriaName, s.taskName, s.department].some(
          (v) => v?.toLowerCase().includes(searchTerm.trim().toLowerCase()),
        ),
      )
    : allItems;

  const updateInput = (
    id: string,
    field: "verifiedScore" | "remarks",
    value: string,
    max?: number | null,
  ) => {
    setReviewInputs((prev) => {
      const clamped =
        field === "verifiedScore" && value !== "" && max != null && max > 0
          ? String(Math.max(0, Math.min(Number(value), max)))
          : value;
      return { ...prev, [id]: { ...prev[id], [field]: clamped } };
    });
  };

  const handleReview = async (sub: ReviewerSubmission) => {
    const input = reviewInputs[sub.id] || { verifiedScore: "0", remarks: "" };
    const score = Number(input.verifiedScore);
    const max = sub.maxMarks != null ? Number(sub.maxMarks) : null;

    if (!Number.isFinite(score) || score < 0 || (max != null && score > max)) {
      toast({
        title: "Invalid score",
        description: `Score must be between 0 and ${max ?? "max"}.`,
        variant: "destructive",
      });
      return;
    }

    setReviewing((prev) => ({ ...prev, [sub.id]: true }));
    try {
      await api.post(`/api/auth/reviewer-submissions/${sub.id}/feedback`, {
        verifiedScore: score,
        remarks: input.remarks,
      });
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === sub.id
            ? {
                ...s,
                isReviewedByMe: true,
                peerReviewScore: score,
                peerReviewReason: input.remarks,
              }
            : s,
        ),
      );
      toast({ title: "Review submitted successfully." });
    } catch (err: any) {
      toast({
        title: "Review failed",
        description: err?.response?.data?.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setReviewing((prev) => ({ ...prev, [sub.id]: false }));
    }
  };

  // ── Grouping ──────────────────────────────────────────────────────────
  type FacultyEntry = {
    name: string;
    email: string;
    items: ReviewerSubmission[];
  };

  const groupByFaculty = (
    items: ReviewerSubmission[],
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

  const groupByCriteria = (items: ReviewerSubmission[]) =>
    items.reduce(
      (acc, item) => {
        const c = item.criteriaName?.trim() || "Unspecified Criteria";
        if (!acc[c]) acc[c] = { pending: [], reviewed: [] };
        if (!item.isReviewedByMe) acc[c].pending.push(item);
        else acc[c].reviewed.push(item);
        return acc;
      },
      {} as Record<
        string,
        { pending: ReviewerSubmission[]; reviewed: ReviewerSubmission[] }
      >,
    );

  const renderSubmissionCard = (
    item: ReviewerSubmission,
    type: "pending" | "reviewed",
  ) => {
    const input = reviewInputs[item.id] || { verifiedScore: "0", remarks: "" };
    const isReviewing = !!reviewing[item.id];
    const max = item.maxMarks != null ? Number(item.maxMarks) : null;
    const statusLower = (item.status || "submitted").toLowerCase();

    return (
      <Card key={item.id} className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-base">
                {item.taskName || "Task"}
              </CardTitle>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>{item.moduleName || "—"} • {item.userName || item.userEmail}</div>
                <div>
                  Form: {item.criteriaName || "—"} • {item.criteriaName || "—"}
                </div>
              </div>
            </div>
            <Badge
              variant={
                statusLower === "reviewed"
                  ? "default"
                  : statusLower === "appealed"
                    ? "destructive"
                    : "secondary"
              }
            >
              {statusLower}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-1">
          <div className="flex justify-between items-center text-sm bg-muted/50 rounded px-3 py-2.5">
            <div>
              <span className="font-medium">Claimed:</span>{" "}
              {item.claimedScore ?? 0}{max != null ? ` / ${max}` : ""}
            </div>
            {item.peerReviewScore != null && (
              <div className="font-medium">
                Peer Score:{" "}
                <span
                  className={
                    item.peerReviewScore === item.claimedScore
                      ? "text-green-600"
                      : "text-amber-600"
                  }
                >
                  {item.peerReviewScore}
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
                {...(max != null && max > 0 ? { max } : {})}
                value={
                  type === "pending"
                    ? input.verifiedScore
                    : (item.peerReviewScore ?? "")
                }
                onChange={(e) =>
                  type === "pending" &&
                  updateInput(item.id, "verifiedScore", e.target.value, max)
                }
                disabled={type === "reviewed" || isReviewing}
                className={type === "reviewed" ? "bg-muted" : ""}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Remarks</label>
              <Textarea
                value={
                  type === "pending"
                    ? input.remarks
                    : (item.peerReviewReason ?? "")
                }
                onChange={(e) =>
                  type === "pending" &&
                  updateInput(item.id, "remarks", e.target.value)
                }
                placeholder="Optional remarks..."
                rows={2}
                disabled={type === "reviewed" || isReviewing}
                className={`min-h-[80px] ${type === "reviewed" ? "bg-muted" : ""}`}
              />
            </div>
          </div>

          {type === "pending" ? (
            <div className="flex justify-end pt-2">
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
            <div className="flex justify-end">
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200"
              >
                Reviewed
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderFacultyTier = (fMap: Record<string, FacultyEntry>) => {
    const entries = Object.entries(fMap).sort(([, a], [, b]) => {
      const ap = a.items.filter((i) => !i.isReviewedByMe).length;
      const bp = b.items.filter((i) => !i.isReviewedByMe).length;
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
            (i) => !i.isReviewedByMe,
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
                    ([criteria, { pending: p, reviewed: r }]) => (
                      <AccordionItem
                        key={criteria}
                        value={criteria}
                        className="border rounded-md"
                      >
                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/20 text-sm">
                          <div className="flex items-center justify-between w-full pr-4">
                            <span className="font-medium">{criteria}</span>
                            <div className="flex gap-3 text-xs">
                              {p.length > 0 && (
                                <span className="text-destructive font-medium">
                                  {p.length} pending
                                </span>
                              )}
                              <span className="text-muted-foreground">
                                {r.length} reviewed
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pt-3 space-y-6">
                          {p.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-destructive" />
                                Pending Review ({p.length})
                              </h4>
                              <div className="space-y-4">
                                {p.map((item) =>
                                  renderSubmissionCard(item, "pending"),
                                )}
                              </div>
                            </div>
                          )}
                          {r.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                Reviewed ({r.length})
                              </h4>
                              <div className="space-y-4">
                                {r.map((item) =>
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

  if (loading) {
    return (
      <DashboardLayout title="Review Submissions" subtitle="Faculty Performance Review">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin h-10 w-10 text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Review Submissions"
      subtitle="Faculty Performance Review"
    >
      <PhaseBanner phase={phase} deadlineLabel={deadlineLabel} allowedPhases={["evaluation"]} />
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
            <FileText className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{submissions.length}</div>
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
              {pending.length}
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
              {reviewed.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search by name, department, criteria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xl"
        />
      </div>

      {/* Content */}
      {submissions.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/30 text-muted-foreground">
          No submissions found for your assigned department.
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/30 text-muted-foreground">
          No results for &ldquo;{searchTerm}&rdquo;
        </div>
      ) : (
        renderFacultyTier(groupByFaculty(filteredItems))
      )}
    </DashboardLayout>
  );
}
