import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";

interface DeadlineForm {
  assessmentStart: string;
  assessmentEnd: string;
  evaluationEnd: string;
  appealEnd: string;
  appealReviewEnd: string;
}

const toDateInput = (iso?: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const empty: DeadlineForm = {
  assessmentStart: "",
  assessmentEnd: "",
  evaluationEnd: "",
  appealEnd: "",
  appealReviewEnd: "",
};

export default function CollegeDeadlines() {
  const [form, setForm] = useState<DeadlineForm>(empty);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const res = await api.get("/api/admin/college-details");
        const data = res.data?.data ?? {};
        setForm({
          assessmentStart: toDateInput(data.assessmentStart),
          assessmentEnd: toDateInput(data.assessmentEnd),
          evaluationEnd: toDateInput(data.evaluationEnd),
          appealEnd: toDateInput(data.appealEnd),
          appealReviewEnd: toDateInput(data.appealReviewEnd),
        });
      } catch {
        toast({ title: "Failed to load deadlines", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await api.put("/api/admin/college-deadlines", {
        assessmentStart: form.assessmentStart || null,
        assessmentEnd: form.assessmentEnd || null,
        evaluationEnd: form.evaluationEnd || null,
        appealEnd: form.appealEnd || null,
        appealReviewEnd: form.appealReviewEnd || null,
      });
      toast({ title: "Deadlines saved successfully" });
    } catch (err: any) {
      toast({
        title: "Failed to save deadlines",
        description: err.response?.data?.message || "Server error",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const fields: { key: keyof DeadlineForm; label: string; description: string }[] = [
    { key: "assessmentStart", label: "Submission Start", description: "When faculty can begin submitting" },
    { key: "assessmentEnd", label: "Submission End", description: "Last date for faculty submissions" },
    { key: "evaluationEnd", label: "Evaluation End", description: "Last date for HOD reviews" },
    { key: "appealEnd", label: "Appeal End", description: "Last date for faculty to raise appeals" },
    { key: "appealReviewEnd", label: "Appeal Review End", description: "Last date for appeal review decisions" },
  ];

  return (
    <DashboardLayout title="College Deadlines" subtitle="Set submission and evaluation dates for your college">
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Academic Period Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-5">
                {fields.map(({ key, label, description }) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={key}>{label}</Label>
                    <p className="text-xs text-muted-foreground">{description}</p>
                    <Input
                      id={key}
                      type="date"
                      value={form[key]}
                      onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSaving ? "Saving..." : "Save Deadlines"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
