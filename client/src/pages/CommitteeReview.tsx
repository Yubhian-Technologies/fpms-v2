import { useEffect, useState, memo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { api } from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "react-hot-toast";
import { useCollegePhase } from "@/hooks/useCollegePhase";
import { PhaseBanner } from "@/components/dashboard/PhaseBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface HodAppeal {
  id: string;
  module: string;
  subId: string;
  criterionName: string;
  hodId: string;
  claimedScore: number;
  hodScore: number;
  requestedScore: number;
  hodDescription: string;
  evidence: string;
  status: string;
  verifiedByCommittee?: boolean;
  committeeScore?: number;
  committeeRemarks?: string;
  createdAt: string;
}

const AppealCard = memo(
  ({ appeal, expanded, input, onExpand, onChange, onSubmit, disabled }: any) => {
    const verified = appeal.verifiedByCommittee;

    return (
      <Card className="border shadow-sm">
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle className="text-sm font-semibold">
              {appeal.module} • {appeal.subId}
            </CardTitle>
            <Badge className="mt-1">{appeal.criterionName}</Badge>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={verified ? "default" : "secondary"}>
              {verified ? "Verified" : "Pending"}
            </Badge>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => onExpand(appeal.id)}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium">Claimed Score</p>
                <p>{appeal.claimedScore}</p>
              </div>
              <div>
                <p className="font-medium">HOD Score</p>
                <p>{appeal.hodScore ?? "-"}</p>
              </div>
              <div>
                <p className="font-medium">Requested Score</p>
                <p className="text-primary font-semibold">
                  {appeal.requestedScore}
                </p>
              </div>
            </div>

            <div>
              <p className="font-medium text-sm">HOD Description</p>
              <p className="text-sm">{appeal.hodDescription}</p>
            </div>

            <div>
              <p className="font-medium text-sm">Evidence</p>
              <p className="text-sm break-words">{appeal.evidence || "-"}</p>
            </div>

            {!verified && (
              <div className="border p-4 rounded-lg space-y-3">
                <Input
                  type="number"
                  placeholder="Committee Score"
                  value={input?.score || ""}
                  onChange={(e) =>
                    onChange(appeal.id, "score", Number(e.target.value))
                  }
                />

                <Textarea
                  placeholder="Committee Remarks"
                  value={input?.remarks || ""}
                  onChange={(e) =>
                    onChange(appeal.id, "remarks", e.target.value)
                  }
                />

                <Button onClick={() => onSubmit(appeal)} disabled={disabled}>Verify Appeal</Button>
              </div>
            )}

            {verified && (
              <div className="bg-green-50 p-4 rounded">
                <p className="font-semibold">
                  Final Score: {appeal.committeeScore}
                </p>

                {appeal.committeeRemarks && (
                  <p className="text-sm mt-2">
                    Remarks: {appeal.committeeRemarks}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  },
);

export default function CommitteeReview() {
  const { user, isLoading } = useAuth();
  const { phase, deadlineLabel } = useCollegePhase();
  const [appeals, setAppeals] = useState<HodAppeal[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [inputs, setInputs] = useState<any>({});
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && user) {
      fetchHodAppeals();
    }
  }, [user, isLoading]);

  const fetchHodAppeals = async () => {
    try {
      setIsPageLoading(true);
      const token = localStorage.getItem("token");

      const res = await api.get("/api/committee/hod-appeals", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const appealData = Array.isArray(res.data?.data) ? res.data.data : [];
      setAppeals(appealData);

      const temp: any = {};
      appealData.forEach((a: HodAppeal) => {
        temp[a.id] = {
          score: a.committeeScore ?? "",
          remarks: a.committeeRemarks ?? "",
        };
      });

      setInputs(temp);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to load appeals");
    } finally {
      setIsPageLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleChange = (id: string, field: string, value: any) => {
    setInputs((prev: any) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const verifyAppeal = async (appeal: HodAppeal) => {
    const input = inputs[appeal.id];

    if (!input?.score) {
      toast.error("Score required");
      return;
    }

    try {
      const token = localStorage.getItem("token");

      await api.put(
        `/api/committee/hod-appeals/${appeal.id}`,
        {
          committeeScore: input.score,
          committeeRemarks: input.remarks || "",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      toast.success("Appeal verified successfully");
      fetchHodAppeals();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Verification failed");
    }
  };

  const pending = appeals.filter((a) => !a.verifiedByCommittee);
  const verified = appeals.filter((a) => a.verifiedByCommittee);

  const appealPhaseBlocked = !["appeal", "appeal-review"].includes(phase);

  return (
    <DashboardLayout title="HOD Appeals">
      <PhaseBanner phase={phase} deadlineLabel={deadlineLabel} allowedPhases={["appeal", "appeal-review"]} />
      {isPageLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-bold mb-4">Pending Appeals</h2>
            <div className="grid gap-4">
              {pending.map((a) => (
                <AppealCard
                  key={a.id}
                  appeal={a}
                  expanded={expanded.includes(a.id)}
                  input={inputs[a.id]}
                  onExpand={toggleExpand}
                  onChange={handleChange}
                  onSubmit={verifyAppeal}
                  disabled={appealPhaseBlocked}
                />
              ))}
              {pending.length === 0 && (
                <p className="text-center text-muted-foreground py-6 border rounded-lg bg-muted/20">
                  No pending appeals available.
                </p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4">Verified Appeals</h2>
            <div className="grid gap-4">
              {verified.map((a) => (
                <AppealCard
                  key={a.id}
                  appeal={a}
                  expanded={expanded.includes(a.id)}
                  input={inputs[a.id]}
                  onExpand={toggleExpand}
                  onChange={handleChange}
                  onSubmit={verifyAppeal}
                  disabled={appealPhaseBlocked}
                />
              ))}
              {verified.length === 0 && (
                <p className="text-center text-muted-foreground py-6 border rounded-lg bg-muted/20">
                  No verified appeals available.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
