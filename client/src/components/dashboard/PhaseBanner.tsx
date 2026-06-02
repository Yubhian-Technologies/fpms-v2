import { Clock, ClipboardCheck, Lock, ShieldCheck } from "lucide-react";
import type { Phase } from "@/hooks/useCollegePhase";

interface PhaseBannerProps {
  phase: Phase;
  deadlineLabel: string;
  /** The phases during which action is allowed. Banner only shows when phase is NOT in this list. */
  allowedPhases: Phase[];
}

export function PhaseBanner({ phase, deadlineLabel, allowedPhases }: PhaseBannerProps) {
  if (allowedPhases.includes(phase)) return null;

  const configs: Record<Phase, { icon: any; bg: string; border: string; text: string; msg: string }> = {
    submission: {
      icon: Clock,
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-400",
      text: "text-amber-800 dark:text-amber-300",
      msg: `Submission period is still open — faculty are still submitting. This action becomes available after the submission deadline. ${deadlineLabel}`,
    },
    evaluation: {
      icon: ClipboardCheck,
      bg: "bg-blue-50 dark:bg-blue-950/20",
      border: "border-blue-400",
      text: "text-blue-800 dark:text-blue-300",
      msg: `Evaluation period is active. ${deadlineLabel}`,
    },
    appeal: {
      icon: ClipboardCheck,
      bg: "bg-purple-50 dark:bg-purple-950/20",
      border: "border-purple-400",
      text: "text-purple-800 dark:text-purple-300",
      msg: `Evaluation period has ended — scores are being appealed. ${deadlineLabel}`,
    },
    "appeal-review": {
      icon: ShieldCheck,
      bg: "bg-orange-50 dark:bg-orange-950/20",
      border: "border-orange-400",
      text: "text-orange-800 dark:text-orange-300",
      msg: `Appeal review period. No new appeals can be raised. ${deadlineLabel}`,
    },
    locked: {
      icon: Lock,
      bg: "bg-gray-50 dark:bg-gray-900/20",
      border: "border-gray-400",
      text: "text-gray-700 dark:text-gray-400",
      msg: "All scores are final and locked. No further changes are permitted.",
    },
  };

  const cfg = configs[phase];
  const Icon = cfg.icon;

  return (
    <div className={`flex items-start gap-3 rounded-lg border-l-4 ${cfg.border} ${cfg.bg} px-4 py-3 mb-6`}>
      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${cfg.text}`} />
      <p className={`text-sm font-medium ${cfg.text}`}>{cfg.msg}</p>
    </div>
  );
}
