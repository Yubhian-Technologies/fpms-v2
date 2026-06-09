import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarClock, ClipboardCheck, MessageSquare, Lock, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";

type Phase = "submission" | "evaluation" | "appeal" | "appeal-review" | "locked";

interface PhaseConfig {
  label: string;
  icon: React.ElementType;
  borderColor: string;
  bg: string;
  textColor: string;
  iconBg: string;
  iconColor: string;
}

const PHASE_CONFIG: Record<Phase, PhaseConfig> = {
  submission: {
    label: "Submission Period",
    icon: CalendarClock,
    borderColor: "border-l-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    textColor: "text-amber-700 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600",
  },
  evaluation: {
    label: "Evaluation Period",
    icon: ClipboardCheck,
    borderColor: "border-l-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    textColor: "text-blue-700 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600",
  },
  appeal: {
    label: "Appeal Period",
    icon: MessageSquare,
    borderColor: "border-l-purple-500",
    bg: "bg-purple-50 dark:bg-purple-950/20",
    textColor: "text-purple-700 dark:text-purple-400",
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600",
  },
  "appeal-review": {
    label: "Appeal Review Period",
    icon: ShieldCheck,
    borderColor: "border-l-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    textColor: "text-orange-700 dark:text-orange-400",
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600",
  },
  locked: {
    label: "Scores Locked",
    icon: Lock,
    borderColor: "border-l-gray-500",
    bg: "bg-gray-50 dark:bg-gray-900/20",
    textColor: "text-gray-700 dark:text-gray-400",
    iconBg: "bg-gray-100 dark:bg-gray-800/30",
    iconColor: "text-gray-600",
  },
};

const toEndOfDay = (s: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  d.setHours(23, 59, 59, 999);
  return d;
};

const fmt = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Not set";

const daysUntil = (s: string | null): number | null => {
  const d = toEndOfDay(s);
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

export function DeadlineAlert() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [evaluationEnd, setEvaluationEnd] = useState<string | null>(null);
  const [appealEnd, setAppealEnd] = useState<string | null>(null);
  const [appealReviewEnd, setAppealReviewEnd] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("submission");

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    api
      .get("/api/colleges/user-deadline", {
        headers: {
          "x-user-id": user.uid || user.id || "",
          "x-user-role": user.role || "",
          "x-college": user.college || "",
        },
      })
      .then((res) => {
        if (!res.data.success) return;
        const d = res.data.data;
        setDeadline(d.assessmentEnd || d.deadline || null);
        setEvaluationEnd(d.evaluationEnd || null);
        setAppealEnd(d.appealEnd || null);
        setAppealReviewEnd(d.appealReviewEnd || null);

        const now = new Date();
        const dl = toEndOfDay(d.assessmentEnd || d.deadline);
        const ev = toEndOfDay(d.evaluationEnd);
        const ap = toEndOfDay(d.appealEnd);
        const apRev = toEndOfDay(d.appealReviewEnd);
        if (!dl || now <= dl) setPhase("submission");
        else if (!ev || now <= ev) setPhase("evaluation");
        else if (!ap || now <= ap) setPhase("appeal");
        else if (!apRev || now <= apRev) setPhase("appeal-review");
        else setPhase("locked");
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user]);

  const cfg = PHASE_CONFIG[phase];
  const Icon = cfg.icon;

  const phaseDate: string | null =
    phase === "submission" ? deadline
    : phase === "evaluation" ? evaluationEnd
    : phase === "appeal" ? appealEnd
    : phase === "appeal-review" ? appealReviewEnd
    : null;

  const daysLeft = daysUntil(phaseDate);

  const phaseDesc =
    phase === "submission"
      ? daysLeft !== null && daysLeft >= 0
        ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining to submit`
        : "Deadline passed"
      : phase === "evaluation"
      ? daysLeft !== null && daysLeft >= 0
        ? `HODs can evaluate for ${daysLeft} more day${daysLeft !== 1 ? "s" : ""}`
        : "Evaluation period ended"
      : phase === "appeal"
      ? daysLeft !== null && daysLeft >= 0
        ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left to appeal`
        : "Appeal period ended"
      : phase === "appeal-review"
      ? daysLeft !== null && daysLeft >= 0
        ? `Reviewers have ${daysLeft} day${daysLeft !== 1 ? "s" : ""} to resolve appeals`
        : "Appeal review period ended"
      : "All scores are final";

  return (
    <Card
      className={cn(
        "overflow-hidden shadow-sm border border-l-4",
        cfg.borderColor,
        cfg.bg,
      )}
    >
      <CardContent className="flex items-center justify-between p-5 gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-full", cfg.iconBg)}>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Icon className={cn("h-6 w-6", cfg.iconColor)} />
            )}
          </div>
          <div>
            <p className={cn("text-sm font-medium", cfg.textColor)}>{cfg.label}</p>
            <p className="text-xl font-bold mt-0.5">{isLoading ? "—" : fmt(phaseDate)}</p>
          </div>
        </div>
        <p className={cn("text-sm font-bold", cfg.textColor)}>
          {isLoading ? "Loading..." : phaseDesc}
        </p>
      </CardContent>
    </Card>
  );
}
