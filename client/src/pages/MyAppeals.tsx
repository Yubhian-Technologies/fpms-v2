import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertCircle, BookOpen, Folder } from "lucide-react";
import { api } from "@/api/api";

/* ================= TYPES ================= */

interface Submission {
  taskId: string;
  taskName: string;
  formTitle?: string;
  criteriaName?: string;
  moduleName?: string;
  claimedScore?: number;
  reviewerScore?: number;
  finalScore?: number;
  appealerScore?: number;
  maxMarks?: number;
  appealReason?: string;
  createdAt?: any;
  status?: string;
}

/* ================= COMPONENT ================= */

export default function MyAppeals() {
  const { user } = useAuth();
  const [appeals, setAppeals] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchAppeals = async () => {
      try {
        const res = await api.get("/api/submissions/my-submissions", {
          headers: {
            "x-user-id": user.uid,
            "x-user-email": user.email || "",
            "x-user-role": user.role,
          },
        });

        if (res.data.success) {
          const filtered = (res.data.data || []).filter(
            (sub: Submission) =>
              sub.status === "appealed" ||
              sub.status === "appeal-resolved"
          );

          setAppeals(filtered);
        }
      } catch (err) {
        console.error("Failed to fetch appeals:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAppeals();
  }, [user]);

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <DashboardLayout title="My Appeals">
        <div className="flex items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
          <Clock className="animate-spin h-6 w-6" />
          Loading appeals...
        </div>
      </DashboardLayout>
    );
  }

  /* ================= GROUP BY CRITERIA → MODULE ================= */

  const groupedAppeals = appeals.reduce<Record<string, Record<string, Submission[]>>>(
    (acc, sub) => {
      const criteria = sub.criteriaName || "Other Criteria";
      const module = sub.moduleName || "General";

      if (!acc[criteria]) acc[criteria] = {};
      if (!acc[criteria][module]) acc[criteria][module] = [];

      acc[criteria][module].push(sub);
      return acc;
    },
    {}
  );

  /* ================= RENDER ================= */

  return (
    <DashboardLayout
      title="My Appeals"
      subtitle="Browse your appeals grouped by criteria and module"
    >
      {appeals.length === 0 ? (
        <div className="border border-dashed rounded-lg py-16 text-center text-muted-foreground">
          <AlertCircle className="mx-auto h-10 w-10 mb-3" />
          No appeals found
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {Object.entries(groupedAppeals).map(([criteriaName, modules]) => {
            const totalModules = Object.keys(modules).length;
            const totalSubs = Object.values(modules).reduce(
              (sum, subs) => sum + subs.length,
              0
            );

            return (
              <AccordionItem
                key={criteriaName}
                value={criteriaName}
                className="border rounded-lg shadow-sm"
              >
                <AccordionTrigger className="px-6 py-4 bg-muted/30 hover:bg-muted/50 text-lg font-semibold">
                  <div className="flex justify-between w-full pr-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      {criteriaName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {totalModules} Modules • {totalSubs} Appeals
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-6 pb-6 pt-3 bg-background">
                  <Accordion type="multiple" className="space-y-3">
                    {Object.entries(modules).map(([moduleName, subs]) => (
                      <AccordionItem
                        key={moduleName}
                        value={`${criteriaName}-${moduleName}`}
                        className="border rounded-md shadow-inner"
                      >
                        <AccordionTrigger className="px-5 py-3 bg-secondary/10 hover:bg-secondary/20">
                          <div className="flex justify-between w-full pr-4">
                            <div className="flex items-center gap-2">
                              <Folder className="h-4 w-4 text-primary" />
                              {moduleName}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {subs.length} item{subs.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent className="px-5 pb-5 pt-3 bg-background">
                          <div className="space-y-4">
                            {subs.map((sub) => {
                              const effectiveScore =
                                sub.appealerScore ??
                                sub.finalScore ??
                                sub.reviewerScore ??
                                sub.claimedScore ??
                                0;

                              const progress =
                                sub.maxMarks && sub.maxMarks > 0
                                  ? (effectiveScore / sub.maxMarks) * 100
                                  : 0;

                              // Safe Date Handling
                              let submittedDate = "";
                              if (sub.createdAt?.seconds) {
                                submittedDate = new Date(
                                  sub.createdAt.seconds * 1000
                                ).toLocaleDateString();
                              } else if (sub.createdAt) {
                                submittedDate = new Date(
                                  sub.createdAt
                                ).toLocaleDateString();
                              }

                              return (
                                <Card
                                  key={sub.taskId}
                                  className="border shadow-sm hover:shadow-md transition-shadow"
                                >
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-base">
                                      {sub.taskName}
                                    </CardTitle>
                                    <CardDescription>
                                      {sub.formTitle}
                                    </CardDescription>
                                  </CardHeader>

                                  <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                      <p>
                                        <span className="font-medium">
                                          Claimed:
                                        </span>{" "}
                                        {sub.claimedScore ?? 0}
                                      </p>
                                      <p>
                                        <span className="font-medium">
                                          Reviewer:
                                        </span>{" "}
                                        {sub.reviewerScore ?? "—"}
                                      </p>
                                      <p>
                                        <span className="font-medium">
                                          Final:
                                        </span>{" "}
                                        {sub.finalScore ?? "Pending"}
                                      </p>
                                      <p>
                                        <span className="font-medium">
                                          Appeal Score:
                                        </span>{" "}
                                        {sub.appealerScore ?? "Pending"}
                                      </p>
                                      <p>
                                        <span className="font-medium">
                                          Max Marks:
                                        </span>{" "}
                                        {sub.maxMarks ?? 0}
                                      </p>
                                    </div>

                                    <div className="space-y-2">
                                      <div className="flex justify-between text-sm">
                                        <span>Score Progress</span>
                                        <span>
                                          {progress.toFixed(1)}%
                                        </span>
                                      </div>
                                      <Progress
                                        value={progress}
                                        className="h-2"
                                      />
                                    </div>

                                    {sub.appealReason && (
                                      <div className="bg-muted/40 rounded-md p-3 text-sm">
                                        <span className="font-medium">
                                          Appeal Reason:
                                        </span>
                                        <p className="mt-1 text-muted-foreground">
                                          {sub.appealReason}
                                        </p>
                                      </div>
                                    )}

                                    {submittedDate && (
                                      <div className="text-xs text-muted-foreground">
                                        Submitted on {submittedDate}
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </DashboardLayout>
  );
}