import { getConfirmedScore } from "@/lib/utils";
import { CategoryCard } from "./CategoryCard";

interface Submission {
  criteriaName: string;
  criteriaId: string;
  criteriaTotalMarks?: number;
  formId: string;
  formTitle?: string;
  finalScore?: number | null;
  claimedScore?: number | null;
  maxMarks: number;
  status: string;
  moduleName?: string;
  taskName?: string;
  // ... other fields
}

interface FPMSFormOverviewProps {
  submissions: Submission[];
}

export function FPMSFormOverview({ submissions }: FPMSFormOverviewProps) {
  const grouped = submissions.reduce<Record<string, Submission[]>>((acc, sub) => {
    const crit = sub.criteriaName?.trim();
    if (crit) {
      if (!acc[crit]) acc[crit] = [];
      acc[crit].push(sub);
    }
    return acc;
  }, {});

  const displayCategories = Object.entries(grouped)
    .map(([title, subs]) => {
      let score = 0;
      let maxScore = 0;
      let completedItems = 0;

      subs.forEach((sub) => {
        score += getConfirmedScore(sub);

        // Use criteriaTotalMarks for maxScore (take max value seen, assume consistent)
        if (sub.criteriaTotalMarks != null && sub.criteriaTotalMarks > maxScore) {
          maxScore = sub.criteriaTotalMarks;
        }

        if (sub.finalScore != null || ["accepted", "appeal-resolved"].includes(sub.status)) {
          completedItems++;
        }
      });

      const progress = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

      let status: "not-started" | "in-progress" | "complete" | "needs-review" = "not-started";
      if (progress >= 95) status = "complete";
      else if (progress > 30) status = "in-progress";
      else if (progress > 0) status = "needs-review";

      // Use first submission's IDs for navigation
      const first = subs[0];
      const hrefEdit = first ? `/fpms/forms/${first.formId}/criteria/${first.criteriaId}` : "#";
      const hrefView = first ? `/fpms/submissions/criteria/${first.criteriaId}` : "#"; // Full details page

      return {
        title,
        description: first?.formTitle ?? "",
        score: Math.round(score),
        maxScore: Math.round(maxScore),
        completedItems,
        totalItems: subs.length,
        status,
        hrefEdit,
        hrefView,
        submissions: subs,  // Pass real subs for modal
      };
    })
    .filter((cat) => cat.totalItems > 0 && cat.maxScore > 0)
    .sort((a, b) => b.score - a.score);

  if (displayCategories.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg">
        No performance data available yet
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {displayCategories.map((cat, i) => (
        <div
          key={cat.title}
          className="animate-fade-in opacity-0"
          style={{ animationDelay: `${i * 80}ms`, animationFillMode: "forwards" }}
        >
          <CategoryCard {...cat} />
        </div>
      ))}
    </div>
  );
}