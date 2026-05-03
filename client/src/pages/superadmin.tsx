// SuperAdminCriteriaManagement.tsx
// Manage FPMS evaluation criteria

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ──────────────────────────────────────────────── Types
interface Criterion {
  id: string;
  subParameter: string;
  weightage: number;
  description: string;
  alignedWith: string;
}

interface Section {
  title: string;
  tabKey: string;
  maxPoints: number;
  criteria: Criterion[];
}

// ──────────────────────────────────────────────── Component
export default function SuperAdminCriteriaManagement() {
  const { toast } = useToast();

  const [sections, setSections] = useState<Section[]>([
    {
      title: "Teaching & Learning",
      tabKey: "teaching-learning",
      maxPoints: 65,
      criteria: [
        {
          id: "1.1",
          subParameter:
            "Curriculum Development - New course design / Setting up a new Lab...",
          weightage: 8,
          description:
            "New course/module development, laboratory establishment, revision of curriculum/syllabus, development of instructional material, pedagogy innovation, etc.",
          alignedWith:
            "NBA 1.1.1 – 1.1.5; 1.2.1 – 1.2.4; NAAC 1.1.3, 1.2.1; NIRF TLR",
        },
        {
          id: "1.2",
          subParameter: "Teaching Load & Active Learning Pedagogy",
          weightage: 15,
          description:
            "Delivery of teaching using active, inclusive, and student-centric pedagogies. Self-assessment reports for classes and documentation of support provided.\nSummative: 2 (Active strategies) + 2 (Discovery labs) + 3 (Self-assessment) + 3 (Case studies) + 3 (SDG problems) + 2 (Slow learner support).",
          alignedWith: "",
        },
        {
          id: "1.3",
          subParameter:
            "Outcome-Based Education (OBE) Adaptation & Implementation",
          weightage: 6,
          description:
            "Systematic implementation of OBE in handled courses. TLA reports, assessment rubrics, and CO attainment calculations.\n2 points (TLA report) + 2 points (Rubric-based assessment) + 2 points (CO attainment methodology).",
          alignedWith: "NBA 2.x; NAAC 1.3.x",
        },
        {
          id: "1.4",
          subParameter: "Innovative Pedagogy & Assessment",
          weightage: 10,
          description:
            "Semester-wise implementation of innovative teaching and assessment practices. Semester-wise implementation records for the 5 specified components.\n5 components (LMS, Flipped classroom, Experiential learning, SWAYAM/NPTEL, Mini-projects) at 2 points each per semester.",
          alignedWith: "",
        },
        {
          id: "1.5",
          subParameter: "Technology-Enhanced Learning",
          weightage: 5,
          description:
            "Structured use of technology in teaching via digital content and LMS usage. Digital content portfolio and implementation report showing classroom/LMS usage.\n3 points (Unit-wise digital/video portfolio) + 2 points (Implementation report).",
          alignedWith: "",
        },
        {
          id: "1.6",
          subParameter: "Student Feedback",
          weightage: 8,
          description:
            "Teaching effectiveness based on institutional student feedback (≥ 75% attendance). Institutional student feedback records.\nSlab-based: ≥ 85% (4 points) or 75–84.9% (3 points) per semester across two semesters.",
          alignedWith: "NBA 1.3.x; NAAC 1.4.x",
        },
        {
          id: "1.7",
          subParameter: "Academic Results of Students",
          weightage: 10,
          description:
            "Student academic outcomes in theory subjects. Student academic result records.\nSlab-based: ≥ 60% students scoring >60% (5 points), 50-59.9% (4 points), 40-49.9% (3 points) per semester across two semesters.",
          alignedWith: "NBA 1.3.x; NIRF TLR",
        },
        {
          id: "1.8",
          subParameter: "Quality of Course File",
          weightage: 8,
          description:
            "Completeness and quality of course files as per IQAC template. Course files prepared as per IQAC template including Bloom’s-tagged question banks.\n4 components (Planning, Matrix, Resources, Assessment) at 1 point each per semester across two semesters.",
          alignedWith: "",
        },
      ],
    },
    {
      title: "Research & Consultancy",
      tabKey: "research",
      maxPoints: 75,
      criteria: [
        {
          id: "2.1",
          subParameter:
            "Publications in Fundamental / Applied / Educational Research, Book Chapters & Textbooks",
          weightage: 20,
          description:
            "Quality-weighted research productivity in indexed journals and books. Evidence of publication, author role, and institutional affiliation.\nSlab-based by Journal Quartile (Q1-Q4) or Impact Factor (IF), weighted by author role (1st/2nd/3rd). Capped at 20.",
          alignedWith: "NBA 2.2; NAAC 3.2; NIRF RP",
        },
        {
          id: "2.2",
          subParameter: "Citations & h-index Growth",
          weightage: 5,
          description:
            "Scholarly impact through citations and h-index improvement. Citation records (excluding self/co-author).\n0.2 per citation (max 3 points) + 2 points for YoY h-index growth.",
          alignedWith: "NIRF RP",
        },
        {
          id: "2.3",
          subParameter: "Discovery & Innovation (Patents, Creative Works)",
          weightage: 10,
          description:
            "Patent filings and creative works with adoption proof. Patent status documentation and adoption proof for creative works.\nUp to 10 points for Indian/USA patents (Institute as applicant); role-based (5/3/1) if faculty affiliation only; 5 points for creative works.",
          alignedWith: "NBA 2.3; NAAC 3.3",
        },
        {
          id: "2.4",
          subParameter: "Sponsored Research Projects",
          weightage: 18,
          description:
            "Securing funded research projects. Project approval letters and funding details.\nSlab-based by project value (≥ 20 Lakhs down to 1 Lakh) and role (PI vs Co-PI). 4 points (PI) / 2 (Co-PI) for approved proposals.",
          alignedWith: "NIRF RP",
        },
        {
          id: "2.5",
          subParameter: "Seed Funding & Outcomes",
          weightage: 4,
          description:
            "Receipt and utilization of seed funding. Proof of seed funding amount received.\nSlab-based by amount: ≥ 6 Lakhs (4 pts) to 1-2 Lakhs (1 pt).",
          alignedWith: "",
        },
        {
          id: "2.6",
          subParameter: "Consultancy Projects & Corporate Training",
          weightage: 10,
          description:
            "Revenue generation through research or general consultancy and training. Revenue proof and project documentation.\nRevenue slab-based scoring, differentiated by Research vs General consultancy type.",
          alignedWith: "NAAC 3.5; NIRF PPP",
        },
        {
          id: "2.7",
          subParameter: "PhD / Research Supervision",
          weightage: 4,
          description:
            "Guidance of research scholars and supervisor recognition. Supervision logs or official university status reports.\n4 pts (Awarded/Submitted), 2 pts (Ongoing/Registration/Pursuing PhD), 1 pt (Recognition). Capped at 4.",
          alignedWith: "NAAC 3.1",
        },
        {
          id: "2.8",
          subParameter: "Research-related Academic Services",
          weightage: 4,
          description:
            "Service to the research community (organising, editing, reviewing). Letters of appointment or certificates of service.\nActivity-based (Conferences, editorial, reviewing, chairing). Capped at 4.",
          alignedWith: "",
        },
      ],
    },
    {
      title: "Professional Development",
      tabKey: "professional",
      maxPoints: 65,
      criteria: [
        {
          id: "3.1",
          subParameter:
            "Attending Refresher Courses, FDPs, Training & Workshops",
          weightage: 10,
          description:
            "Structured professional learning (min 30 contact hours). Participation certificate, reflection report, and evidence of follow-up implementation.\nDuration-based: 4 weeks (10 pts) down to ≥ 5 days (5 pts). Only one online program from specific institutes considered.",
          alignedWith: "NAAC 2.4",
        },
        {
          id: "3.2",
          subParameter:
            "Organizing Refresher Courses, FDPs, Workshops & Training Programs",
          weightage: 10,
          description:
            "Leadership in executing capacity-building programs. Appointment orders or event reports.\nRole-based: Coordinator (7-10 pts) vs Member (2 pts). Max 6 members per event.",
          alignedWith: "",
        },
        {
          id: "3.3",
          subParameter:
            "Skilling / Re-skilling / Up-skilling (NPTEL & Industry Certifications)",
          weightage: 12,
          description:
            "Certified upskilling with classroom implementation. Certificate, reflection report, and implementation evidence.\nCertification level (Elite+) + 2 bonus points for implementation proof. 12-week course maxed at 10+2.",
          alignedWith: "",
        },
        {
          id: "3.4",
          subParameter: "Industry Certifications & VEDIC FDPs",
          weightage: 10,
          description:
            "Industry-aligned certifications and pedagogical programs. Certificates issued by authorised signatories.\nActivity-based: Industry cert ≥ 2 weeks (8 pts), VEDIC participation (6 pts), VEDIC presentation (4 pts), IGIP (6 pts).",
          alignedWith: "",
        },
        {
          id: "3.5",
          subParameter: "Professional Society Membership & Activities",
          weightage: 10,
          description:
            "Engagement in professional societies. Membership cards and communication/reports of activities conducted.\nMembership (3-5 pts) + Active activity contribution (5 pts). Mere membership earns membership points only.",
          alignedWith: "",
        },
        {
          id: "3.6",
          subParameter: "Academic Outreach (Outside the Institute)",
          weightage: 4,
          description:
            "Roles as resource person or in governing bodies outside the institute. Letters of invitation and certificates of attendance.\nRole-based: External Keynote (2 pts), External BOS/Council (4 pts).",
          alignedWith: "",
        },
        {
          id: "3.7",
          subParameter: "Extension Activities (Social Outreach & ESG)",
          weightage: 4,
          description:
            "Social outreach and ESG initiatives. Activity reports and student participation logs.\nRole-based: Coordinator (3 pts), Member (1 pt). Requires ≥ 30 student participants.",
          alignedWith: "NAAC 3.4",
        },
        {
          id: "3.8",
          subParameter: "Awards, Recognitions & Fellowships",
          weightage: 5,
          description:
            "External awards and recognitions. Award certificates or official letters.\nSource-based recognition from government, reputed institutions, or global publishers.",
          alignedWith: "NAAC 3.5",
        },
      ],
    },
    {
      title: "Student Development",
      tabKey: "student",
      maxPoints: 45,
      criteria: [
        {
          id: "4.1",
          subParameter: "Mentoring & Counselling Effectiveness",
          weightage: 10,
          description:
            "Quality of mentoring based on standardised logs and outcomes. Signed mentoring logbooks and feedback records.\n2 points each for any 5 activities (e.g., parent correspondence, interventions for slow learners). Min 3 meetings per student per semester.",
          alignedWith: "NAAC 2.3",
        },
        {
          id: "4.2",
          subParameter: "Faculty Support in Student Innovation & Start-ups",
          weightage: 12,
          description:
            "Support for student ideas, prototypes, and startups. Evidence of YUKTI 2.0 upload and outcome/TLR level proof.\nProgressive: Idea (6 pts), Prototype (8 pts), Startup (12 pts), Handholding (6 pts). Must be YUKTI 2.0 TLR Level 3+.",
          alignedWith: "NIRF TLR",
        },
        {
          id: "4.3",
          subParameter:
            "Focused Career Guidance (Placements / GATE / Higher Studies)",
          weightage: 6,
          description:
            "Structured involvement in career-oriented training (Placements/GATE). LMS upload of schedules, attendance, resources, and reflections.\n6 points for minimum 20 hours engagement in approved training programs.",
          alignedWith: "",
        },
        {
          id: "4.4",
          subParameter: "Guiding Students for External Competitions & Exposure",
          weightage: 4,
          description:
            "Guidance for success in external competitions or facilitation of field visits. Competition results or tour reports.\n4 pts for first-level competition success; 2 pts for industrial tours. Capped at 4.",
          alignedWith: "",
        },
        {
          id: "4.5",
          subParameter: "Organizing Student Hackathons / Design Competitions",
          weightage: 6,
          description:
            "Role in organising innovation-centric events for students. Event reports and committee lists.\nOrganiser (3 pts per event), Committee (1 pt). Max 6 members per event. Capped at 6.",
          alignedWith: "",
        },
        {
          id: "4.6",
          subParameter: "Student Publications / Patents (with Faculty Role)",
          weightage: 7,
          description:
            "Faculty contribution to student research outputs. Copy of publication/patent showing author order.\n7 points for an indexed student publication or patent where faculty is 1st or 2nd author.",
          alignedWith: "",
        },
      ],
    },
    {
      title: "Institutional Development",
      tabKey: "institutional",
      maxPoints: 45,
      criteria: [
        {
          id: "5.1",
          subParameter: "Industry Collaboration, MoUs & Industry Engagement",
          weightage: 12,
          description:
            "Engagement resulting in tangible outcomes like labs, internships, or lectures. MoUs, equipment installation proof, or internship rubrics.\nActivity-based: Sponsored labs (12 pts), joint programs (6 pts), internship facilitation (3 pts/student). Capped at 12.",
          alignedWith: "NAAC 3.5; NIRF PPP",
        },
        {
          id: "5.2",
          subParameter: "MoUs / Partnerships with Reputed Universities",
          weightage: 5,
          description:
            "Initiation and implementation of academic partnerships with tangible outcomes. Evidence of joint courses, projects, or exchange programs.\n5 points for initiation or implementation of at least one objective.",
          alignedWith: "",
        },
        {
          id: "5.3",
          subParameter: "Special Labs / Centres of Excellence (CoE)",
          weightage: 8,
          description:
            "Establishment or operation of special labs or CoEs. CoE establishment documents or measurable outcome reports.\nCoordinator (6-8 pts), Co-Coordinator (4-6 pts). New proposals are eligible if detailed. Capped at 8.",
          alignedWith: "",
        },
        {
          id: "5.4",
          subParameter: "Institutional Software / Apps / Alumni Engagement",
          weightage: 8,
          description:
            "Development of digital tools for the institute or active alumni engagement. Proof of software usage or alumni activity reports.\nDevelopment (8 pts) or active involvement in alumni meets/fundraising (up to 8 pts).",
          alignedWith: "",
        },
        {
          id: "5.5",
          subParameter: "Institutional & Departmental Responsibilities",
          weightage: 12,
          description:
            "Administrative and strategic roles at the department or institute level. Appointment letters and reports of outcomes achieved.\nRole-based: In-charge/SPOC (12 pts), Associate HoD (10 pts), Coordinator roles (6-8 pts). Cannot claim both levels.",
          alignedWith: "",
        },
      ],
    },
  ]);

  const [activeTab, setActiveTab] = useState("teaching-learning");

  // ─────── Handlers
  const addCriterion = (sectionIndex: number) => {
    const newCrit: Criterion = {
      id: `${sectionIndex + 1}.${sections[sectionIndex].criteria.length + 1}`,
      subParameter: "",
      weightage: 0,
      description: "",
      alignedWith: "",
    };
    setSections((prev) => {
      const next = [...prev];
      next[sectionIndex].criteria.push(newCrit);
      return next;
    });
  };

  const updateCriterion = (
    secIdx: number,
    critIdx: number,
    field: keyof Criterion,
    value: string | number,
  ) => {
    setSections((prev) => {
      const next = [...prev];
      next[secIdx].criteria[critIdx] = {
        ...next[secIdx].criteria[critIdx],
        [field]: value,
      };
      return next;
    });
  };

  const removeCriterion = (secIdx: number, critIdx: number) => {
    setSections((prev) => {
      const next = [...prev];
      next[secIdx].criteria.splice(critIdx, 1);
      next[secIdx].criteria = next[secIdx].criteria.map((c, i) => ({
        ...c,
        id: `${secIdx + 1}.${i + 1}`,
      }));
      return next;
    });
  };

  const handleSave = () => {
    const payload = {
      sections: sections.map((s) => ({
        title: s.title,
        maxPoints: s.maxPoints,
        criteria: s.criteria,
      })),
      timestamp: new Date().toISOString(),
    };
    console.log("Saving:", JSON.stringify(payload, null, 2));
    toast({
      title: "Configuration Saved",
      description: "Criteria settings saved successfully.",
    });
  };

  // Quick derived values for top cards
  const totalMainPoints = sections.reduce((sum, s) => sum + s.maxPoints, 0);

  return (
    <DashboardLayout
      title="Criteria Configuration"
      subtitle="Manage evaluation framework and weighted sections"
    >
      <div className="space-y-8 pb-16">
        {/* Sticky save action */}
        <div className="flex justify-end sticky top-2 z-20 bg-background/80 backdrop-blur-sm py-2">
          <Button
            size="lg"
            onClick={handleSave}
            className="gap-2 shadow-lg bg-green-700 hover:bg-green-800"
          >
            <Save className="h-5 w-5" />
            Save All Changes
          </Button>
        </div>

        {/* Status-like cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Main Framework</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalMainPoints}</div>
              <p className="text-sm text-muted-foreground">
                total points across all sections
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Sections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{sections.length}</div>
              <p className="text-sm text-muted-foreground">
                evaluation categories
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs – main content sections */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="teaching-learning">
              Teaching & Learning
            </TabsTrigger>
            <TabsTrigger value="research">Research</TabsTrigger>
            <TabsTrigger value="professional">Professional Dev</TabsTrigger>
            <TabsTrigger value="student">Student Dev</TabsTrigger>
            <TabsTrigger value="institutional">Institutional</TabsTrigger>
          </TabsList>

          {sections.map((section, secIdx) => (
            <TabsContent key={section.tabKey} value={section.tabKey}>
              <Card className="border-t-4 border-blue-600/60 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-xl">{section.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Max:{" "}
                      <span className="font-medium">
                        {section.maxPoints} points
                      </span>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addCriterion(secIdx)}
                    className="gap-1"
                  >
                    <Plus className="h-4 w-4" /> Add Criterion
                  </Button>
                </CardHeader>

                <CardContent className="space-y-6 pt-2">
                  {section.criteria.map((crit, critIdx) => (
                    <Card
                      key={crit.id}
                      className="bg-muted/30 border-l-4 border-blue-400"
                    >
                      <CardContent className="pt-6 space-y-5">
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="secondary"
                            className="px-3 py-1 text-base"
                          >
                            {crit.id}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeCriterion(secIdx, critIdx)}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Sub Parameter</Label>
                            <Input
                              value={crit.subParameter}
                              onChange={(e) =>
                                updateCriterion(
                                  secIdx,
                                  critIdx,
                                  "subParameter",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Weightage</Label>
                            <Input
                              type="number"
                              value={crit.weightage}
                              onChange={(e) =>
                                updateCriterion(
                                  secIdx,
                                  critIdx,
                                  "weightage",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <Label>Description & Rules</Label>
                            <Textarea
                              value={crit.description}
                              onChange={(e) =>
                                updateCriterion(
                                  secIdx,
                                  critIdx,
                                  "description",
                                  e.target.value,
                                )
                              }
                              rows={4}
                            />
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <Label>Aligned With</Label>
                            <Input
                              value={crit.alignedWith}
                              onChange={(e) =>
                                updateCriterion(
                                  secIdx,
                                  critIdx,
                                  "alignedWith",
                                  e.target.value,
                                )
                              }
                              placeholder="NBA … ; NAAC … ; NIRF …"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Final save reinforcement */}
        <div className="flex justify-center pt-12 pb-8">
          <Button
            size="lg"
            onClick={handleSave}
            className="gap-3 px-12 text-lg bg-green-700 hover:bg-green-800"
          >
            <Save className="h-6 w-6" />
            Save Criteria Configuration
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
