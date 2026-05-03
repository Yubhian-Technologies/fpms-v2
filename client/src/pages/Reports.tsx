import { useState, useEffect, useCallback, memo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/api/api';
import { toast } from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';           // ← add this if not already present
import { ChevronDown, ChevronUp, User, Mail, Building, School } from 'lucide-react'; // ← optional nice icons

interface Faculty {
  name: string;
  email: string;
  department: string;
  college: string;
}

interface Appeal {
  id: string;
  facultyId?: string;
  faculty?: Faculty;
  facultyName?: string;
  module: string;
  subId: string;
  criterionName: string;
  claimedScore: number;
  facultyDescription: string;
  hodScore: number;
  hodDescription: string;
  requestedScore: number;
  appealReason: string;
  evidence: string;
  status: string;
  verifiedByCommittee?: boolean;
  committeeScore?: number;
  committeeRemarks?: string;
  createdAt: string;
}

// Memoized appeal card
const AppealCard = memo(
  ({
    appeal,
    isExpanded,
    input,
    verified,
    onExpand,
    onInputChange,
    onSubmit,
  }: {
    appeal: Appeal;
    isExpanded: boolean;
    input: { score: number; remarks: string };
    verified: boolean;
    onExpand: (id: string) => void;
    onInputChange: (id: string, field: 'score' | 'remarks', value: any) => void;
    onSubmit: (appeal: Appeal) => void;
  }) => {
    const faculty = appeal.faculty;

    return (
      <Card
        className={`overflow-hidden border ${
          verified ? 'border-green-200 bg-green-50/40' : 'border-amber-200 bg-amber-50/30'
        } shadow-sm hover:shadow transition-shadow`}
      >
        <CardHeader className="pb-3 pt-4 px-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">
                {appeal.module} • {appeal.subId}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {appeal.criterionName}
              </Badge>
            </div>

            {/* Faculty info — always visible */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span>{faculty?.name || appeal.facultyName || '—'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate max-w-[180px]">{faculty?.email || '—'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                <span>{faculty?.department || '—'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <School className="h-3.5 w-3.5" />
                <span className="truncate max-w-[160px]">{faculty?.college || '—'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={verified ? 'default' : 'secondary'} className="whitespace-nowrap">
              {verified ? 'Verified' : 'Pending'}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="px-2"
              onClick={() => onExpand(appeal.id)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="px-5 pb-5 pt-1 border-t bg-white/60">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm mb-5">
              <div>
                <p className="font-medium text-muted-foreground">Faculty Claim</p>
                <p className="font-semibold">{appeal.claimedScore}</p>
                <p className="mt-1 text-muted-foreground/90">{appeal.facultyDescription}</p>
              </div>

              <div>
                <p className="font-medium text-muted-foreground">HOD Evaluation</p>
                <p className="font-semibold">{appeal.hodScore}</p>
                <p className="mt-1 text-muted-foreground/90">{appeal.hodDescription}</p>
              </div>

              <div>
                <p className="font-medium text-muted-foreground">Requested Score</p>
                <p className="font-semibold text-primary">{appeal.requestedScore}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm mb-5">
              <div>
                <p className="font-medium text-muted-foreground">Appeal Reason</p>
                <p className="mt-0.5">{appeal.appealReason || '—'}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Evidence / Link</p>
                <p className="mt-0.5 break-words">{appeal.evidence || '—'}</p>
              </div>
            </div>

            {!verified && (
              <div className="bg-muted/40 p-4 rounded-lg border space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Committee Score *</label>
                    <Input
                      type="number"
                      min={0}
                      value={input.score}
                      onChange={(e) => onInputChange(appeal.id, 'score', Number(e.target.value))}
                      placeholder="Enter final score"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Remarks (optional)</label>
                    <Textarea
                      value={input.remarks}
                      onChange={(e) => onInputChange(appeal.id, 'remarks', e.target.value)}
                      placeholder="Add committee comments..."
                      rows={2}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => onSubmit(appeal)}
                  className="w-full sm:w-auto"
                >
                  Submit Verification
                </Button>
              </div>
            )}

            {verified && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="font-medium">Committee Decision</p>
                <p className="text-lg font-semibold mt-1">{appeal.committeeScore}</p>
                {appeal.committeeRemarks && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium">Remarks:</span> {appeal.committeeRemarks}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  }
);

export default function CommitteeAppeals() {
  const { user } = useAuth();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [committeeInputs, setCommitteeInputs] = useState<{ [key: string]: { score: number; remarks: string } }>({});

  useEffect(() => {
    if (!user) return;
    fetchAppeals();
  }, [user]);

  const fetchAppeals = async () => {
    try {
      const res = await api.get('/api/committee/appeals');
      setAppeals(res.data.data);

      const initialInputs: any = {};
      res.data.data.forEach((a: Appeal) => {
        initialInputs[a.id] = {
          score: a.committeeScore ?? 0,
          remarks: a.committeeRemarks ?? '',
        };
      });
      setCommitteeInputs(initialInputs);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to fetch appeals');
    }
  };

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleInputChange = useCallback((id: string, field: 'score' | 'remarks', value: any) => {
    setCommitteeInputs((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }, []);

  const submitCommitteeScore = useCallback(
    async (appeal: Appeal) => {
      const input = committeeInputs[appeal.id];
      if (!input || input.score === undefined) {
        toast.error('Score is required');
        return;
      }

      try {
        await api.put(`/api/committee/appeals/${appeal.id}`, {
          committeeScore: input.score,
          committeeRemarks: input.remarks || '',
        });

        setAppeals((prev) =>
          prev.map((a) =>
            a.id === appeal.id
              ? {
                  ...a,
                  verifiedByCommittee: true,
                  committeeScore: input.score,
                  committeeRemarks: input.remarks,
                  status: 'committee_verified',
                }
              : a
          )
        );

        toast.success('Appeal verified successfully');
      } catch (err: any) {
        console.error(err);
        toast.error(err.response?.data?.message || 'Failed to verify appeal');
      }
    },
    [committeeInputs]
  );

  const pendingAppeals = appeals.filter((a) => !(a.verifiedByCommittee ?? false));
  const verifiedAppeals = appeals.filter((a) => a.verifiedByCommittee ?? false);

  return (
    <DashboardLayout title="Committee Appeals">
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-bold tracking-tight mb-4">Pending Verifications</h2>
          {pendingAppeals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/30">
              No pending appeals at the moment.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
              {pendingAppeals.map((a) => (
                <AppealCard
                  key={a.id}
                  appeal={a}
                  isExpanded={expandedIds.includes(a.id)}
                  input={committeeInputs[a.id] || { score: a.committeeScore ?? 0, remarks: a.committeeRemarks ?? '' }}
                  verified={!!a.verifiedByCommittee}
                  onExpand={toggleExpand}
                  onInputChange={handleInputChange}
                  onSubmit={submitCommitteeScore}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-bold tracking-tight mb-4">Verified Appeals</h2>
          {verifiedAppeals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/30">
              No appeals have been verified yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
              {verifiedAppeals.map((a) => (
                <AppealCard
                  key={a.id}
                  appeal={a}
                  isExpanded={expandedIds.includes(a.id)}
                  input={committeeInputs[a.id] || { score: a.committeeScore ?? 0, remarks: a.committeeRemarks ?? '' }}
                  verified={!!a.verifiedByCommittee}
                  onExpand={toggleExpand}
                  onInputChange={handleInputChange}
                  onSubmit={submitCommitteeScore}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}