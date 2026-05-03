import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatRoleLabel } from "@/lib/utils";

interface AppealFormData {
  module: string;
  subId: string;
  criterionName: string;
  requestedScore: number;
  appealReason: string;
  evidence: string;
}

interface SubSubCriteria {
  name: string;
  claimedScore: number;
  facultyDescription: string;
  hodScore?: number;
  hodDescription?: string;
  isVerified?: boolean;
}

interface Subsection {
  id: string;
  criteria: SubSubCriteria[];
}

interface Appeal {
  id: string;
  facultyName: string;
  module: string;
  subId: string;
  criterionName: string;
  claimedScore: number;
  facultyDescription: string;
  hodScore?: number;
  hodDescription?: string;
  requestedScore: number;
  appealReason: string;
  evidence: string;
  status: string;
  committeeScore?: number; // Added for committee score
  committeeRemarks?: string; // Added for committee remarks
  createdAt: string;
}

const Appeals = () => {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [subsections, setSubsections] = useState<Subsection[]>([]);
  const [criteriaOptions, setCriteriaOptions] = useState<SubSubCriteria[]>([]);
  const [formData, setFormData] = useState<AppealFormData>({
    module: "",
    subId: "",
    criterionName: "",
    requestedScore: 0,
    appealReason: "",
    evidence: "",
  });

  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [expandedAppealIds, setExpandedAppealIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.id || !formData.module) return;
    const fetchSubsections = async () => {
      try {
        const res = await api.get(`/api/${formData.module}/faculty/${user.id}`);
        setSubsections(res.data?.data || []);
      } catch (error) {
        console.error(error);
        toast.error("Failed to fetch subsections");
      }
    };
    fetchSubsections();
  }, [user, formData.module]);

  useEffect(() => {
    if (!formData.subId) {
      setCriteriaOptions([]);
      setFormData((prev) => ({
        ...prev,
        criterionName: "",
        requestedScore: 0,
        evidence: "",
      }));
      return;
    }
    const sub = subsections.find((s) => s.id === formData.subId);
    if (sub) setCriteriaOptions(sub.criteria || []);
  }, [formData.subId, subsections]);

  useEffect(() => {
    if (!formData.criterionName) return;
    const crit = criteriaOptions.find((c) => c.name === formData.criterionName);
    if (crit) {
      setFormData((prev) => ({
        ...prev,
        requestedScore: crit.hodScore ?? crit.claimedScore ?? 0,
        evidence: crit.facultyDescription ?? "",
      }));
    }
  }, [formData.criterionName, criteriaOptions]);

  useEffect(() => {
    if (!user?.id) return;
    const fetchAppeals = async () => {
      try {
        const res = await api.get(`/api/appeal/${user.id}`);
        setAppeals(res.data?.data || []);
      } catch (error) {
        console.error(error);
        toast.error("Failed to fetch appeals");
      }
    };
    fetchAppeals();
  }, [user]);

  const handleInputChange = (field: keyof AppealFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitAppeal = async () => {
    const {
      module,
      subId,
      criterionName,
      requestedScore,
      appealReason,
      evidence,
    } = formData;
    if (
      !module ||
      !subId ||
      !criterionName ||
      !requestedScore ||
      !appealReason
    ) {
      toast.error("Please fill all required fields");
      return;
    }
    if (!user?.id) {
      toast.error("User not logged in");
      return;
    }
    try {
      await api.post(
        `/api/appeal/${module}/${user.id}/${subId}/${encodeURIComponent(criterionName)}`,
        { requestedScore, appealReason, evidence },
      );
      toast.success("Appeal submitted successfully");
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

      const res = await api.get(`/api/appeal/${user.id}`);
      setAppeals(res.data?.data || []);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to submit appeal");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedAppealIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const groupedAppeals = appeals.reduce(
    (acc: Record<string, Appeal[]>, appeal) => {
      if (!acc[appeal.facultyName]) acc[appeal.facultyName] = [];
      acc[appeal.facultyName].push(appeal);
      return acc;
    },
    {},
  );

  return (
    <DashboardLayout
      title="Appeals"
      subtitle="Submit and view your score appeals"
    >
      <div className="space-y-6 text-sm">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            New Appeal
          </Button>
        </div>

        {isDialogOpen && (
          <Card className="p-4 space-y-3 shadow-sm rounded-lg">
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Submit New Appeal
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Module</Label>
                <Select
                  value={formData.module}
                  onValueChange={(v) => handleInputChange("module", v)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select Module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="module1">Module 1</SelectItem>
                    <SelectItem value="module5">Module 5</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Subsection</Label>
                <Select
                  value={formData.subId}
                  onValueChange={(v) => handleInputChange("subId", v)}
                  disabled={!subsections.length}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select Subsection" />
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

              <div className="grid gap-1">
                <Label className="text-xs">Criterion</Label>
                <Select
                  value={formData.criterionName}
                  onValueChange={(v) => handleInputChange("criterionName", v)}
                  disabled={!criteriaOptions.length}
                >
                  <SelectTrigger className="text-sm">
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

              {formData.criterionName && (
                <div className="bg-gray-50 p-2 rounded-md text-xs space-y-1">
                  <div>
                    <strong>Faculty Score:</strong>{" "}
                    {
                      criteriaOptions.find(
                        (c) => c.name === formData.criterionName,
                      )?.claimedScore
                    }
                  </div>
                  <div>
                    <strong>Faculty Description:</strong>{" "}
                    {
                      criteriaOptions.find(
                        (c) => c.name === formData.criterionName,
                      )?.facultyDescription
                    }
                  </div>
                  <div>
                    <strong>HOD Score:</strong>{" "}
                    {criteriaOptions.find(
                      (c) => c.name === formData.criterionName,
                    )?.hodScore ?? "N/A"}
                  </div>
                  <div>
                    <strong>HOD Description:</strong>{" "}
                    {criteriaOptions.find(
                      (c) => c.name === formData.criterionName,
                    )?.hodDescription ?? "N/A"}
                  </div>
                </div>
              )}

              <div className="grid gap-1">
                <Label className="text-xs">Requested Score</Label>
                <Input
                  type="number"
                  value={formData.requestedScore}
                  onChange={(e) =>
                    handleInputChange("requestedScore", Number(e.target.value))
                  }
                  className="text-sm"
                />
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Evidence / Description</Label>
                <Textarea
                  value={formData.evidence}
                  onChange={(e) =>
                    handleInputChange("evidence", e.target.value)
                  }
                  placeholder="Paste link or text evidence"
                  className="text-sm h-16"
                />
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Appeal Reason</Label>
                <Textarea
                  value={formData.appealReason}
                  onChange={(e) =>
                    handleInputChange("appealReason", e.target.value)
                  }
                  placeholder="Explain why you are appealing this score"
                  className="text-sm h-16"
                />
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSubmitAppeal}>
                  Submit
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {Object.entries(groupedAppeals).map(([faculty, facultyAppeals]) => (
          <div key={faculty} className="space-y-3">
            <div className="p-3 bg-slate-100 rounded-md shadow-sm">
              <h2 className="text-sm font-semibold text-gray-800">
                {user.name}
              </h2>
              <h2 className="text-sm text-gray-600">{user.email}</h2>
              <h2 className="text-sm text-gray-600 capitalize">
                {formatRoleLabel(user.role)}
              </h2>
            </div>
            {facultyAppeals.map((a) => {
              const isExpanded = expandedAppealIds.includes(a.id);
              let statusColor = "text-gray-600";
              if (a.status === "pending") statusColor = "text-yellow-600";
              if (a.status === "committee_verified")
                statusColor = "text-green-600";

              return (
                <Card
                  key={a.id}
                  className="shadow-md rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-300"
                >
                  <CardHeader className="flex flex-row justify-between items-center p-4 border-b">
                    <CardTitle className="text-lg font-semibold text-gray-800">
                      {a.module} - {a.subId} - {a.criterionName}
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExpand(a.id)}
                      className="text-sm"
                    >
                      {isExpanded ? "Hide Details" : "View Details"}
                    </Button>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="p-4 space-y-3 text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <strong className="font-medium text-gray-700">
                            Faculty Score:
                          </strong>{" "}
                          {a.claimedScore}
                        </div>
                        <div>
                          <strong className="font-medium text-gray-700">
                            HOD Score:
                          </strong>{" "}
                          {a.hodScore ?? "N/A"}
                        </div>
                        <div className="md:col-span-2">
                          <strong className="font-medium text-gray-700">
                            Faculty Description:
                          </strong>{" "}
                          {a.facultyDescription}
                        </div>
                        <div className="md:col-span-2">
                          <strong className="font-medium text-gray-700">
                            HOD Description:
                          </strong>{" "}
                          {a.hodDescription ?? "N/A"}
                        </div>
                        <div>
                          <strong className="font-medium text-blue-600">
                            Requested Score:
                          </strong>{" "}
                          {a.requestedScore}
                        </div>
                        <div>
                          <strong className="font-medium text-purple-600">
                            Committee Score:
                          </strong>{" "}
                          {a.committeeScore ?? "N/A"}
                        </div>
                        <div className="md:col-span-2">
                          <strong className="font-medium text-purple-600">
                            Committee Remarks:
                          </strong>{" "}
                          {a.committeeRemarks ?? "N/A"}
                        </div>
                      </div>
                      <div className="border-t pt-3 mt-3 space-y-2">
                        <div>
                          <strong className="font-medium text-gray-700">
                            Evidence:
                          </strong>{" "}
                          {a.evidence}
                        </div>
                        <div>
                          <strong className="font-medium text-gray-700">
                            Reason:
                          </strong>{" "}
                          {a.appealReason}
                        </div>
                        <div>
                          <strong className="font-medium text-gray-700">
                            Status:
                          </strong>{" "}
                          <span className={`font-medium ${statusColor}`}>
                            {a.status}
                          </span>
                        </div>
                        <div>
                          <strong className="font-medium text-gray-700">
                            Submitted On:
                          </strong>{" "}
                          {new Date(a.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default Appeals;
