// src/components/dashboard/ScoreOverview.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface ScoreCategory {
  name: string;
  score: number;
  maxScore: number;
  color: string;
  usingClaimed?: boolean;
}

interface ScoreOverviewProps {
  submissions: any[];
  userTarget?: string | number; // from designation target
  targetLabel?: string; // e.g. "with PhD" or "without PhD"
}

export function ScoreOverview({
  submissions,
  userTarget,
  targetLabel,
}: ScoreOverviewProps) {
  console.log("ScoreOverview received submissions:", submissions);
  console.log("User Target:", userTarget);

  const categoriesMap: Record<string, ScoreCategory> = {};

  submissions.forEach((sub: any) => {
    const critName = sub.criteriaName?.trim();
    if (!critName) return;

    const claimed = Number(sub.claimedScore ?? 0);
    const reviewer =
      sub.reviewerScore != null ? Number(sub.reviewerScore) : null;
    const appeal = sub.appealScore != null ? Number(sub.appealScore) : null;
    const final = sub.finalScore != null ? Number(sub.finalScore) : null;

    // Correct unified priority logic
    let displayScore =
      appeal != null
        ? appeal
        : final != null
          ? final
          : reviewer != null
            ? reviewer
            : claimed;
    const isUsingClaimed = sub.finalScore == null && sub.claimedScore != null;

    const criteriaTotal = Number(sub.criteriaTotalMarks ?? sub.maxMarks ?? 0);

    if (!categoriesMap[critName]) {
      categoriesMap[critName] = {
        name: critName,
        score: 0,
        maxScore: criteriaTotal,
        color: getColorForCriteria(critName),
        usingClaimed: false,
      };
    }

    categoriesMap[critName].score += displayScore;
    if (isUsingClaimed) {
      categoriesMap[critName].usingClaimed = true;
    }

    if (criteriaTotal > categoriesMap[critName].maxScore) {
      categoriesMap[critName].maxScore = criteriaTotal;
    }
  });

  const displayCategories = Object.values(categoriesMap);

  const totalScore = displayCategories.reduce((sum, cat) => sum + cat.score, 0);
  const maxTotalScore = displayCategories.reduce(
    (sum, cat) => sum + cat.maxScore,
    0,
  );
  // Progress ring always calculated out of 300
  const TOTAL_MAX = 300;
  const percentComplete = Math.min(
    100,
    Math.round((totalScore / TOTAL_MAX) * 100),
  );

  // ─── TARGET LOGIC ───
  const targetNum =
    typeof userTarget === "string" && userTarget !== "Not assigned"
      ? Number(userTarget.trim())
      : typeof userTarget === "number"
        ? userTarget
        : null;

  const targetStatus =
    targetNum !== null
      ? totalScore >= targetNum
        ? "achieved" // green
        : totalScore >= targetNum * 0.8
          ? "near"
          : "below"
      : "no-target";

  const targetColor = {
    achieved: "text-green-600 dark:text-green-400",
    near: "text-amber-600 dark:text-amber-400",
    below: "text-red-600 dark:text-red-400",
    "no-target": "text-muted-foreground",
  }[targetStatus];

  const anyUsingClaimed = displayCategories.some((c) => c.usingClaimed);

  if (displayCategories.length === 0) {
    return (
      <Card className="overflow-hidden min-h-[500px] flex flex-col justify-center">
        <CardContent className="text-center text-muted-foreground py-12">
          No submissions with scores yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden min-h-[80%]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Score Overview</CardTitle>
          <span className="text-sm text-muted-foreground">Live Data</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Circular Total with Target Status */}
        <div className="flex items-center justify-center py-6">
          <div className="relative flex h-48 w-48 items-center justify-center">
            <svg
              className="absolute h-full w-full -rotate-90"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={
                  targetStatus === "achieved"
                    ? "hsl(var(--success))"
                    : targetStatus === "near"
                      ? "hsl(var(--warning))"
                      : targetStatus === "below"
                        ? "hsl(var(--destructive))"
                        : "hsl(var(--primary))"
                }
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${percentComplete * 2.83} 283`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            <div className="text-center">
              <span className="text-4xl font-bold text-foreground">
                {totalScore}
              </span>
              <span className="text-xl text-muted-foreground"> / 300</span>
              <p className=" text-sm font-medium text-muted-foreground">
                Total Score
              </p>

              {/* Target Display */}
              {targetNum !== null ? (
                <div className="">
                  <p className={`text-base  font-semibold ${targetColor}`}>
                    Target: {targetNum}
                  </p>
                  {targetLabel && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {targetLabel}
                    </p>
                  )}
                  <p className={`text-xs mt-1 ${targetColor}`}>
                    {targetStatus === "achieved" && "Goal Achieved ✓"}
                    {targetStatus === "near" && "Close to Target"}
                    {targetStatus === "below" && "Needs Improvement"}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  No target assigned
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bars */}
        <div className="space-y-4">
          {displayCategories.map((category) => {
            const percent =
              category.maxScore > 0
                ? Math.round((category.score / category.maxScore) * 100)
                : 0;

            // Color based on proximity to max: <50% → red, 50-79% → amber, ≥80% → green
            const barColor =
              percent >= 80
                ? "bg-green-500"
                : percent >= 50
                  ? "bg-amber-400"
                  : "bg-red-500";

            const textColor =
              percent >= 80
                ? "text-green-600 dark:text-green-400"
                : percent >= 50
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400";

            return (
              <div key={category.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{category.name}</span>
                  <span className={cn("font-semibold", textColor)}>
                    {category.score} / {category.maxScore}
                  </span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out",
                      barColor,
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Your getColorForCriteria function (unchanged)
function getColorForCriteria(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("teach")) return "bg-primary";
  if (lower.includes("research")) return "bg-red-500";
  if (lower.includes("professional")) return "bg-yellow-500";
  if (lower.includes("student")) return "bg-green-500";
  if (lower.includes("instit")) return "bg-blue-500";

  const colors = [
    "bg-primary",
    "bg-accent",
    "bg-blue-500",
    "bg-green-500",
    "bg-amber-500",
    "bg-purple-500",
  ];
  const index =
    Math.abs(name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) %
    colors.length;
  return colors[index];
}
