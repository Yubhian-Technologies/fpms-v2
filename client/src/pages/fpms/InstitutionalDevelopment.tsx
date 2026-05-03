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

export default function InstitutionalDevelopment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subCriteria, setSubCriteria] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const defaultSubCriteria = [
    {
      id: "5.1",
      title: "Collaborative Projects/MoU with Industry",
      maxPoints: 12,
      description: "Inviting guest speakers from Industry/labs/research centres for partial delivery of courses, industry supported labs, industry offered short-term programs/training.",
      criteria: "Setting up industry sponsored labs: 12 points\nJoint programs with industry: 6 points\nFaculty-industry collaborative projects: 6 points\nFacilitating student internships: 3 points per student (max 6)",
      evidence: "MoU documents\nEquipment installation proof\nStudent usage records\nInternship monitoring reports",
      reference: "NBA 8.1–8.3; 9.1.1\nNAAC 6.5.3\nNIRF Outreach",
      subItems: [
        {
          name: "Industry Collaboration",
          maxScore: 12,
          claimedScore: 0,
          description: "",
          evidence: "",
          isVerified: false,
        },
      ],
    },
    {
      id: "5.2",
      title: "MoU/Partnership with Reputed Universities",
      maxPoints: 5,
      description: "Facilitator for implementation as a champion of the cause, of at least one objective of the MoU.",
      criteria: "International/National MoU/Partnership: 5 points\nFacilitator for implementation: 5 points",
      evidence: "MoU documents\nTangible outcomes proof\nImplementation reports",
      reference: "NBA 8.2; 9.1.1–9.1.2\nNAAC 6.1.1; 6.1.2\nNIRF Outreach",
      subItems: [
        {
          name: "University MoU/Partnership",
          maxScore: 5,
          claimedScore: 0,
          description: "",
          evidence: "",
          isVerified: false,
        },
      ],
    },
    {
      id: "5.3",
      title: "Special Labs/Centre of Excellence",
      maxPoints: 8,
      description: "Establishment of new Special Labs/CoE with functional effectiveness resulting in specific outcomes.",
      criteria: "For establishment - Coordinator: 8 points\nCo-Coordinator: 6 points\nExisting special labs/CoE - Coordinator: 6 points\nCo-Coordinator: 4 points",
      evidence: "Proposal documents\nCollaboration details\nEquipment specifications\nOutcome reports",
      reference: "NBA 7; 10.1.1\nNAAC 3.1.1\nNIRF Innovation",
      subItems: [
        {
          name: "Special Labs/CoE",
          maxScore: 8,
          claimedScore: 0,
          description: "",
          evidence: "",
          isVerified: false,
        },
      ],
    },
    {
      id: "5.4",
      title: "Software/Apps/Hardware Development & Alumni Activities",
      maxPoints: 8,
      description: "Development of Software/Apps/Hardware useful for the Institute. Involvement in Alumni Association activities.",
      criteria: "Development of Software/Apps/Hardware: 8 points\nActive Involvement in Alumni Association: 8 points",
      evidence: "Software/Apps/Hardware documentation\nDeployment proof\nAlumni meet records\nGuest lecture arrangements",
      reference: "NBA 9.2.1–9.2.3\nNAAC 3.6.1; 3.6.2",
      subItems: [
        {
          name: "Development & Alumni Activities",
          maxScore: 8,
          claimedScore: 0,
          description: "",
          evidence: "",
          isVerified: false,
        },
      ],
    },
    {
      id: "5.5",
      title: "Institutional/Department Level Responsibilities",
      maxPoints: 12,
      description: "One can claim either at the Institutional Level or Departmental Level.",
      criteria: "Hostel/Transport In-charge/SPOC-IIC/NIRF/NBA/NAAC/GSAC: 12 points\nInstitutional SPOC-NPTEL/NSS/Webmaster: 8 points\nDepartment Coordinators: 6 points",
      evidence: "Appointment orders\nResponsibility documentation\nActivity reports\nMeasurable outcomes",
      reference: "NBA 9.2.4\nNAAC 7.1.4; 7.1.6",
      subItems: [
        {
          name: "Institutional/Department Responsibilities",
          maxScore: 12,
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
      const res = await api.get(`/api/module5/faculty/${user.id}`);
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
        `/api/module5/faculty/${user.id}/subsection/${encodeURIComponent(subId)}`,
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
      title="Institutional Development"
      subtitle="Criterion 5 • Maximum 45 Points"
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
