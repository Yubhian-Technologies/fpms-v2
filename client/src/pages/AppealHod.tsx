import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/api/api";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";

/* ============================
   TYPES
============================ */

interface SubSubCriteria {
  name: string;
  claimedScore: number;
  facultyDescription: string;
  hodScore?: number;
  hodDescription?: string;
  adminScore?: number;
  adminDescription?: string;
}

interface Subsection {
  id: string;
  criteria: SubSubCriteria[];
}

interface Appeal {
  id: string;
  module: string;
  subId: string;
  criterionName: string;
  requestedScore: number;
  hodDescription: string;
  evidence: string;
  status: string;
  createdAt: string;

  committeeScore?: number;
  committeeRemarks?: string;
  committeeVerifiedAt?: string;
}

interface AppealFormData {
  module: string;
  subId: string;
  criterionName: string;
  requestedScore: number;
  appealReason: string;
  evidence: string;
}

/* ============================
   COMPONENT
============================ */

const AppealHod = () => {
  const { user } = useAuth();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [subsections, setSubsections] = useState<Subsection[]>([]);
  const [criteriaOptions, setCriteriaOptions] = useState<SubSubCriteria[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [expandedAppealIds, setExpandedAppealIds] = useState<string[]>([]);
  const [loadingSubsections, setLoadingSubsections] = useState(false);

  const [formData, setFormData] = useState<AppealFormData>({
    module: "",
    subId: "",
    criterionName: "",
    requestedScore: 0,
    appealReason: "",
    evidence: "",
  });

  /* ============================
     FETCH HOD APPEALS
  ============================ */
  useEffect(() => {
    if (!user?.id) return;

    const fetchAppeals = async () => {
      try {
        const res = await api.get("/api/hod/appeals/partab");
        setAppeals(res.data?.data || []);
      } catch (err) {
        toast.error("Failed to fetch appeals");
      }
    };

    fetchAppeals();
  }, [user]);

  /* ============================
     FETCH SUBSECTIONS WHEN MODULE CHANGES
  ============================ */
  useEffect(() => {
    if (!formData.module || !user?.id) {
      setSubsections([]);
      return;
    }

    const fetchSubsections = async () => {
      try {
        setLoadingSubsections(true);
        const res = await api.get(`/api/hod/parta/${user.id}`);
        setSubsections(res.data?.data || []);
      } catch (err) {
        toast.error("Failed to load subsections");
      } finally {
        setLoadingSubsections(false);
      }
    };

    fetchSubsections();
  }, [formData.module, user]);

  /* ============================
     UPDATE CRITERIA OPTIONS
  ============================ */
  useEffect(() => {
    if (!formData.subId) {
      setCriteriaOptions([]);
      return;
    }

    const sub = subsections.find((s) => s.id === formData.subId);
    setCriteriaOptions(sub?.criteria || []);
  }, [formData.subId, subsections]);

  /* ============================
     AUTO FILL SCORE + EVIDENCE
  ============================ */
  useEffect(() => {
    if (!formData.criterionName) return;

    const crit = criteriaOptions.find((c) => c.name === formData.criterionName);

    if (!crit) return;

    setFormData((prev) => ({
      ...prev,
      requestedScore: crit.hodScore ?? crit.claimedScore ?? 0,
      evidence: crit.hodDescription ?? "",
    }));
  }, [formData.criterionName, criteriaOptions]);

  const handleInputChange = (field: keyof AppealFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /* ============================
     SUBMIT APPEAL
  ============================ */
  const handleSubmitAppeal = async () => {
    const {
      module,
      subId,
      criterionName,
      requestedScore,
      appealReason,
      evidence,
    } = formData;

    if (!module || !subId || !criterionName || !appealReason) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      await api.post(
        `/api/hod/appeals/modules/${module}/sub/${subId}/criteria/${encodeURIComponent(
          criterionName,
        )}/appeal`,
        {
          requestedScore,
          hodDescription: appealReason,
          evidence,
        },
      );

      toast.success("Appeal submitted successfully");

      const res = await api.get("/api/hod/appeals/partab");
      setAppeals(res.data?.data || []);

      setIsDialogOpen(false);
      setFormData({
        module: "",
        subId: "",
        criterionName: "",
        requestedScore: 0,
        appealReason: "",
        evidence: "",
      });

      setSubsections([]);
      setCriteriaOptions([]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to submit appeal");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedAppealIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  /* ============================
     CURRENT CRITERION CARD
  ============================ */
  const selectedCriterion = criteriaOptions.find(
    (c) => c.name === formData.criterionName,
  );

  return (
    <DashboardLayout
      title="HOD Appeals"
      subtitle="Submit and view your appeals"
    >
      <div className="space-y-6 text-sm">
        {/* New Appeal Button */}
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            New Appeal
          </Button>
        </div>

        {/* Appeal Form */}
        {isDialogOpen && (
          <Card className="p-4 space-y-3 shadow-sm rounded-lg">
            <CardHeader>
              <CardTitle>Submit New Appeal</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-3">
              {/* Module */}
              <div>
                <Label>Module</Label>
                <Select
                  value={formData.module}
                  onValueChange={(v) => handleInputChange("module", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="module1">Module 1</SelectItem>
                    <SelectItem value="module5">Module 5</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Subsection */}
              <div>
                <Label>Subsection</Label>
                <Select
                  value={formData.subId}
                  onValueChange={(v) => handleInputChange("subId", v)}
                  disabled={!subsections.length}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loadingSubsections ? "Loading..." : "Select Subsection"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {subsections.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Criterion */}
              <div>
                <Label>Criterion</Label>
                <Select
                  value={formData.criterionName}
                  onValueChange={(v) => handleInputChange("criterionName", v)}
                  disabled={!criteriaOptions.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Criterion" />
                  </SelectTrigger>
                  <SelectContent>
                    {criteriaOptions.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ⭐ Display HOD + Admin Score Card */}
              {selectedCriterion && (
                <Card className="bg-gray-50 border border-gray-200 p-3 rounded-md">
                  <div>
                    <strong>HOD Claimed Score:</strong>{" "}
                    {selectedCriterion.claimedScore}
                  </div>
                  <div>
                    <strong>HOD Description:</strong>{" "}
                    {selectedCriterion.hodDescription || "No description"}
                  </div>
                  {selectedCriterion.adminScore !== undefined && (
                    <>
                      <div className="mt-2">
                        <strong>Admin Score:</strong>{" "}
                        {selectedCriterion.adminScore}
                      </div>
                      <div>
                        <strong>Admin Description:</strong>{" "}
                        {selectedCriterion.adminDescription || "No description"}
                      </div>
                    </>
                  )}
                </Card>
              )}

              {/* Requested Score */}
              <div>
                <Label>Requested Score</Label>
                <input
                  type="number"
                  value={formData.requestedScore}
                  onChange={(e) =>
                    handleInputChange("requestedScore", Number(e.target.value))
                  }
                  className="border rounded px-2 py-1 text-sm w-full"
                />
              </div>

              {/* Evidence */}
              <div>
                <Label>Evidence</Label>
                <Textarea
                  value={formData.evidence}
                  onChange={(e) =>
                    handleInputChange("evidence", e.target.value)
                  }
                />
              </div>

              {/* Appeal Reason */}
              <div>
                <Label>Appeal Reason</Label>
                <Textarea
                  value={formData.appealReason}
                  onChange={(e) =>
                    handleInputChange("appealReason", e.target.value)
                  }
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmitAppeal}>Submit</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Appeals List */}
        {appeals.map((a) => (
          <Card key={a.id} className="shadow-md rounded-lg">
            <CardHeader className="flex justify-between items-center">
              <CardTitle>
                {a.module} - {a.subId} - {a.criterionName}
              </CardTitle>
              <Button size="sm" onClick={() => toggleExpand(a.id)}>
                {expandedAppealIds.includes(a.id) ? "Hide" : "View"}
              </Button>
            </CardHeader>

            {expandedAppealIds.includes(a.id) && (
              <CardContent className="space-y-2">
                <div>
                  <strong>Requested Score:</strong> {a.requestedScore}
                </div>

                <div>
                  <strong>Status:</strong>{" "}
                  <span
                    className={
                      a.status === "committee_verified"
                        ? "text-green-600 font-semibold"
                        : "text-yellow-600 font-semibold"
                    }
                  >
                    {a.status}
                  </span>
                </div>

                <div>
                  <strong>Reason:</strong> {a.hodDescription}
                </div>

                <div>
                  <strong>Evidence:</strong> {a.evidence}
                </div>

                <div>
                  <strong>Submitted:</strong>{" "}
                  {a.createdAt ? new Date(a.createdAt).toLocaleString() : "-"}
                </div>

                {/* Committee Decision */}
                {a.status === "committee_verified" && (
                  <div className="mt-3 p-3 bg-green-50 rounded-md border border-green-200 space-y-1">
                    <div className="text-green-700 font-semibold">
                      Committee Decision
                    </div>

                    <div>
                      <strong>Approved Score:</strong> {a.committeeScore}
                    </div>

                    <div>
                      <strong>Committee Remarks:</strong>{" "}
                      {a.committeeRemarks || "No remarks"}
                    </div>

                    {a.committeeVerifiedAt && (
                      <div>
                        <strong>Verified At:</strong>{" "}
                        {new Date(a.committeeVerifiedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default AppealHod;
