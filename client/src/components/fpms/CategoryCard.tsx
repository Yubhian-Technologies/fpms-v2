import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, CheckCircle2, Clock, AlertCircle, Lock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface Submission {
  criteriaName?: string;
  criteriaId?: string;
  criteriaTotalMarks?: number;
  formId?: string;
  formTitle?: string;
  finalScore?: number | null;
  claimedScore?: number | null;
  reviewerScore?: number | null;
  appealerScore?: number | null;
  maxMarks: number;
  status: string;
  moduleName?: string;
  taskName?: string;
}

interface CategoryCardProps {
  title: string;
  description?: string;
  score: number;
  maxScore: number;
  completedItems: number;
  totalItems: number;
  status: "not-started" | "in-progress" | "complete" | "needs-review";
  hrefEdit: string;
  hrefView: string;
  submissions: Submission[];
}

const cardStatusConfig = {
  "not-started": { label: "Not Started", icon: Lock, variant: "outline" as const, color: "text-muted-foreground" },
  "in-progress":  { label: "In Progress", icon: Clock, variant: "secondary" as const, color: "text-primary" },
  complete:       { label: "Complete", icon: CheckCircle2, variant: "success" as const, color: "text-success" },
  "needs-review": { label: "Needs Review", icon: AlertCircle, variant: "outline" as const, color: "text-amber-600 dark:text-amber-400" },
};

const SUB_STATUS: Record<string, { label: string; cls: string }> = {
  submitted:        { label: "Pending Review",    cls: "bg-slate-100 text-slate-700" },
  reviewed:         { label: "Needs Acceptance",  cls: "bg-amber-100 text-amber-800" },
  accepted:         { label: "Accepted",           cls: "bg-emerald-100 text-emerald-700" },
  "auto-approved":  { label: "Auto Approved",      cls: "bg-emerald-100 text-emerald-700" },
  "appeal-resolved":{ label: "Appeal Resolved",    cls: "bg-violet-100 text-violet-700" },
  "appeal-expired": { label: "Appeal Expired",     cls: "bg-gray-100 text-gray-600" },
  appealed:         { label: "Appealed",           cls: "bg-orange-100 text-orange-700" },
};

function SubStatusBadge({ status }: { status: string }) {
  const cfg = SUB_STATUS[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cfg.cls)}>
      {cfg.label}
    </span>
  );
}

export function CategoryCard({
  title, description = "", score, maxScore, completedItems, totalItems,
  status, hrefEdit, hrefView, submissions,
}: CategoryCardProps) {
  const config = cardStatusConfig[status];
  const StatusIcon = config.icon;
  const progressPercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const isComplete = status === "complete";

  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const progressColor =
    progressPercent < 40 ? "bg-red-500" : progressPercent < 70 ? "bg-yellow-500" : "bg-green-500";

  // Summary counts for the card
  const needsAcceptance = submissions.filter((s) => s.status === "reviewed").length;
  const hasAppealed = submissions.some((s) => s.status === "appealed");

  // Group submissions by moduleName for the dialog
  const groupedModules = submissions.reduce<Record<string, Submission[]>>((acc, sub) => {
    const mod = sub.moduleName?.trim() || "General";
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(sub);
    return acc;
  }, {});

  return (
    <Card className="group overflow-hidden border shadow-sm rounded-lg transition-all hover:shadow-md hover:border-primary/50">
      <CardHeader className="pb-3 px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base font-semibold leading-tight line-clamp-2">
              {title}
            </CardTitle>
            {description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 pt-3 space-y-4">
        <div className="flex justify-between items-end gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Current Score</p>
            <p className="text-2xl font-bold text-foreground">
              {score}
              <span className="text-base font-normal text-muted-foreground">/{maxScore}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Items Completed</p>
            <p className="text-lg font-semibold text-foreground">{completedItems}/{totalItems}</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full transition-all duration-500 ease-in-out", progressColor)}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Status alerts on the card */}
        {(needsAcceptance > 0 || hasAppealed) && (
          <div className="flex flex-wrap gap-1.5">
            {needsAcceptance > 0 && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                {needsAcceptance} Needs Acceptance
              </span>
            )}
            {hasAppealed && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700">
                Appealed
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Button
            variant={isComplete ? "secondary" : "outline"}
            size="sm"
            disabled={isComplete}
            className={cn("text-xs font-medium h-9", !isComplete && "group-hover:border-primary group-hover:text-primary")}
            asChild={!isComplete}
          >
            {isComplete ? (
              <span className="flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Completed
              </span>
            ) : (
              <a href={hrefEdit} className="flex items-center justify-between w-full">
                Edit Form
                <ChevronRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
              </a>
            )}
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs font-medium h-9 group-hover:border-accent group-hover:text-accent">
                <span className="flex items-center justify-between w-full">
                  View Submissions
                  <Eye className="h-3.5 w-3.5 ml-1" />
                </span>
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto rounded-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">{title} Submissions</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {Object.entries(groupedModules).map(([moduleName, moduleSubs]) => (
                  <Accordion type="single" collapsible key={moduleName} defaultValue={moduleName}>
                    <AccordionItem value={moduleName}>
                      <AccordionTrigger className="text-base font-semibold">
                        <span className="flex items-center gap-2">
                          {moduleName}
                          <span className="text-sm font-normal text-muted-foreground">
                            ({moduleSubs.length} tasks)
                          </span>
                          {moduleSubs.some((s) => s.status === "reviewed") && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              Needs Acceptance
                            </span>
                          )}
                          {moduleSubs.some((s) => s.status === "appealed") && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                              Appealed
                            </span>
                          )}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pt-2">
                        {moduleSubs.map((sub, idx) => (
                          <div
                            key={sub.taskName ?? idx}
                            className="flex items-start justify-between gap-3 rounded-lg border p-3 bg-muted/20"
                          >
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="text-sm font-medium leading-snug">{sub.taskName || "—"}</p>
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span>Claimed: <strong className="text-foreground">{sub.claimedScore ?? "—"}</strong></span>
                                {sub.reviewerScore != null && (
                                  <span>Reviewer: <strong className="text-foreground">{sub.reviewerScore}</strong></span>
                                )}
                                {sub.appealerScore != null && (
                                  <span>Appeal: <strong className="text-violet-600">{sub.appealerScore}</strong></span>
                                )}
                                {sub.finalScore != null && (
                                  <span>Final: <strong className="text-emerald-600">{sub.finalScore}</strong></span>
                                )}
                                <span>Max: {sub.maxMarks}</span>
                              </div>
                            </div>
                            <SubStatusBadge status={sub.status} />
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ))}

                <div className="flex justify-end mt-6">
                  <Button variant="default" onClick={() => navigate("/submissions")} className="gap-2">
                    <Eye className="h-4 w-4" />
                    View Full Details
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
