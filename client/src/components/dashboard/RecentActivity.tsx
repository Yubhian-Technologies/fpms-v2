import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, MessageSquare, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils"; // ← assuming you have this helper (shadcn)

interface Submission {
  id: string;
  taskName: string;
  moduleName: string;
  formTitle?: string;
  status: string;
  evidence?: any;
  createdAt: { seconds: number } | string | Date;
  updatedAt?: { seconds: number } | string | Date;
  claimedScore?: number;
  finalScore?: number;
}

interface RecentActivityProps {
  submissions: Submission[];
}

function toDate(ts: any): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") return new Date(ts);
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date();
}

function timeAgo(date: Date): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffSeconds < 60) return rtf.format(-diffSeconds, "second");
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 30) return rtf.format(-days, "day");
  const months = Math.floor(days / 30);
  if (months < 12) return rtf.format(-months, "month");
  const years = Math.floor(months / 12);
  return rtf.format(-years, "year");
}

export function RecentActivity({ submissions }: RecentActivityProps) {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    if (!submissions?.length) return;

    const sorted = [...submissions].sort(
      (a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()
    );

    const mapped = sorted.map((sub) => {
      let type = "submission";

      if (sub.status === "appealed") type = "appeal";
      else if (sub.status === "accepted" || sub.status === "appeal-resolved") type = "approval";
      else if (sub.status === "submitted" || sub.status === "reviewed")
        type = sub.evidence ? "upload" : "submission";

      return {
        id: sub.id,
        type,
        title: sub.taskName,
        description: `${sub.moduleName}${sub.formTitle ? ` • ${sub.formTitle}` : ""}`,
        status: sub.status,
        time: timeAgo(toDate(sub.createdAt)),
        claimedScore: sub.claimedScore,
        finalScore: sub.finalScore,
      };
    });

    setActivities(mapped.slice(0, 6));
  }, [submissions]);

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    submission: FileText,
    upload: Upload,
    approval: CheckCircle,
    appeal: MessageSquare,
  };

  const statusVariants: Record<string, "default" | "secondary" | "success" | "outline"> = {
    accepted: "success",
    "appeal-resolved": "success",
    submitted: "secondary",
    reviewed: "secondary",
    appealed: "outline",
    default: "secondary",
  };

  return (
    <Card className="overflow-hidden border shadow-sm transition-all duration-200 hover:shadow">
      <CardHeader className="border-b bg-muted/40 px-6 py-4">
        <CardTitle className="text-lg font-semibold tracking-tight">
          Recent Activity
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              No recent activity yet
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activities.map((activity, i) => {
              const Icon = iconMap[activity.type] || FileText;
              const isPositive = activity.finalScore != null;

              return (
                <div
                  key={activity.id}
                  className={cn(
                    "group relative flex items-start gap-4 px-6 py-4 transition-colors",
                    "hover:bg-muted/60 active:bg-muted/80",
                    i === 0 && "bg-gradient-to-r from-muted/30 to-transparent"
                  )}
                >
                  {/* Icon circle */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border/60 shadow-sm transition-transform group-hover:scale-105">
                    <Icon className="h-5 w-5 text-muted-foreground/80 transition-colors group-hover:text-foreground/90" />
                  </div>

                  {/* Content */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-medium leading-tight text-foreground">
                        {activity.title}
                      </p>

                      <Badge
                        variant={statusVariants[activity.status] ?? "secondary"}
                        className={cn(
                          "shrink-0 text-xs font-medium",
                          activity.status === "accepted" &&
                            "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-300",
                          activity.status === "appealed" &&
                            "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"
                        )}
                      >
                        {activity.status}
                      </Badge>
                    </div>

                    <p className="line-clamp-1 text-sm text-muted-foreground">
                      {activity.description}
                    </p>

                    <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground/80">
                      <span>{activity.time}</span>

                      {isPositive && (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          Score: {activity.finalScore}
                          {activity.claimedScore != null && (
                            <span className="ml-1.5 text-muted-foreground/70">
                              (claimed {activity.claimedScore})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}