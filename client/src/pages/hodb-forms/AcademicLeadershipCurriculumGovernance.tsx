import { useEffect, useState } from "react";
import { api } from "@/api/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/contexts/AuthContext";

const KPA_STRUCTURE = {
  "KPA-A": {
    title: "Academic Leadership & Curriculum Governance",
    maxPoints: 30,
    criteria: {
      A1: { label: "Department Academic Plan & Execution", maxScore: 8 },
      A2: { label: "OBE Implementation & Attainment Monitoring", maxScore: 8 },
      A3: { label: "Curriculum Enrichment & BoS Inputs", maxScore: 7 },
      A4: { label: "Academic Risk Identification & Mitigation", maxScore: 7 },
    },
  },
  "KPA-B": {
    title: "Student Success, Progression & Placements",
    maxPoints: 25,
    criteria: {
      B1: { label: "Academic Performance Trends", maxScore: 6 },
      B2: { label: "Placement Outcomes (Quantity & Quality)", maxScore: 6 },
      B3: { label: "Higher Education Progression", maxScore: 4 },
      B4: { label: "Mentoring & Remedial Systems", maxScore: 5 },
      B5: { label: "Competency & Career Readiness Programs", maxScore: 4 },
    },
  },
  "KPA-C": {
    title: "Faculty Enablement & Research Ecosystem",
    maxPoints: 20,
    criteria: {
      C1: { label: "Department R&D Plan", maxScore: 5 },
      C2: { label: "Proposal Facilitation & Funding Enablement", maxScore: 5 },
      C3: { label: "Research Culture & Review Mechanisms", maxScore: 5 },
      C4: { label: "Faculty Participation Ratios", maxScore: 5 },
    },
  },
  "KPA-D": {
    title: "Accreditation, Quality & Data Governance",
    maxPoints: 20,
    criteria: {
      D1: { label: "NBA/NAAC Preparedness", maxScore: 7 },
      D2: { label: "Course Files & Attainment Records", maxScore: 5 },
      D3: { label: "NIRF / AQAR Data Accuracy", maxScore: 4 },
      D4: { label: "Internal Quality Review & Compliance", maxScore: 4 },
    },
  },
  "KPA-E": {
    title: "Industry, Alumni & External Engagement",
    maxPoints: 20,
    criteria: {
      E1: { label: "Functional Industry MoUs", maxScore: 6 },
      E2: { label: "Industry Projects & Internships", maxScore: 6 },
      E3: { label: "Alumni Engagement & Contributions", maxScore: 4 },
      E4: { label: "Industry Inputs to Curriculum", maxScore: 4 },
    },
  },
  "KPA-F": {
    title: "Department Administration & Governance",
    maxPoints: 10,
    criteria: {
      F1: { label: "Resource & Budget Utilisation", maxScore: 3 },
      F2: { label: "Labs, Assets & Stock Audits", maxScore: 3 },
      F3: { label: "Department Meetings & Documentation", maxScore: 2 },
      F4: { label: "Non-Teaching Staff Development", maxScore: 2 },
    },
  },
};

type Criterion = {
  name: string;
  claimedScore: number;
  description?: string;
  evidence?: string;
  adminScore?: number | null;
  adminDescription?: string;
  committeeScore?: number | null;
  committeeRemarks?: string;
  isVerified?: boolean;
  maxScore: number;
};

type Subsection = {
  id: string;
  criteria: Criterion[];
};

type Appeal = {
  subId: string;
  criterionName: string;
  committeeScore?: number;
  committeeRemarks?: string;
  status: string;
};

export default function PartBKPAPage() {
  const { user, isLoading } = useAuth();
  const hodId = user?.id;

  const [subsections, setSubsections] = useState<Record<string, Subsection>>({});
  const [form, setForm] = useState<Record<string, Partial<Criterion>>>({});
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    if (!user || !hodId) return;
    try {
      // 1️⃣ Fetch Part B HOD data
      const res = await api.get(`/api/hod/partb/${hodId}`);
      const list = res.data?.data || [];

      // 2️⃣ Fetch HOD Appeals (committee-verified)
      const appealRes = await api.get("/api/hod/appeals/partab");
      const appeals: Appeal[] = appealRes.data?.data || [];

      const mapped: Record<string, Subsection> = {};
      list.forEach((s: any) => {
        if (!KPA_STRUCTURE[s.id]) return;

        mapped[s.id] = {
          id: s.id,
          criteria: (s.criteria || []).map((c: any) => {
            // Match committee-verified appeal
            const appeal = appeals.find(
              (a) =>
                a.subId === s.id &&
                a.criterionName === c.name &&
                a.status === "committee_verified"
            );

            return {
              name: c.name,
              claimedScore: c.claimedScore ?? 0,
              description: c.description ?? c.hodDescription ?? "",
              evidence: c.evidence ?? "",
              adminScore: c.adminScore ?? null,
              adminDescription: c.adminDescription ?? c.adminRemark ?? "",
              committeeScore: appeal?.committeeScore ?? null,
              committeeRemarks: appeal?.committeeRemarks ?? "",
              isVerified: c.isVerified ?? false,
              maxScore: KPA_STRUCTURE[s.id].criteria[c.name]?.maxScore ?? 0,
            };
          }),
        };
      });

      setSubsections(mapped);
    } catch (err) {
      console.error("Fetch failed", err);
    }
  };

  useEffect(() => {
    if (!isLoading && user) fetchData();
  }, [isLoading, user]);

  const getFinalScore = (existing: Criterion | undefined) => {
    if (!existing) return 0;
    // Committee score takes precedence if available
    return existing.committeeScore ?? existing.adminScore ?? existing.claimedScore;
  };

  const getKPAScore = (kpaId: string) => {
    const kpa = KPA_STRUCTURE[kpaId];
    if (!kpa) return 0;
    return Object.keys(kpa.criteria).reduce((sum, key) => {
      const existing = subsections[kpaId]?.criteria.find((c) => c.name === key);
      return sum + getFinalScore(existing);
    }, 0);
  };

  const totalMax = Object.values(KPA_STRUCTURE).reduce((sum, k) => sum + k.maxPoints, 0);
  const totalCurrent = Object.keys(KPA_STRUCTURE).reduce((sum, id) => sum + getKPAScore(id), 0);

  const submitCriterion = async (kpaId: string, key: string) => {
    const formKey = `${kpaId}.${key}`;
    const payload = form[formKey];
    if (!payload || !hodId) return;

    try {
      await api.post(`/api/hod/partb/${hodId}/subsection/${kpaId}`, {
        criteria: [
          {
            name: key,
            claimedScore: Number(payload.claimedScore ?? 0),
            maxScore: KPA_STRUCTURE[kpaId].criteria[key].maxScore,
            description: payload.description ?? "",
            evidence: payload.evidence ?? "",
          },
        ],
      });

      setEditMode((prev) => ({ ...prev, [formKey]: false }));
      fetchData();
    } catch (err) {
      console.error("Submit failed", err);
    }
  };

  return (
    <DashboardLayout title="HOD Part B" subtitle="KPAs">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Part B – KPAs</h1>
        </div>

        <Card>
          <CardContent className="pt-4">
            <Progress value={(totalCurrent / totalMax) * 100} />
            <p className="text-sm mt-2">
              Final Score: <b>{totalCurrent.toFixed(1)}</b> / {totalMax}
            </p>
          </CardContent>
        </Card>

        <Accordion type="single" collapsible defaultValue={Object.keys(KPA_STRUCTURE)[0]}>
          {Object.entries(KPA_STRUCTURE).map(([kpaId, kpa]) => (
            <AccordionItem key={kpaId} value={`section-${kpaId}`}>
              <AccordionTrigger>
                <div className="flex justify-between w-full pr-4">
                  <span>{kpaId} – {kpa.title}</span>
                  <Badge variant="outline">{getKPAScore(kpaId)} / {kpa.maxPoints}</Badge>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-1 py-4 space-y-5">
                {Object.entries(kpa.criteria).map(([key, def]) => {
                  const existing = subsections[kpaId]?.criteria.find((c) => c.name === key);
                  const formKey = `${kpaId}.${key}`;
                  const editing = editMode[formKey] && existing && !existing.isVerified;

                  const claimedScore = existing?.claimedScore ?? 0;
                  const description = existing?.description ?? "";
                  const evidence = existing?.evidence ?? "";
                  const adminScore = existing?.adminScore ?? null;
                  const adminDescription = existing?.adminDescription ?? "";
                  const committeeScore = existing?.committeeScore ?? null;
                  const committeeRemarks = existing?.committeeRemarks ?? "";
                  const isVerified = existing?.isVerified ?? false;
                  const finalScore = getFinalScore(existing);

                  if (!existing || editing) {
                    return (
                      <Card key={formKey} className="mb-3 border-2 border-primary/40 bg-muted/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">
                            {editing ? `Edit ${kpaId}.${key} – ${def.label}` : `${kpaId}.${key} – ${def.label}`}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <label className="text-sm font-medium block mb-1.5">Score (0 – {def.maxScore})</label>
                            <input
                              type="number"
                              min={0}
                              max={def.maxScore}
                              step={0.5}
                              value={form[formKey]?.claimedScore ?? claimedScore}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, [formKey]: { ...p[formKey], claimedScore: Number(e.target.value) } }))
                              }
                              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium block mb-1.5">Description</label>
                            <textarea
                              value={form[formKey]?.description ?? description}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, [formKey]: { ...p[formKey], description: e.target.value } }))
                              }
                              className="w-full border rounded-md px-3 py-2 min-h-[90px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium block mb-1.5">Evidence / Proof</label>
                            <textarea
                              value={form[formKey]?.evidence ?? evidence}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, [formKey]: { ...p[formKey], evidence: e.target.value } }))
                              }
                              className="w-full border rounded-md px-3 py-2 min-h-[90px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>

                          <div className="flex justify-end">
                            <Button size="sm" onClick={() => submitCriterion(kpaId, key)}>
                              <Save className="mr-2 h-4 w-4" /> Save
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }

                  return (
                    <Card key={formKey} className="mb-3">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex justify-between items-center">
                          <span>{kpaId}.{key} – {def.label}</span>
                          {!isVerified && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setForm((prev) => ({ ...prev, [formKey]: { claimedScore, description, evidence } }));
                                setEditMode((prev) => ({ ...prev, [formKey]: true }));
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </Button>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div>
                          <b>HOD Claim:</b> {claimedScore} / {def.maxScore}
                          {description && <p className="text-muted-foreground mt-1.5"><b>Description:</b> {description}</p>}
                          {evidence && <p className="text-muted-foreground mt-1.5"><b>Evidence:</b> {evidence}</p>}
                        </div>
                        {adminScore !== null && (
                          <div className="pt-3 border-t">
                            <b>Admin Score:</b> {adminScore}
                            {adminDescription && <p className="text-muted-foreground mt-1.5"><b>Remark:</b> {adminDescription}</p>}
                          </div>
                        )}
                        {committeeScore !== null && (
                          <div className="pt-3 border-t bg-green-50 rounded-md p-2">
                            <b>Committee Score:</b> {committeeScore}
                            {committeeRemarks && <p className="text-muted-foreground mt-1.5"><b>Remarks:</b> {committeeRemarks}</p>}
                          </div>
                        )}
                        <div className="font-semibold pt-2 border-t">
                          Final: {finalScore} / {def.maxScore}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </DashboardLayout>
  );
}