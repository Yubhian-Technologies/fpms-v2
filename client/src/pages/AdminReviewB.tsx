import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/api/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCollegePhase } from "@/hooks/useCollegePhase";
import { PhaseBanner } from "@/components/dashboard/PhaseBanner";

type Criterion = {
  name: string;
  claimedScore: number;
  maxScore: number;
  adminScore?: number | null;
  adminDescription?: string;
  isVerified?: boolean;
};

type Subsection = {
  id: string;
  name: string;
  criteria: Criterion[];
};

type HodSubmission = {
  hodId: string;
  hodName: string;
  department: string;
  college: string;
  subsections: Subsection[];
};

export default function AdminReviewB() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { phase, deadlineLabel } = useCollegePhase();

  const [data, setData] = useState<HodSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedHod, setExpandedHod] = useState<string | null>(null);
  const [expandedSubs, setExpandedSubs] = useState<string[]>([]);
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/hod/partb/admin/all-submissions");
      setData(res.data.data || []);
    } catch {
      toast({ title: "Failed to load submissions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (String(user?.role || "").toLowerCase() === "principle") loadData();
  }, [user]);

  const verifyCriterion = async (
    hodId: string,
    subId: string,
    c: Criterion,
    adminScore: number,
    adminDesc: string,
  ) => {
    const key = `${hodId}-${subId}-${c.name}`;
    try {
      setVerifying((v) => ({ ...v, [key]: true }));
      await api.put(
        `/api/hod/partb/admin/verify/${hodId}/${subId}/${encodeURIComponent(
          c.name,
        )}`,
        { adminScore, adminDescription: adminDesc },
      );
      toast({ title: "Criterion verified" });
      loadData();
    } catch {
      toast({ title: "Verification failed", variant: "destructive" });
    } finally {
      setVerifying((v) => ({ ...v, [key]: false }));
    }
  };

  // Only principle can access (case-insensitive)
  if (!user || String(user.role || "").toLowerCase() !== "principle")
    return null;

  if (loading) {
    return (
      <DashboardLayout title="Admin Review – Module 1">
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const filtered = data.filter(
    (h) =>
      h.hodName.toLowerCase().includes(search.toLowerCase()) ||
      h.department.toLowerCase().includes(search.toLowerCase()),
  );

  const renderHodCard = (hod: HodSubmission, type: "pending" | "verified") => {
    const subs = hod.subsections
      .map((s) => ({
        ...s,
        criteria:
          type === "pending"
            ? s.criteria.filter((c) => !c.isVerified)
            : s.criteria.filter((c) => c.isVerified),
      }))
      .filter((s) => s.criteria.length > 0);

    if (subs.length === 0) return null;

    const hodKey = `${hod.hodId}-${type}`;

    return (
      <Card
        key={hodKey}
        className="border shadow-sm hover:shadow-md transition-shadow duration-200"
      >
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg font-semibold">
              {hod.hodName}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {hod.department} • {hod.college}
            </p>
          </div>
          <Button
            size="sm"
            variant={expandedHod === hodKey ? "default" : "outline"}
            onClick={() =>
              setExpandedHod(expandedHod === hodKey ? null : hodKey)
            }
            className="min-w-[80px]"
          >
            {expandedHod === hodKey ? "Hide" : "View"}
          </Button>
        </CardHeader>

        {expandedHod === hodKey && (
          <CardContent className="space-y-6 pt-2">
            {subs.map((sub) => {
              const subKey = `${hod.hodId}-${sub.id}-${type}`;
              const open = expandedSubs.includes(subKey);

              return (
                <div
                  key={sub.id}
                  className="border rounded-lg overflow-hidden bg-card shadow-sm"
                >
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
                    <h3 className="font-medium text-primary">{sub.name}</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setExpandedSubs((p) =>
                          p.includes(subKey)
                            ? p.filter((x) => x !== subKey)
                            : [...p, subKey],
                        )
                      }
                    >
                      {open ? "Hide criteria" : "Show criteria"}
                    </Button>
                  </div>

                  {open && (
                    <div className="p-4 space-y-4">
                      {sub.criteria.map((c) => {
                        const key = `${hod.hodId}-${sub.id}-${c.name}`;
                        const isVerifying = verifying[key];

                        return (
                          <div
                            key={c.name}
                            className={`p-4 rounded-lg border transition-colors ${
                              c.isVerified
                                ? "bg-green-50/70 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                                : "bg-muted/30 border-border hover:bg-muted/50"
                            }`}
                          >
                            <div className="grid gap-5 md:grid-cols-3 items-start">
                              {/* Left - Info */}
                              <div className="space-y-2 text-sm">
                                <div className="font-medium">{c.name}</div>
                                <div className="text-muted-foreground">
                                  Claimed:{" "}
                                  <span className="font-semibold text-foreground">
                                    {c.claimedScore} / {c.maxScore}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground block">
                                  Admin Score
                                </label>
                                <Input
                                  type="number"
                                  disabled={c.isVerified || isVerifying}
                                  defaultValue={c.adminScore ?? c.claimedScore}
                                  onChange={(e) => {
                                    c.adminScore = Number(e.target.value);
                                  }}
                                  className="h-9"
                                />
                              </div>

                              {/* Right - Remark + Action */}
                              <div className="space-y-3">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-muted-foreground block">
                                    Admin Remarks
                                  </label>
                                  <Textarea
                                    disabled={c.isVerified || isVerifying}
                                    placeholder="Enter verification remarks or justification..."
                                    defaultValue={c.adminDescription}
                                    onChange={(e) => {
                                      c.adminDescription = e.target.value;
                                    }}
                                    className="min-h-[70px] resize-none"
                                  />
                                </div>

                                <div className="flex justify-end">
                                  {c.isVerified ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled
                                      className="bg-green-600/10 text-green-700 border-green-200 hover:bg-green-600/20 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                                    >
                                      Verified
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      disabled={isVerifying || phase !== "evaluation"}
                                      onClick={() =>
                                        verifyCriterion(
                                          hod.hodId,
                                          sub.id,
                                          c,
                                          c.adminScore ?? 0,
                                          c.adminDescription ?? "",
                                        )
                                      }
                                      className="min-w-[90px]"
                                    >
                                      {isVerifying ? (
                                        <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          Verifying...
                                        </>
                                      ) : (
                                        "Verify"
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <DashboardLayout title="Admin Review – Module 1">
      <PhaseBanner phase={phase} deadlineLabel={deadlineLabel} allowedPhases={["evaluation"]} />
      <div className="space-y-6">
        <Input
          placeholder="Search by HOD name or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />

        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Pending Review</h2>
            <div className="space-y-5">
              {filtered.map((h) => renderHodCard(h, "pending"))}
              {filtered.every((h) => !renderHodCard(h, "pending")) && (
                <p className="text-center text-muted-foreground py-8">
                  No pending submissions to review
                </p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Verified Submissions</h2>
            <div className="space-y-5">
              {filtered.map((h) => renderHodCard(h, "verified"))}
              {filtered.every((h) => !renderHodCard(h, "verified")) && (
                <p className="text-center text-muted-foreground py-8">
                  No verified submissions yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
