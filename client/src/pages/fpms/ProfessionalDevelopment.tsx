import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/api/api";

export default function ProfessionalDevelopment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subCriteria, setSubCriteria] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const defaultSubCriteria = [
    {
      id: "3.1",
      title: "Attending Refresher courses/FDP/Training Programs",
      maxPoints: 10,
      description: "Attending Refresher courses, Methodology workshops, Training, Teaching-Learning-Evaluation, Technology Programs, Soft Skills Development Programs, Faculty Development Programs with minimum 30 hours structured sessions.",
      criteria: "Refresher courses (4 weeks): 10 points\nRefresher courses (3 weeks): 9 points\nRefresher courses (2 weeks): 7 points\nRefresher courses (1 week): 5 points\nFDP/Training (5+ days): 5 points each",
      evidence: "Participation Certificate\nReflection Report\nFollow-up activities implementation",
      reference: "NBA 6.1.2; 6.1.4\nNAAC 6.3.3",
      subItems: [
        {
          name: "FDP Participation",
          maxScore: 10,
          claimedScore: 0,
          description: "",
          evidence: "",
          isVerified: false,
        },
      ],
    },
    {
      id: "3.2",
      title: "Organizing Refresher courses/FDP/Training Programs",
      maxPoints: 10,
      description: "Organizing Refresher courses, Methodology workshops, Training, Teaching-Learning-Evaluation, Technology Programs, Soft Skills Development Programs, Faculty Development Programs.",
      criteria: "Refresher courses (2/3/4 weeks) - Coordinator/Convener: 10 points\nFDP/Training (1 week) - Coordinator/Convener: 7 points\nOrganizing Committee Member: 2 points",
      evidence: "Activity report\nExpenditure details\nMax 6 organizing committee members per event",
      reference: "NBA 6.1.5; 6.2.1\nNAAC 6.3.3",
      subItems: [
        {
          name: "FDP Organization",
          maxScore: 10,
          claimedScore: 0,
          description: "",
          evidence: "",
          isVerified: false,
        },
      ],
    },
    {
      id: "3.3",
      title: "NPTEL Certifications",
      maxPoints: 12,
      description: "Skilling/Re-Skilling/Up-Skilling through Proctored Exam certifications such as NPTEL.",
      criteria: "NPTEL 12-wk Elite Gold (Innovation/Entrepreneurship/Research): 10+2 points\nNPTEL 12-wk Elite Gold (Domain): 8+2 points\nNPTEL 12-wk Elite Silver (Domain): 6+2 points\nNPTEL 8-wk Elite Gold (Domain): 6+2 points",
      evidence: "Participation certificate\nReflection Report\nImplementation plan",
      reference: "NBA 6.1.4; 6.2.1; 2.6\nNAAC 6.3.4\nNIRF TLR",
      subItems: [
        {
          name: "Certification",
          maxScore: 12,
          claimedScore: 0,
          description: "",
          evidence: "",
          isVerified: false,
        },
      ],
    },
    {
      id: "3.4",
      title: "Industry Certifications/VEDIC/IGIP",
      maxPoints: 10,
      description: "Industry Certifications like WIPRO/CISCO with proctored exam. Attending VEDIC FDPs (FIP, IDEATE, FA + TLC Presentation).",
      criteria: "Industry Certifications (2+ weeks, domain relevant): 8 points\nFIP/IDEATE & Formative Assessment: 6 points\nTLC Presentation: 4 points\nIGIP Educational Certification: 6 points",
      evidence: "Certificates with proctored exam proof\nVEDIC certificates signed by Dr Siva Kumar Krishnan\nAssignment completion proof",
      reference: "NBA 6.1.4; 6.2.1; 2.6\nNAAC 6.3.4\nNIRF TLR",
      subItems: [
        {
          name: "Professional Certification",
          maxScore: 10,
          claimedScore: 0,
          description: "",
          evidence: "",
          isVerified: false,
        },
      ],
    },
    {
      id: "3.5",
      title: "Professional Society Activities",
      maxPoints: 10,
      description: "Professional activities conducted in conjunction with membership in a professional society. Active contribution must be demonstrated.",
      criteria: "Activities with external participation: 5 points\nIEEE/ASME/ASCE/ACM/ASEE (International): 5 points max\nCSI/ISTE/IETE/IEI (National): 3 points max",
      evidence: "Advance communication to society\nExternal student/faculty participation proof\nMembership certificates",
      reference: "NBA 6.1.1; 6.1.5; 4.7.1\nNAAC 6.3.2",
      subItems: [
        {
          name: "Society Activity",
          maxScore: 10,
          claimedScore: 0,
          description: "",
          evidence: "",
          isVerified: false,
        },
      ],
    },
    {
      id: "3.6",
      title: "Academic Outreach (Outside Institute)",
      maxPoints: 4,
      description: "Involvement in Academic Outreach outside the Institute.",
      criteria: "External Keynote/Resource Person/Guest Lectures: 2 points\nExternal BOS/Academic Council/Governing Body: 4 points",
      evidence: "Invitation letters\nDocumented contributions\nCurriculum revision/policy documents",
      reference: "NBA 6.1.5; 6.2.1\nNAAC 3.7.1",
      subItems: [
        {
          name: "Outreach Activity",
          maxScore: 4,
          claimedScore: 0,
          description: "",
          evidence: "",
          isVerified: false,
        },
      ],
    },
    {
      id: "3.7",
      title: "Extension Activities (Social Outreach)",
      maxPoints: 4,
      description: "Community service, Unnat Bharat Abhiyan, social internship, SDG/ESG activities, community development with at least 30 students participation.",
      criteria: "Coordinator/Convener (1 day activity): 3 points\nCommittee member (1 day activity): 1 point\nMax 6 organizing committee members per event",
      evidence: "Activity reports\nStudent participation records (min 30)\nPhotographs and documentation",
      reference: "NBA 6.2.5\nNAAC 3.5.1",
      subItems: [
        {
          name: "Social Outreach",
          maxScore: 4,
          claimedScore: 0,
          description: "",
          evidence: "",
          isVerified: false,
        },
      ],
    },
    {
      id: "3.8",
      title: "Awards, Recognitions and Fellowships",
      maxPoints: 5,
      description: "Awards, Recognitions and Fellowships for advanced studies/research received from Central/State Agencies or professional societies.",
      criteria: "Awards by Central/State Agencies/Institutions: 5 points\nProfessional societies awards: 5 points\nNPTEL Domain Scholar/Super star/Mega star: 5 points",
      evidence: "Award certificates\nOfficial notifications\nRecognition letters",
      reference: "NBA 6.1.5; 6.2.3\nNAAC 6.4.1\nNIRF Perception",
      subItems: [
        {
          name: "Award",
          maxScore: 5,
          claimedScore: 0,
          description: "",
          evidence: "",
          isVerified: false,
        },
      ],
    },
  ];

  const fetchSubmissions = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/module4/faculty/${user.id}`);
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
                  claimedScore: item.claimedScore ?? si.claimedScore,
                  evidence: item.evidence ?? "",
                  description: item.facultyDescription ?? si.description,
                  isVerified: item.isVerified ?? false,
                  committeeScore: item.committeeScore,
                }
              : si;
          }),
        };
      });

      setSubCriteria(merged);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setSubCriteria(defaultSubCriteria);
      } else {
        toast({
          title: "Error",
          description: "Failed to load data",
          variant: "destructive",
        });
        setSubCriteria(defaultSubCriteria);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchSubmissions();
    } else {
      setSubCriteria(defaultSubCriteria);
      setLoading(false);
    }
  }, [user]);

  const updateSubItem = (
    subId: string,
    index: number,
    field: string,
    value: any,
  ) => {
    setSubCriteria((prev) =>
      prev.map((sc) =>
        sc.id !== subId
          ? sc
          : {
              ...sc,
              subItems: sc.subItems.map((si, i) =>
                i === index ? { ...si, [field]: value } : si,
              ),
            },
      ),
    );
  };

  const getSubScore = (sub: any) => sub.subItems.reduce((t: number, si: any) => t + (si.claimedScore || 0), 0);

  const getSubStatus = (sub: any) => {
    if (sub.subItems.every((si: any) => si.isVerified)) return "completed";
    if (sub.subItems.some((si: any) => si.claimedScore > 0)) return "in-progress";
    return "not-started";
  };

  const saveSingleCriterion = async (subId: string, criterion: any) => {
    if (!user) return;
    try {
      await api.post(
        `/api/module4/faculty/${user.id}/subsection/${encodeURIComponent(subId)}`,
        {
          criteria: [
            {
              name: criterion.name,
              claimedScore: criterion.claimedScore,
              maxScore: criterion.maxScore,
              description: criterion.description,
              evidence: criterion.evidence,
            },
          ],
        },
      );
      toast({ title: "Saved", description: "Criterion saved successfully" });
      fetchSubmissions();
    } catch (err) {
      toast({
        title: "Save failed",
        description: "Check backend",
        variant: "destructive",
      });
    }
  };

  if (loading) return <p>Loading...</p>;

  const totalMax = subCriteria.reduce((s, sc) => s + sc.maxPoints, 0);
  const totalClaimed = subCriteria.reduce((s, sc) => s + sc.subItems.reduce((x: number, si: any) => x + (si.claimedScore || 0), 0), 0);

  return (
    <DashboardLayout
      title="Professional Development"
      subtitle="Criterion 3 • Maximum 65 Points"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overall Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative group w-full h-4 rounded-full flex overflow-hidden">
              <div
                className="bg-green-600 h-4 transition-all"
                style={{ width: `${(totalClaimed / totalMax) * 100}%` }}
              />
              <div className="bg-gray-200 h-4 flex-1" />
              <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium mix-blend-difference pointer-events-none">
                {Math.round((totalClaimed / totalMax) * 100)}%
              </div>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {totalClaimed} / {totalMax} Points
              </span>
            </div>
          </CardContent>
        </Card>

        <Accordion type="multiple" className="space-y-6">
          {subCriteria.map((sub) => (
            <AccordionItem key={sub.id} value={sub.id} className="border-none">
              <Card className="shadow-lg">
                <AccordionTrigger className="hover:no-underline">
                  <div className="border-b w-full px-6 py-4">
                    <div className="flex justify-between items-center w-full text-left">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold">{sub.id} - {sub.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">Max: {sub.maxPoints}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-blue-600">{getSubScore(sub)} / {sub.maxPoints}</span>
                        <Badge variant={getSubStatus(sub) === "completed" ? "default" : getSubStatus(sub) === "in-progress" ? "secondary" : "destructive"}>
                          {getSubStatus(sub) === "completed" ? "Verified" : getSubStatus(sub) === "in-progress" ? "In Progress" : "Not Started"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <CardContent className="px-5 pb-6 pt-4 space-y-6">
                    {sub.subItems.map((si: any, i: number) => (
                      <Card key={i} className="border">
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">{si.name}</CardTitle>
                            <div className="flex flex-col items-end gap-1">
                              <Badge className={si.isVerified ? "bg-blue-800" : si.claimedScore > 0 ? "" : ""} variant={si.isVerified ? "default" : si.claimedScore > 0 ? "secondary" : "outline"}>
                                {si.isVerified ? "Verified" : si.claimedScore > 0 ? "Submitted" : "Pending"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">Max: {si.maxScore}</span>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-blue-50 p-3 rounded border border-blue-200 h-full">
                              <h5 className="font-medium text-blue-900 text-sm mb-2">Description</h5>
                              <p className="text-sm text-gray-700">{sub.description}</p>
                            </div>
                            <div className="bg-green-50 p-3 rounded border border-green-200 h-full">
                              <h5 className="font-medium text-green-900 text-sm mb-2">Assessment Criteria</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-line">{sub.criteria}</p>
                            </div>
                            <div className="bg-amber-50 p-3 rounded border border-amber-200 h-full">
                              <h5 className="font-medium text-amber-900 text-sm mb-2">Required Evidence</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-line">{sub.evidence}</p>
                            </div>
                            <div className="bg-purple-50 p-3 rounded border border-purple-200 h-full">
                              <h5 className="font-medium text-purple-900 text-sm mb-2">Reference</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-line">{sub.reference}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <label className="text-sm font-medium block mb-1.5">Claimed Score</label>
                              <input type="number" min={0} max={si.maxScore} className="w-full border rounded p-2" value={si.claimedScore} disabled={si.isVerified} onChange={(e) => updateSubItem(sub.id, i, "claimedScore", Number(e.target.value))} />
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-sm font-medium block mb-1.5">Evidence URL</label>
                              <input type="text" className="w-full border rounded p-2" value={si.evidence} disabled={si.isVerified} onChange={(e) => updateSubItem(sub.id, i, "evidence", e.target.value)} />
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-sm font-medium block mb-1.5">Faculty Description</label>
                              <textarea className="w-full border rounded p-2 min-h-[100px]" value={si.description} disabled={si.isVerified} onChange={(e) => updateSubItem(sub.id, i, "description", e.target.value)} placeholder="Explain how this criterion is satisfied..." />
                            </div>
                            {!si.isVerified && (
                              <div className="md:col-span-2 pt-2">
                                <Button onClick={() => saveSingleCriterion(sub.id, si)} className="w-full md:w-auto">Save This Item</Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </DashboardLayout>
  );
}
