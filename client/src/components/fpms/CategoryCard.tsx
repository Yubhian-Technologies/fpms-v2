import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, CheckCircle2, Clock, AlertCircle, Lock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

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

const statusConfig = {
  "not-started": {
    label: "Not Started",
    icon: Lock,
    variant: "outline" as const,
    color: "text-muted-foreground",
  },
  "in-progress": {
    label: "In Progress",
    icon: Clock,
    variant: "secondary" as const,
    color: "text-primary",
  },
  complete: {
    label: "Complete",
    icon: CheckCircle2,
    variant: "success" as const,
    color: "text-success",
  },
  "needs-review": {
    label: "Needs Review",
    icon: AlertCircle,
    variant: "outline" as const,
    color: "text-amber-600 dark:text-amber-400",
  },
};

export function CategoryCard({
  title,
  description = "",
  score,
  maxScore,
  completedItems,
  totalItems,
  status,
  hrefEdit,
  hrefView,
  submissions,
}: CategoryCardProps) {

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const progressPercent =
    maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  const isComplete = status === "complete";

  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // 🔥 Dynamic Progress Color (Senior level clean logic)
  const progressColor =
    progressPercent < 40
      ? "bg-red-500"
      : progressPercent < 70
      ? "bg-yellow-500"
      : "bg-green-500";

  // Group submissions by moduleName
  const groupedModules = submissions.reduce<Record<string, Submission[]>>(
    (acc, sub) => {
      const mod = sub.moduleName?.trim() || "General";
      if (!acc[mod]) acc[mod] = [];
      acc[mod].push(sub);
      return acc;
    },
    {}
  );

  return (
    <Card className="group overflow-hidden border shadow-sm rounded-lg transition-all hover:shadow-md hover:border-primary/50">
      
      <CardHeader className="pb-3 px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base font-semibold leading-tight line-clamp-2">
              {title}
            </CardTitle>
            {description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {description}
              </p>
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
              <span className="text-base font-normal text-muted-foreground">
                /{maxScore}
              </span>
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground">Items Completed</p>
            <p className="text-lg font-semibold text-foreground">
              {completedItems}/{totalItems}
            </p>
          </div>
        </div>

        {/* ✅ Updated Progress Section (Only this changed visually) */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>

          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500 ease-in-out",
                progressColor
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          
          <Button
            variant={isComplete ? "secondary" : "outline"}
            size="sm"
            disabled={isComplete}
            className={cn(
              "text-xs font-medium h-9",
              !isComplete &&
                "group-hover:border-primary group-hover:text-primary"
            )}
            asChild={!isComplete}
          >
            {isComplete ? (
              <span className="flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Completed
              </span>
            ) : (
              <a
                href={hrefEdit}
                className="flex items-center justify-between w-full"
              >
                Edit Form
                <ChevronRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
              </a>
            )}
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-medium h-9 group-hover:border-accent group-hover:text-accent"
              >
                <span className="flex items-center justify-between w-full">
                  View Submissions
                  <Eye className="h-3.5 w-3.5 ml-1" />
                </span>
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto rounded-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">
                  {title} Submissions
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {Object.entries(groupedModules).map(
                  ([moduleName, moduleSubs]) => (
                    <Accordion
                      type="single"
                      collapsible
                      key={moduleName}
                    >
                      <AccordionItem value={moduleName}>
                        <AccordionTrigger className="text-base font-semibold">
                          {moduleName} ({moduleSubs.length} submissions)
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4">
                          {moduleSubs.map((sub) => (
                            <Card
                              key={sub.taskName}
                              className="p-4 border rounded-lg"
                            >
                              <div className="space-y-2 text-sm">
                                <p className="font-medium">
                                  {sub.taskName}
                                </p>
                                <p>Status: {sub.status}</p>
                                <p>
                                  Claimed Score:{" "}
                                  {sub.claimedScore ?? "N/A"}
                                </p>
                                <p>
                                  Final Score:{" "}
                                  {sub.finalScore ?? "Pending"}
                                </p>
                                <p>Max Marks: {sub.maxMarks}</p>
                              </div>
                            </Card>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )
                )}

                <div className="flex justify-end mt-6">
                  <Button
                    variant="default"
                    onClick={() => navigate("/submissions")}
                    className="gap-2"
                  >
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