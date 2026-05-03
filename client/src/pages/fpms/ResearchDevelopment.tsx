import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { api } from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SubItem {
  name: string;
  claimedScore: number;
  maxScore: number;
  description: string;
  evidence: string;
  isVerified?: boolean;
  committeeScore?: number;
  committeeRemarks?: string;
  // New guidance fields — fill these per item
  guidance?: string;
  itemDescription?: string;
  itemCriteria?: string;
  itemEvidence?: string;
  itemReference?: string;
}

interface SubCriteria {
  id: string;
  title: string;
  maxPoints: number;
  description?: string; // optional section-level short desc
  subItems: SubItem[];
}

export default function ResearchConsultancy() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subCriteria, setSubCriteria] = useState<SubCriteria[]>([]);

  const defaultSubCriteria: SubCriteria[] = [
  {
    id: "2.1",
    title: "Publications in Fundamental / Applied / Educational Research, Book Chapters & Textbooks",
    maxPoints: 20,
    description: "Quality-weighted research productivity in indexed journals and books.",
    subItems: [
      {
        name: "Research Publications, Book Chapters & Textbooks",
        maxScore: 20,
        claimedScore: 0,
        description: "",
        evidence: "",
        guidance: "Points awarded based on journal/book quality, authorship position, and institutional affiliation.",
        itemDescription:
          "Papers published in indexed journals (SCI/SCIE/Scopus), book chapters, and textbooks authored/edited during the assessment period.",
        itemCriteria:
          "Slab-based by Journal Quartile (Q1 highest → Q4) or Impact Factor (IF).\n" +
          "Weighted by author role: 1st/Corresponding = full points, 2nd/3rd = reduced.\n" +
          "Capped at 20 points total.",
        itemEvidence:
          "Published paper PDF / acceptance letter, DOI / ISBN link, journal homepage / Scopus/WoS screenshot showing quartile/IF, proof of authorship & institutional affiliation.",
        itemReference: "NAAC 3.1, 3.2 | NBA Research Output",
      },
    ],
  },
  {
    id: "2.2",
    title: "Citations & h-index Growth",
    maxPoints: 5,
    description: "Scholarly impact through citations and h-index improvement.",
    subItems: [
      {
        name: "Citations and h-index Growth",
        maxScore: 5,
        claimedScore: 0,
        description: "",
        evidence: "",
        guidance: "Focus on verifiable external impact excluding self-citations.",
        itemDescription:
          "Increase in citations and h-index during the assessment period (typically last 3–5 years).",
        itemCriteria:
          "0.2 points per valid citation (excluding self & co-author citations), max 3 points.\n" +
          "+2 points for measurable year-on-year (YoY) h-index growth.",
        itemEvidence:
          "Google Scholar / Scopus / Web of Science profile link, filtered citation report (date range, excluding self/co-authors), screenshot showing h-index trend.",
        itemReference: "NAAC 3.3",
      },
    ],
  },
  {
    id: "2.3",
    title: "Discovery & Innovation (Patents, Creative Works)",
    maxPoints: 10,
    description: "Patent filings and creative works with adoption proof.",
    subItems: [
      {
        name: "Patents and Creative Works",
        maxScore: 10,
        claimedScore: 0,
        description: "",
        evidence: "",
        guidance: "Emphasis on granted status and institutional involvement.",
        itemDescription:
          "Granted patents (Indian/USA/utility) and significant creative works with evidence of adoption/impact.",
        itemCriteria:
          "Up to 10 points for granted patents where Institute is applicant.\n" +
          "Role-based if only faculty affiliation: 5/3/1 points.\n" +
          "Creative works (with adoption proof): up to 5 points.",
        itemEvidence:
          "Patent grant certificate / number / official gazette, inventor list showing role & affiliation, adoption letter / usage proof for creative works.",
        itemReference: "NAAC 3.4 | NBA 3.3",
      },
    ],
  },
  {
    id: "2.4",
    title: "Sponsored Research Projects",
    maxPoints: 18,
    description: "Securing funded research projects.",
    subItems: [
      {
        name: "Sponsored Research Projects",
        maxScore: 18,
        claimedScore: 0,
        description: "",
        evidence: "",
        guidance: "Points scale with funding amount and leadership role.",
        itemDescription:
          "Externally sponsored research / development / innovation projects received during period.",
        itemCriteria:
          "Slab-based on project value (≥20 Lakhs highest → down to 1 Lakh).\n" +
          "PI = 4 points base per qualifying project, Co-PI = 2 points.\n" +
          "Additional points for higher slabs (total capped at 18).",
        itemEvidence:
          "Sanction / approval letter from funding agency, project ID/reference, funding amount, PI/Co-PI certificate, progress/utilization report if applicable.",
        itemReference: "NAAC 3.5 | NBA 3.4",
      },
    ],
  },
  {
    id: "2.5",
    title: "Seed Funding & Outcomes",
    maxPoints: 4,
    description: "Receipt and utilization of seed funding.",
    subItems: [
      {
        name: "Internal Seed Funding Projects",
        maxScore: 4,
        claimedScore: 0,
        description: "",
        evidence: "",
        guidance: "Focus on internal grants utilized for research initiation.",
        itemDescription:
          "Seed / minor research grants received from the institution.",
        itemCriteria:
          "Slab-based by amount received:\n" +
          "≥6 Lakhs = 4 pts\n" +
          "Lower slabs (e.g. 1–2 Lakhs = 1 pt)",
        itemEvidence:
          "Seed funding sanction / approval memo, amount received proof, utilization certificate / final outcome report.",
        itemReference: "NAAC 3.5",
      },
    ],
  },
  {
    id: "2.6",
    title: "Consultancy Projects & Corporate Training",
    maxPoints: 10,
    description: "Revenue generation through research or general consultancy and training.",
    subItems: [
      {
        name: "Consultancy and Corporate Training",
        maxScore: 10,
        claimedScore: 0,
        description: "",
        evidence: "",
        guidance: "Differentiates between research-oriented and general consultancy/training.",
        itemDescription:
          "Consultancy services provided to industry/government and corporate training programs conducted.",
        itemCriteria:
          "Revenue slab-based scoring.\n" +
          "Higher points for research consultancy vs general consultancy/training.",
        itemEvidence:
          "Client letter / MoU, payment receipts / bank statement excerpts, completion certificate, revenue share proof if applicable.",
        itemReference: "NAAC 3.6 | NBA 3.5",
      },
    ],
  },
  {
    id: "2.7",
    title: "PhD / Research Supervision",
    maxPoints: 4,
    description: "Guidance of research scholars and supervisor recognition.",
    subItems: [
      {
        name: "PhD Supervision & Guidance",
        maxScore: 4,
        claimedScore: 0,
        description: "",
        evidence: "",
        guidance: "Points for different stages of supervision.",
        itemDescription:
          "PhD scholars guided (awarded, submitted, ongoing/registered).",
        itemCriteria:
          "Awarded / Submitted = 4 pts\n" +
          "Ongoing / Registered / Pursuing = 2 pts\n" +
          "Supervisor recognition / additional role = 1 pt\n" +
          "Capped at 4 points total.",
        itemEvidence:
          "Award / submission certificate, registration / RAC minutes, university status report, thesis link (if public).",
        itemReference: "NAAC 3.1",
      },
    ],
  },
  {
    id: "2.8",
    title: "Research-related Academic Services",
    maxPoints: 4,
    description: "Service to the research community (organising, editing, reviewing).",
    subItems: [
      {
        name: "Research Services & Contributions",
        maxScore: 4,
        claimedScore: 0,
        description: "",
        evidence: "",
        guidance: "Recognition for voluntary service to academia and research ecosystem.",
        itemDescription:
          "Roles such as journal reviewer/editor, conference organizer/chair, TPC member, etc.",
        itemCriteria:
          "Activity-based scoring:\n" +
          "SCI journal editor/reviewer = higher points\n" +
          "Conference chair / organizer / reviewer = 0.5–1 pt each\n" +
          "Capped at 4 points.",
        itemEvidence:
          "Appointment letter / invitation, reviewer/editor certificate, proceeding / journal link showing role.",
        itemReference: "NAAC 3.7",
      },
    ],
  },
];

  const fetchData = async () => {
    if (!user?.id) {
      setSubCriteria(defaultSubCriteria);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get(`/api/module3/faculty/${user.id}`);
      const backendData = res.data?.data || [];

      const merged = defaultSubCriteria.map((sc) => {
        const existing = backendData.find((b: any) => b.id === sc.id);

        return {
          ...sc,
          subItems: sc.subItems.map((si) => {
            const item = existing?.criteria?.find(
              (c: any) => c.name === si.name,
            );

            return item
              ? {
                  ...si,
                  claimedScore: item.claimedScore ?? 0,
                  description: item.facultyDescription ?? "",
                  evidence: item.evidence ?? "",
                  isVerified: item.isVerified ?? false,
                  committeeScore: item.committeeScore ?? undefined,
                  committeeRemarks: item.committeeRemarks ?? "",
                }
              : si;
          }),
        };
      });

      setSubCriteria(merged);
    } catch (err) {
      console.error("Research data fetch error:", err);
      toast({
        title: "Error",
        description: "Failed to load research data",
        variant: "destructive",
      });
      setSubCriteria(defaultSubCriteria);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const updateSubItem = (
    subId: string,
    index: number,
    field: keyof SubItem,
    value: string | number,
  ) => {
    setSubCriteria((prev) =>
      prev.map((sc) =>
        sc.id !== subId
          ? sc
          : {
              ...sc,
              subItems: sc.subItems.map((si, i) =>
                i === index && !si.isVerified ? { ...si, [field]: value } : si,
              ),
            },
      ),
    );
  };

  const saveSingleCriterion = async (subId: string, criterion: SubItem) => {
    if (!user) return;
    try {
      await api.post(`/api/module3/faculty/${user.id}/subsection/${encodeURIComponent(subId)}`, {
        criteria: [
          {
            name: criterion.name,
            claimedScore: criterion.claimedScore,
            maxScore: criterion.maxScore,
            description: criterion.description,
            evidence: criterion.evidence,
          },
        ],
      });
      toast({ title: "Saved", description: `${criterion.name} saved` });
      fetchData();
    } catch {
      toast({
        title: "Error",
        description: "Save failed",
        variant: "destructive",
      });
    }
  };

  const saveSubsection = async (sub: SubCriteria) => {
    if (!user) return;
    try {
      await api.post(`/api/module3/faculty/${user.id}/subsection/${encodeURIComponent(sub.id)}`, {
        criteria: sub.subItems.map((si) => ({
          name: si.name,
          claimedScore: si.claimedScore,
          maxScore: si.maxScore,
          description: si.description,
          evidence: si.evidence,
        })),
      });
      toast({ title: "Saved", description: `Section ${sub.id} saved` });
      fetchData();
    } catch {
      toast({
        title: "Error",
        description: "Save failed",
        variant: "destructive",
      });
    }
  };

  if (loading) return <p className="text-center py-10">Loading...</p>;

  const totalMax = subCriteria.reduce((sum, sc) => sum + sc.maxPoints, 0);
  const totalSubmitted = subCriteria.reduce(
    (sum, sc) =>
      sum +
      sc.subItems.reduce((s, si) => s + (!si.isVerified ? si.claimedScore : 0), 0),
    0,
  );
  const totalVerified = subCriteria.reduce(
    (sum, sc) =>
      sum +
      sc.subItems.reduce(
        (s, si) => s + (si.isVerified ? (si.committeeScore ?? si.claimedScore ?? 0) : 0),
        0,
      ),
    0,
  );

  return (
    <DashboardLayout
      title="Research & Consultancy"
      subtitle="Criterion 3 • Maximum 75 Points"
    >
      <div className="space-y-6">
        {/* Progress Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overall Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative group w-full h-4 rounded-full flex overflow-hidden">
              <div
                className="bg-green-600 h-4 transition-all"
                style={{ width: `${(totalVerified / totalMax) * 100}%` }}
              />
              <div
                className="bg-blue-500 h-4 transition-all"
                style={{ width: `${(totalSubmitted / totalMax) * 100}%` }}
              />
              <div className="bg-gray-200 h-4 flex-1" />
              <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium mix-blend-difference pointer-events-none">
                {Math.round(((totalSubmitted + totalVerified) / totalMax) * 100)}%
              </div>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {totalSubmitted + totalVerified} / {totalMax} Points
              </span>
              <span>
                Verified: {totalVerified} • Submitted: {totalSubmitted}
              </span>
            </div>
          </CardContent>
        </Card>

        <Accordion type="single" collapsible className="space-y-4">
          {subCriteria.map((sc) => (
            <AccordionItem key={sc.id} value={sc.id} className="border rounded-lg">
              <AccordionTrigger className="px-5 py-4">
                <div className="flex w-full justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="px-3 py-1">
                      {sc.id}
                    </Badge>
                    <span className="font-semibold text-lg">{sc.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      Max: {sc.maxPoints}
                    </span>
                    {sc.subItems.every((si) => si.isVerified) ? (
                      <Badge className="bg-blue-800 text-white">Verified</Badge>
                    ) : sc.subItems.some((si) => si.claimedScore > 0) ? (
                      <Badge variant="secondary">In Progress</Badge>
                    ) : (
                      <Badge variant="destructive">Not Started</Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-5 pb-6 pt-4 space-y-6">
                {sc.subItems.map((si, i) => (
                  <Card key={i} className="border">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{si.name}</CardTitle>
                          {si.guidance && (
                            <p className="text-sm text-muted-foreground italic">
                              {si.guidance}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {si.isVerified && (
                            <Badge className="bg-blue-800">Verified</Badge>
                          )}
                          {!si.isVerified && si.claimedScore > 0 && (
                            <Badge variant="secondary">Submitted</Badge>
                          )}
                          {si.claimedScore === 0 && !si.isVerified && (
                            <Badge variant="outline">Pending</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Max: {si.maxScore}
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-5">
                      {/* Guidance Blocks */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {si.itemDescription && (
                          <div className="bg-blue-50 p-3 rounded border border-blue-200">
                            <h5 className="font-medium text-blue-900 text-sm mb-1">
                              Description
                            </h5>
                            <p className="text-sm text-gray-700">{si.itemDescription}</p>
                          </div>
                        )}
                        {si.itemCriteria && (
                          <div className="bg-green-50 p-3 rounded border border-green-200">
                            <h5 className="font-medium text-green-900 text-sm mb-1">
                              Assessment Criteria
                            </h5>
                            <p className="text-sm text-gray-700 whitespace-pre-line">
                              {si.itemCriteria}
                            </p>
                          </div>
                        )}
                        {si.itemEvidence && (
                          <div className="bg-amber-50 p-3 rounded border border-amber-200">
                            <h5 className="font-medium text-amber-900 text-sm mb-1">
                              Required Evidence
                            </h5>
                            <p className="text-sm text-gray-700 whitespace-pre-line">
                              {si.itemEvidence}
                            </p>
                          </div>
                        )}
                        {si.itemReference && (
                          <div className="bg-purple-50 p-3 rounded border border-purple-200">
                            <h5 className="font-medium text-purple-900 text-sm mb-1">
                              Reference
                            </h5>
                            <p className="text-sm text-gray-700">{si.itemReference}</p>
                          </div>
                        )}
                      </div>

                      {/* Form Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="text-sm font-medium block mb-1.5">
                            Claimed Score
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={si.maxScore}
                            className="w-full border rounded p-2"
                            value={si.claimedScore}
                            disabled={si.isVerified}
                            onChange={(e) =>
                              updateSubItem(sc.id, i, "claimedScore", Number(e.target.value))
                            }
                          />
                        </div>

                        {si.isVerified && si.committeeScore !== undefined && (
                          <div>
                            <label className="text-sm font-medium block mb-1.5 text-purple-700">
                              Committee Score (Final)
                            </label>
                            <input
                              type="number"
                              className="w-full border rounded p-2 bg-purple-50 font-medium"
                              value={si.committeeScore}
                              disabled
                            />
                          </div>
                        )}

                        <div className="md:col-span-2">
                          <label className="text-sm font-medium block mb-1.5">
                            Evidence URL / DOI / Link
                          </label>
                          <input
                            type="text"
                            className="w-full border rounded p-2"
                            value={si.evidence}
                            disabled={si.isVerified}
                            onChange={(e) =>
                              updateSubItem(sc.id, i, "evidence", e.target.value)
                            }
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-sm font-medium block mb-1.5">
                            Faculty Description / Justification
                          </label>
                          <textarea
                            className="w-full border rounded p-2 min-h-[120px]"
                            value={si.description}
                            disabled={si.isVerified}
                            onChange={(e) =>
                              updateSubItem(sc.id, i, "description", e.target.value)
                            }
                            placeholder="List publications with DOI/year/quartile, explain calculation, exclude ineligible items..."
                          />
                        </div>

                        {si.isVerified && si.committeeRemarks && (
                          <div className="md:col-span-2">
                            <label className="text-sm font-medium text-purple-700 block mb-1.5">
                              Committee Remarks
                            </label>
                            <textarea
                              className="w-full border rounded p-2 min-h-[80px] bg-purple-50"
                              value={si.committeeRemarks}
                              disabled
                            />
                          </div>
                        )}

                        {!si.isVerified && (
                          <div className="md:col-span-2 pt-2">
                            <Button
                              onClick={() => saveSingleCriterion(sc.id, si)}
                              className="w-full md:w-auto"
                            >
                              Save This Item
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <div className="flex justify-end pt-4">
                  <Button onClick={() => saveSubsection(sc)}>
                    Save Entire Section
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </DashboardLayout>
  );
}