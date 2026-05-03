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

interface SubSubCriteria {
  name: string;
  claimedScore: number;
  maxScore: number;
  evidence: string;
  description: string;
  hodScore?: number;
  hodDescription?: string;
  isVerified?: boolean;
  committeeScore?: number;
  committeeRemarks?: string;
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
  subItems: SubSubCriteria[];
  status: "not-started" | "in-progress" | "completed";
}

interface Appeal {
  id: string;
  subId: string;
  criterionName: string;
  committeeScore?: number;
  committeeRemarks?: string;
  status: string;
}

export default function TeachingLearning() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subCriteria, setSubCriteria] = useState<SubCriteria[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);

  const defaultSubCriteria: SubCriteria[] = [
    {
      id: "1.1",
      title: "Curriculum Development",
      maxPoints: 8,
      subItems: [
        {
          name: "Course/Lab Design",
          claimedScore: 0,
          maxScore: 3,
          evidence: "",
          description: "",
          guidance:
            "Introduction of a new theory/practical course or significant revision of existing course/lab.",
          itemDescription:
            "Faculty has introduced a new course or lab or carried out major revision in existing course/lab syllabus.",
          itemCriteria:
            "New course introduced or significant revision done with proper documentation and approval.",
          itemEvidence:
            "New/updated syllabus copy, BoS / academic council minutes, lab manual, equipment proposal, revision justification letter.",
          itemReference: "NBA 1.1, 1.2 | NAAC 1.1.1",
        },
        {
          name: "Digital Content Creation",
          claimedScore: 0,
          maxScore: 3,
          evidence: "",
          description: "",
          guidance: "Creation of high-quality digital learning material.",
          itemDescription:
            "Development of original video lectures, e-modules, animated content, simulations, or NPTEL-style material.",
          itemCriteria:
            "Quality, relevance, duration and accessibility of created digital content.",
          itemEvidence:
            "Public/shareable links (YouTube, Drive, LMS), number of modules created, total duration, student usage proof if available.",
          itemReference: "NBA 1.3 | NAAC 1.2.1",
        },
        {
          name: "CO–PO–PSO Mapping",
          claimedScore: 0,
          maxScore: 2,
          evidence: "",
          description: "",
          guidance: "Proper mapping of course outcomes to program outcomes.",
          itemDescription:
            "Course outcomes mapped to program outcomes and program specific outcomes with justification.",
          itemCriteria:
            "Correctness, completeness and approval of the mapping.",
          itemEvidence:
            "Approved CO-PO-PSO mapping table, articulation matrix, BoS approved document.",
          itemReference: "NBA 1.2, 1.3",
        },
      ],
      status: "not-started",
    },

    {
      id: "1.2",
      title: "Teaching Load & Active Learning",
      maxPoints: 15,
      subItems: [
        {
          name: "Active Learning Strategies",
          claimedScore: 0,
          maxScore: 2,
          evidence: "",
          description: "",
          guidance: "Use of interactive and student-centric teaching methods.",
          itemDescription:
            "Implementation of active learning techniques in classroom teaching.",
          itemCriteria:
            "Variety, frequency and effectiveness of active learning methods used.",
          itemEvidence:
            "Lesson plan showing active learning method, photos/activity proof, student participation list, short report.",
          itemReference: "NBA 2.2 | NAAC 2.3.1",
        },
        {
          name: "Discovery-based Lab Experiments",
          claimedScore: 0,
          maxScore: 2,
          evidence: "",
          description: "",
          guidance: "Open-ended experiments where students design/verify.",
          itemDescription:
            "Use of discovery-based / open-ended lab experiments in practical sessions.",
          itemCriteria:
            "Experiments that encourage exploration and critical thinking rather than rote following.",
          itemEvidence:
            "List of such experiments, relevant section of lab manual, sample student reports or lab records.",
          itemReference: "NAAC 2.3.2",
        },
        // ... add itemDescription, itemCriteria, itemEvidence, itemReference for remaining sub-items
      ],
      status: "not-started",
    },
    {
      id: "1.3",
      title: "OBE Adaptation & Implementation",
      maxPoints: 6,
      subItems: [
        {
          name: "TLA Report with outcome attainment",
          claimedScore: 0,
          maxScore: 2,
          evidence: "",
          description: "",
          guidance:
            "Introduction of a new theory/practical course or significant revision of existing course/lab.",
          itemDescription:
            "Faculty has introduced a new course or lab or carried out major revision in existing course/lab syllabus.",
          itemCriteria: "Systematic implementation of OBE in handled courses",
          itemEvidence:
            "TLA reports, assessment rubrics, and CO attainment calculation",
          itemReference: "NBA 1.1, 1.2 | NAAC 1.1.1",
        },
        {
          name: "Rubric-based Assessment",
          claimedScore: 0,
          maxScore: 2,
          evidence: "",
          description: "",
          guidance: "Creation of high-quality digital learning material.",
          itemDescription:
            "Development of original video lectures, e-modules, animated content, simulations, or NPTEL-style material.",
          itemCriteria:
            "Quality, relevance, duration and accessibility of created digital content.",
          itemEvidence:
            "Public/shareable links (YouTube, Drive, LMS), number of modules created, total duration, student usage proof if available.",
          itemReference: "NBA 1.3 | NAAC 1.2.1",
        },
        {
          name: "CO Attainment Calculation",
          claimedScore: 0,
          maxScore: 2,
          evidence: "",
          description: "",
          guidance: "Proper mapping of course outcomes to program outcomes.",
          itemDescription:
            "Course outcomes mapped to program outcomes and program specific outcomes with justification.",
          itemCriteria:
            "Correctness, completeness and approval of the mapping.",
          itemEvidence:
            "Approved CO-PO-PSO mapping table, articulation matrix, BoS approved document.",
          itemReference: "NBA 1.2, 1.3",
        },
      ],
      status: "not-started",
    },
    {
      id: "1.4",
      title: "Innovative Pedagogy & Assessment",
      maxPoints: 10,
      subItems: [
        {
          name: "LMS and Analytics Usage",
          claimedScore: 0,
          maxScore: 2,
          evidence: "",
          description: "",
          guidance:
            "Introduction of a new theory/practical course or significant revision of existing course/lab.",
          itemDescription:
            "Faculty has introduced a new course or lab or carried out major revision in existing course/lab syllabus.",
          itemCriteria:
            "New course introduced or significant revision done with proper documentation and approval.",
          itemEvidence:
            "New/updated syllabus copy, BoS / academic council minutes, lab manual, equipment proposal, revision justification letter.",
          itemReference: "NBA 1.1, 1.2 | NAAC 1.1.1",
        },
        {
          name: "Flipped Classroom",
          claimedScore: 0,
          maxScore: 2,
          evidence: "",
          description: "",
          guidance: "Creation of high-quality digital learning material.",
          itemDescription:
            "Development of original video lectures, e-modules, animated content, simulations, or NPTEL-style material.",
          itemCriteria:
            "Quality, relevance, duration and accessibility of created digital content.",
          itemEvidence:
            "Public/shareable links (YouTube, Drive, LMS), number of modules created, total duration, student usage proof if available.",
          itemReference: "NBA 1.3 | NAAC 1.2.1",
        },
        {
          name: "Experiential Learning / Industry Cases",
          claimedScore: 0,
          maxScore: 2,
          evidence: "",
          description: "",
          guidance: "Proper mapping of course outcomes to program outcomes.",
          itemDescription:
            "Course outcomes mapped to program outcomes and program specific outcomes with justification.",
          itemCriteria:
            "Correctness, completeness and approval of the mapping.",
          itemEvidence:
            "Approved CO-PO-PSO mapping table, articulation matrix, BoS approved document.",
          itemReference: "NBA 1.2, 1.3",
        },
        {
          name: "SWAYAM / NPTEL Facilitation",
          claimedScore: 0,
          maxScore: 2,
          evidence: "",
          description: "",
          guidance: "Proper mapping of course outcomes to program outcomes.",
          itemDescription:
            "Course outcomes mapped to program outcomes and program specific outcomes with justification.",
          itemCriteria:
            "Correctness, completeness and approval of the mapping.",
          itemEvidence:
            "Approved CO-PO-PSO mapping table, articulation matrix, BoS approved document.",
          itemReference: "NBA 1.2, 1.3",
        },
        {
          name: "Mini / Micro Projects with PO–PSO Alignment",
          claimedScore: 0,
          maxScore: 2,
          evidence: "",
          description: "",
          guidance: "Proper mapping of course outcomes to program outcomes.",
          itemDescription:
            "Course outcomes mapped to program outcomes and program specific outcomes with justification.",
          itemCriteria:
            "Correctness, completeness and approval of the mapping.",
          itemEvidence:
            "Approved CO-PO-PSO mapping table, articulation matrix, BoS approved document.",
          itemReference: "NBA 1.2, 1.3",
        },
      ],
      status: "not-started",
    },
    {
      id: "1.5",
      title: "Technology-Enhanced Learning",
      maxPoints: 5,
      subItems: [
        {
          name: "Digital/Video Content Portfolio",
          claimedScore: 0,
          maxScore: 3,
          evidence: "",
          description: "",
          guidance:
            "Introduction of a new theory/practical course or significant revision of existing course/lab.",
          itemDescription:
            "Faculty has introduced a new course or lab or carried out major revision in existing course/lab syllabus.",
          itemCriteria:
            "New course introduced or significant revision done with proper documentation and approval.",
          itemEvidence:
            "New/updated syllabus copy, BoS / academic council minutes, lab manual, equipment proposal, revision justification letter.",
          itemReference: "NBA 1.1, 1.2 | NAAC 1.1.1",
        },
        {
          name: "Implementation Report (LMS/Classroom Usage)",
          claimedScore: 0,
          maxScore: 2,
          evidence: "",
          description: "",
          guidance: "Creation of high-quality digital learning material.",
          itemDescription:
            "Development of original video lectures, e-modules, animated content, simulations, or NPTEL-style material.",
          itemCriteria:
            "Quality, relevance, duration and accessibility of created digital content.",
          itemEvidence:
            "Public/shareable links (YouTube, Drive, LMS), number of modules created, total duration, student usage proof if available.",
          itemReference: "NBA 1.3 | NAAC 1.2.1",
        },
      ],
      status: "not-started",
    },
    {
      id: "1.6",
      title: "Student Feedback",
      maxPoints: 8,
      subItems: [
        {
          name: "Excellent Feedback ≥85%",
          claimedScore: 0,
          maxScore: 4,
          evidence: "",
          description: "",
          guidance:
            "Introduction of a new theory/practical course or significant revision of existing course/lab.",
          itemDescription:
            "Faculty has introduced a new course or lab or carried out major revision in existing course/lab syllabus.",
          itemCriteria:
            "New course introduced or significant revision done with proper documentation and approval.",
          itemEvidence:
            "New/updated syllabus copy, BoS / academic council minutes, lab manual, equipment proposal, revision justification letter.",
          itemReference: "NBA 1.1, 1.2 | NAAC 1.1.1",
        },
        {
          name: "Good Feedback 75–84.9%",
          claimedScore: 0,
          maxScore: 4,
          evidence: "",
          description: "",
          guidance: "Creation of high-quality digital learning material.",
          itemDescription:
            "Development of original video lectures, e-modules, animated content, simulations, or NPTEL-style material.",
          itemCriteria:
            "Quality, relevance, duration and accessibility of created digital content.",
          itemEvidence:
            "Public/shareable links (YouTube, Drive, LMS), number of modules created, total duration, student usage proof if available.",
          itemReference: "NBA 1.3 | NAAC 1.2.1",
        },
      ],
      status: "not-started",
    },
    {
      id: "1.7",
      title: "Academic Results",
      maxPoints: 10,
      subItems: [
        {
          name: "≥60% Students scoring >60%",
          claimedScore: 0,
          maxScore: 5,
          evidence: "",
          description: "",
          guidance:
            "Introduction of a new theory/practical course or significant revision of existing course/lab.",
          itemDescription:
            "Faculty has introduced a new course or lab or carried out major revision in existing course/lab syllabus.",
          itemCriteria:
            "New course introduced or significant revision done with proper documentation and approval.",
          itemEvidence:
            "New/updated syllabus copy, BoS / academic council minutes, lab manual, equipment proposal, revision justification letter.",
          itemReference: "NBA 1.1, 1.2 | NAAC 1.1.1",
        },
        {
          name: "50–59.9% Students scoring >60%",
          claimedScore: 0,
          maxScore: 5,
          evidence: "",
          description: "",
          guidance: "Creation of high-quality digital learning material.",
          itemDescription:
            "Development of original video lectures, e-modules, animated content, simulations, or NPTEL-style material.",
          itemCriteria:
            "Quality, relevance, duration and accessibility of created digital content.",
          itemEvidence:
            "Public/shareable links (YouTube, Drive, LMS), number of modules created, total duration, student usage proof if available.",
          itemReference: "NBA 1.3 | NAAC 1.2.1",
        },
      ],
      status: "not-started",
    },
    {
      id: "1.8",
      title: "Quality Course File",
      maxPoints: 8,
      subItems: [
        {
          name: "Course Planning & CO–PO Mapping",
          claimedScore: 0,
          maxScore: 1,
          evidence: "",
          description: "",
          guidance:
            "Introduction of a new theory/practical course or significant revision of existing course/lab.",
          itemDescription:
            "Faculty has introduced a new course or lab or carried out major revision in existing course/lab syllabus.",
          itemCriteria:
            "New course introduced or significant revision done with proper documentation and approval.",
          itemEvidence:
            "New/updated syllabus copy, BoS / academic council minutes, lab manual, equipment proposal, revision justification letter.",
          itemReference: "NBA 1.1, 1.2 | NAAC 1.1.1",
        },
        {
          name: "Course Articulation Matrix",
          claimedScore: 0,
          maxScore: 1,
          evidence: "",
          description: "",
          guidance: "Creation of high-quality digital learning material.",
          itemDescription:
            "Development of original video lectures, e-modules, animated content, simulations, or NPTEL-style material.",
          itemCriteria:
            "Quality, relevance, duration and accessibility of created digital content.",
          itemEvidence:
            "Public/shareable links (YouTube, Drive, LMS), number of modules created, total duration, student usage proof if available.",
          itemReference: "NBA 1.3 | NAAC 1.2.1",
        },
        {
          name: "Quality of Instructional Resources",
          claimedScore: 0,
          maxScore: 1,
          evidence: "",
          description: "",
          guidance: "Proper mapping of course outcomes to program outcomes.",
          itemDescription:
            "Course outcomes mapped to program outcomes and program specific outcomes with justification.",
          itemCriteria:
            "Correctness, completeness and approval of the mapping.",
          itemEvidence:
            "Approved CO-PO-PSO mapping table, articulation matrix, BoS approved document.",
          itemReference: "NBA 1.2, 1.3",
        },
        {
          name: "Assessment Plans & Bloom's-tagged Question Banks",
          claimedScore: 0,
          maxScore: 1,
          evidence: "",
          description: "",
          guidance: "Proper mapping of course outcomes to program outcomes.",
          itemDescription:
            "Course outcomes mapped to program outcomes and program specific outcomes with justification.",
          itemCriteria:
            "Correctness, completeness and approval of the mapping.",
          itemEvidence:
            "Approved CO-PO-PSO mapping table, articulation matrix, BoS approved document.",
          itemReference: "NBA 1.2, 1.3",
        },
        {
          name: "Repeat for Second Semester",
          claimedScore: 0,
          maxScore: 4,
          evidence: "",
          description: "",
          guidance: "Proper mapping of course outcomes to program outcomes.",
          itemDescription:
            "Course outcomes mapped to program outcomes and program specific outcomes with justification.",
          itemCriteria:
            "Correctness, completeness and approval of the mapping.",
          itemEvidence:
            "Approved CO-PO-PSO mapping table, articulation matrix, BoS approved document.",
          itemReference: "NBA 1.2, 1.3",
        },
      ],
      status: "not-started",
    },

    // Add remaining sections 1.3 to 1.8 following the same pattern
  ];

  // fetchData remains mostly the same — just preserve new fields
  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const subRes = await api.get(`/api/module1/faculty/${user.id}`);
      const backendData = subRes.data?.data || [];

      const appealRes = await api.get(`/api/appeal/${user.id}`);
      const facultyAppeals = appealRes.data?.data || [];
      setAppeals(facultyAppeals);

      const merged = defaultSubCriteria.map((sc) => {
        const existing = backendData.find((b: any) => b.id === sc.id);
        return {
          ...sc,
          subItems: sc.subItems.map((si) => {
            const existingItem = existing?.criteria?.find(
              (c: any) => c.name === si.name,
            );
            const matchingAppeal = facultyAppeals.find(
              (a: Appeal) =>
                a.subId === sc.id &&
                a.criterionName === si.name &&
                (a.status === "committee_verified" ||
                  a.committeeScore !== undefined),
            );

            return existingItem
              ? {
                  ...si,
                  claimedScore: existingItem.claimedScore ?? si.claimedScore,
                  evidence: existingItem.evidence ?? "",
                  description:
                    existingItem.facultyDescription ?? si.description ?? "",
                  hodScore: existingItem.hodScore ?? undefined,
                  hodDescription: existingItem.hodDescription ?? "",
                  isVerified: existingItem.isVerified ?? false,
                  committeeScore: matchingAppeal?.committeeScore ?? undefined,
                  committeeRemarks: matchingAppeal?.committeeRemarks ?? "",
                  guidance: si.guidance,
                  itemDescription: si.itemDescription,
                  itemCriteria: si.itemCriteria,
                  itemEvidence: si.itemEvidence,
                  itemReference: si.itemReference,
                }
              : si;
          }),
          status: existing ? "in-progress" : "not-started",
        };
      });

      setSubCriteria(merged);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const updateSubItem = (
    subId: string,
    index: number,
    field: keyof SubSubCriteria,
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
              status: "in-progress",
            },
      ),
    );
  };

  const saveSingleCriterion = async (
    subId: string,
    criterion: SubSubCriteria,
  ) => {
    if (!user) return;
    try {
      await api.post(`/api/module1/faculty/${user.id}/subsection/${subId}`, {
        criteria: [criterion],
      });
      toast({
        title: "Saved",
        description: `${criterion.name} saved successfully`,
      });
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
      await api.post(`/api/module1/faculty/${user.id}/subsection/${sub.id}`, {
        criteria: sub.subItems,
      });
      toast({ title: "Saved", description: `Subsection ${sub.id} saved` });
      fetchData();
    } catch {
      toast({
        title: "Error",
        description: "Save failed",
        variant: "destructive",
      });
    }
  };

  if (loading) return <p>Loading...</p>;

  const totalMax = subCriteria.reduce((sum, sc) => sum + sc.maxPoints, 0);
  const totalSubmitted = subCriteria.reduce(
    (sum, sc) =>
      sum +
      sc.subItems.reduce(
        (s, si) => s + (!si.isVerified ? si.claimedScore : 0),
        0,
      ),
    0,
  );
  const totalVerified = subCriteria.reduce(
    (sum, sc) =>
      sum +
      sc.subItems.reduce(
        (s, si) =>
          s + (si.isVerified ? (si.committeeScore ?? si.hodScore ?? 0) : 0),
        0,
      ),
    0,
  );

  return (
    <DashboardLayout
      title="Teaching & Learning"
      subtitle="Criterion 1 • Maximum 70 Points"
    >
      <div className="space-y-6">
        {/* Progress bar remains the same */}
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
                {Math.round(
                  ((totalSubmitted + totalVerified) / totalMax) * 100,
                )}
                %
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
            <AccordionItem
              key={sc.id}
              value={sc.id}
              className="border rounded-lg"
            >
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
                {/* Sub-items with their own description/criteria/evidence */}
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
                      {/* Here are the blocks you wanted — INSIDE each sub-item */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {si.itemDescription && (
                          <div className="bg-blue-50 p-3 rounded border border-blue-200">
                            <h5 className="font-medium text-blue-900 text-sm mb-1">
                              Description
                            </h5>
                            <p className="text-sm text-gray-700">
                              {si.itemDescription}
                            </p>
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
                            <p className="text-sm text-gray-700">
                              {si.itemReference}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Form fields */}
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
                              updateSubItem(
                                sc.id,
                                i,
                                "claimedScore",
                                Number(e.target.value),
                              )
                            }
                          />
                        </div>

                        {si.isVerified && si.hodScore !== undefined && (
                          <div>
                            <label className="text-sm font-medium block mb-1.5">
                              HOD Score
                            </label>
                            <input
                              type="number"
                              className="w-full border rounded p-2 bg-green-50"
                              value={si.hodScore}
                              disabled
                            />
                          </div>
                        )}

                        <div className="md:col-span-2">
                          <label className="text-sm font-medium block mb-1.5">
                            Evidence URL
                          </label>
                          <input
                            type="text"
                            className="w-full border rounded p-2"
                            value={si.evidence}
                            disabled={si.isVerified}
                            onChange={(e) =>
                              updateSubItem(
                                sc.id,
                                i,
                                "evidence",
                                e.target.value,
                              )
                            }
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-sm font-medium block mb-1.5">
                            Faculty Description
                          </label>
                          <textarea
                            className="w-full border rounded p-2 min-h-[100px]"
                            value={si.description}
                            disabled={si.isVerified}
                            onChange={(e) =>
                              updateSubItem(
                                sc.id,
                                i,
                                "description",
                                e.target.value,
                              )
                            }
                            placeholder="Explain how this sub-criterion is satisfied..."
                          />
                        </div>

                        {si.isVerified && si.hodDescription && (
                          <div className="md:col-span-2">
                            <label className="text-sm font-medium block mb-1.5">
                              HOD Description
                            </label>
                            <textarea
                              className="w-full border rounded p-2 min-h-[80px] bg-green-50"
                              value={si.hodDescription}
                              disabled
                            />
                          </div>
                        )}

                        {si.isVerified &&
                          si.committeeScore !== undefined &&
                          si.committeeScore !== null && (
                            <>
                              <div>
                                <label className="text-sm font-medium text-purple-700 block mb-1.5">
                                  Committee Score (Final)
                                </label>
                                <input
                                  type="number"
                                  className="w-full border rounded p-2 bg-purple-50 font-medium"
                                  value={si.committeeScore}
                                  disabled
                                />
                              </div>

                              <div className="md:col-span-2">
                                <label className="text-sm font-medium text-purple-700 block mb-1.5">
                                  Committee Remarks
                                </label>
                                <textarea
                                  className="w-full border rounded p-2 min-h-[80px] bg-purple-50"
                                  value={
                                    si.committeeRemarks ?? "No remarks provided"
                                  }
                                  disabled
                                />
                              </div>
                            </>
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
