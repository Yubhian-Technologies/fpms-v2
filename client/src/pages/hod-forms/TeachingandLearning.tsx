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

const MODULE1_STRUCTURE = {
  "1.1": {
    title: "Curriculum Development (Beyond Curriculum)",
    maxPoints: 8,
    criteria: {
      a: { label: "New course / module development", maxScore: 3 },
      b: { label: "Digital content creation", maxScore: 3 },
      c: { label: "CO–PO–PSO mapping", maxScore: 2 },
    },
  },
  "1.2": {
    title: "Teaching Load & Active Learning Pedagogy",
    maxPoints: 10,
    criteria: {
      a: { label: "LMS usage", maxScore: 2 },
      b: { label: "Flipped classroom", maxScore: 2 },
      c: { label: "Experiential learning", maxScore: 2 },
      d: { label: "NPTEL facilitation", maxScore: 2 },
      e: { label: "Mini projects", maxScore: 2 },
    },
  },
  "1.3": {
    title: "Student Feedback & Improvement",
    maxPoints: 8,
    criteria: {
      a: { label: "Structured student feedback analysis", maxScore: 3 },
      b: { label: "Corrective actions implemented", maxScore: 3 },
      c: { label: "Outcome-based improvement measures", maxScore: 2 },
    },
  },
  "1.4": {
    title: "Student Academic Results",
    maxPoints: 10,
    criteria: {
      a: { label: "Pass percentage analysis", maxScore: 3 },
      b: { label: "University rank / distinction holders", maxScore: 3 },
      c: { label: "Result comparison with previous years", maxScore: 2 },
      d: { label: "Remedial measures for weak students", maxScore: 2 },
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

export default function TeachingandLearning() {
  const { user, isLoading } = useAuth();
  const hodId = user?.id;

  const [subsections, setSubsections] = useState<Record<string, Subsection>>({});
  const [form, setForm] = useState<Record<string, Partial<Criterion>>>({});
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
  if (!user || !hodId) return;
  try {
    // Fetch Module 1 HOD data
    const res = await api.get(`/api/hod/parta/${hodId}`);
    const list = res.data?.data || [];

    // Fetch HOD Appeals (committee verified)
    const appealRes = await api.get("/api/hod/appeals/partab");
    const appeals: Appeal[] = appealRes.data?.data || [];

    const mapped: Record<string, Subsection> = {};

    list.forEach((s: any) => {
      if (!s?.id) return;

      mapped[s.id] = {
        id: s.id,
        criteria: Array.isArray(s.criteria)
          ? s.criteria.map((c: any) => {
              // Look for a verified appeal for this criterion
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
                // ✅ Merge committee-approved appeal
                committeeScore: appeal?.committeeScore ?? c.committeeScore ?? null,
                committeeRemarks: appeal?.committeeRemarks ?? c.committeeRemarks ?? "",
                isVerified: c.isVerified ?? false,
                maxScore: MODULE1_STRUCTURE[s.id]?.criteria?.[c.name]?.maxScore ?? 0,
              };
            })
          : [],
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

  const getSubsectionScore = (subId: string) => {
    const subDef = MODULE1_STRUCTURE[subId as keyof typeof MODULE1_STRUCTURE];
    if (!subDef) return 0;
    return Object.keys(subDef.criteria).reduce((sum, key) => {
      const existing = subsections[subId]?.criteria?.find((c) => c.name === key);
      return sum + getFinalScore(existing);
    }, 0);
  };

  const totalMax = Object.values(MODULE1_STRUCTURE).reduce((s, m) => s + m.maxPoints, 0);
  const totalCurrent = Object.keys(MODULE1_STRUCTURE).reduce((s, id) => s + getSubsectionScore(id), 0);

  const submitCriterion = async (subId: string, key: string) => {
    const formKey = `${subId}.${key}`;
    const payload = form[formKey];
    if (!payload || !hodId) return;

    try {
      await api.post(`/api/hod/parta/${hodId}/subsection/${subId}`, {
        criteria: [
          {
            name: key,
            claimedScore: Number(payload.claimedScore ?? 0),
            maxScore: MODULE1_STRUCTURE[subId as keyof typeof MODULE1_STRUCTURE].criteria[key].maxScore,
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
    <DashboardLayout title="Teaching & Learning" subtitle="Module 1">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Module 1</h1>
        </div>

        {/* Total Progress */}
        <Card>
          <CardContent className="pt-4">
            <Progress value={(totalCurrent / totalMax) * 100} />
            <p className="text-sm mt-2">
              Final Score: <b>{totalCurrent.toFixed(1)}</b> / {totalMax}
            </p>
          </CardContent>
        </Card>

        {/* Accordion Sections */}
        <Accordion type="single" collapsible defaultValue="section-1.1">
          {Object.entries(MODULE1_STRUCTURE).map(([subId, sub]) => (
            <AccordionItem key={subId} value={`section-${subId}`}>
              <AccordionTrigger>
                <div className="flex justify-between w-full pr-4">
                  <span>{subId} – {sub.title}</span>
                  <Badge variant="outline">{getSubsectionScore(subId)} / {sub.maxPoints}</Badge>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-1 py-4 space-y-5">
                {Object.entries(sub.criteria).map(([key, def]) => {
                  const existing = subsections[subId]?.criteria?.find((cr) => cr.name === key);
                  const formKey = `${subId}.${key}`;
                  const editing = editMode[formKey] && existing && !existing.isVerified;

                  // Empty criterion (new entry)
                  if (!existing) {
                    return (
                      <Card key={formKey} className="mb-3 border-2 border-primary/40 bg-muted/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{subId}.{key} – {def.label}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <label className="text-sm font-medium block mb-1.5">Score (0 – {def.maxScore})</label>
                            <input
                              type="number"
                              min={0}
                              max={def.maxScore}
                              step={0.5}
                              value={form[formKey]?.claimedScore ?? ""}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, [formKey]: { ...p[formKey], claimedScore: Number(e.target.value) } }))
                              }
                              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium block mb-1.5">Description</label>
                            <textarea
                              value={form[formKey]?.description ?? ""}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, [formKey]: { ...p[formKey], description: e.target.value } }))
                              }
                              placeholder="Brief description..."
                              className="w-full border rounded-md px-3 py-2 min-h-[90px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium block mb-1.5">Evidence / Proof</label>
                            <textarea
                              value={form[formKey]?.evidence ?? ""}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, [formKey]: { ...p[formKey], evidence: e.target.value } }))
                              }
                              placeholder="Google Drive link, certificate number, screenshot filename..."
                              className="w-full border rounded-md px-3 py-2 min-h-[90px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>

                          <div className="flex justify-end">
                            <Button size="sm" onClick={() => submitCriterion(subId, key)}>
                              <Save className="mr-2 h-4 w-4" /> Save
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }

                  // Existing criterion
                  const claimedScore = existing.claimedScore;
                  const description = existing.description ?? "";
                  const evidence = existing.evidence ?? "";
                  const adminScore = existing.adminScore ?? null;
                  const adminDescription = existing.adminDescription ?? "";
                  const committeeScore = existing.committeeScore ?? null;
                  const committeeRemarks = existing.committeeRemarks ?? "";
                  const isVerified = existing.isVerified ?? false;
                  const finalScore = getFinalScore(existing);

                  if (editing) {
                    return (
                      <Card key={formKey} className="mb-3 border-2 border-primary/40 bg-muted/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Edit {subId}.{key} – {def.label}</CardTitle>
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
                            <Button size="sm" onClick={() => submitCriterion(subId, key)}>
                              <Save className="mr-2 h-4 w-4" /> Save
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }

                  // Display existing, non-editable
                  return (
                    <Card key={formKey} className="mb-3">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex justify-between items-center">
                          <span>{subId}.{key} – {def.label}</span>
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
                          <div className="pt-3 border-t">
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