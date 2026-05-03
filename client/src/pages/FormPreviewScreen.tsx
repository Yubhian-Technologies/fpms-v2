import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Edit2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { FPMSForm } from "@/types/formBuilder";
import { api } from "@/api/api";

export default function FormPreviewScreen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { formId } = useParams();
  const [form, setForm] = useState<FPMSForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadForm = async () => {
      if (!formId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await api.get(`/api/superadmin/forms/${formId}`);
        setForm((response.data?.data as FPMSForm) || null);
      } catch (error: any) {
        setForm(null);
        toast({
          title: "Load Failed",
          description:
            error?.response?.data?.message || "Unable to load form preview.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadForm();
  }, [formId]);

  // Only superadmin can access (case-insensitive)
  if (String(user?.role || "").toLowerCase() !== "superadmin") {
    return (
      <DashboardLayout title="Form Preview" subtitle="Super admin access only">
        <Card>
          <CardContent className="pt-6 text-muted-foreground">
            You do not have permission to view this screen.
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="FormPreviewScreen"
      subtitle="Read-only preview of the saved FPMS form"
    >
      <div className="space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/superadmin/form-builder")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Builder
          </Button>
          <Button
            onClick={() =>
              form && navigate(`/superadmin/form-builder?edit=${form.id}`)
            }
            className="gap-2"
            disabled={!form || isLoading}
          >
            <Edit2 className="h-4 w-4" />
            Edit Form
          </Button>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="pt-6 text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading form preview...
            </CardContent>
          </Card>
        ) : !form ? (
          <Card>
            <CardContent className="pt-6 text-muted-foreground">
              Form not found. Please return to builder and save the form.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{form.formTitle || "Untitled Form"}</CardTitle>
                <CardDescription>
                  Applicable roles and marks summary
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {form.applicableRoles.map((role) => (
                    <Badge key={role} variant="outline">
                      {role}
                    </Badge>
                  ))}
                </div>
                <div className="text-lg font-semibold">
                  Total Marks: {form.totalMarks}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {form.criteria.map((criteriaItem, criteriaIndex) => (
                <Card key={criteriaItem.id}>
                  <CardHeader>
                    <CardTitle>
                      Criteria {criteriaIndex + 1}:{" "}
                      {criteriaItem.criteriaName || "Untitled Criteria"}
                    </CardTitle>
                    <CardDescription>
                      Criteria Total Marks: {criteriaItem.totalMarks}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {criteriaItem.modules.map((moduleItem) => (
                      <Card key={moduleItem.id} className="bg-muted/30">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">
                            Module {moduleItem.moduleNumber}:{" "}
                            {moduleItem.moduleName || "Untitled Module"}
                          </CardTitle>
                          <CardDescription>
                            Module Total Marks: {moduleItem.totalMarks}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {moduleItem.tasks.map((taskItem, taskIndex) => (
                            <Card
                              key={taskItem.id}
                              className="border-l-4 border-l-violet-500"
                            >
                              <CardContent className="pt-4 space-y-2">
                                <div className="flex items-center justify-between gap-4">
                                  <p className="font-medium">
                                    Task {taskIndex + 1}:{" "}
                                    {taskItem.title || "Untitled Task"}
                                  </p>
                                  <Badge>Marks: {taskItem.marks}</Badge>
                                </div>
                                {taskItem.subtitle ? (
                                  <p className="text-sm text-muted-foreground">
                                    {taskItem.subtitle}
                                  </p>
                                ) : null}
                                {taskItem.description ? (
                                  <p className="text-sm">
                                    Description: {taskItem.description}
                                  </p>
                                ) : null}
                                {taskItem.assessmentCriteria ? (
                                  <p className="text-sm">
                                    Assessment Criteria:{" "}
                                    {taskItem.assessmentCriteria}
                                  </p>
                                ) : null}
                                {taskItem.evidence ? (
                                  <p className="text-sm">
                                    Evidence: {taskItem.evidence}
                                  </p>
                                ) : null}
                                {taskItem.reference ? (
                                  <p className="text-sm">
                                    Reference: {taskItem.reference}
                                  </p>
                                ) : null}
                              </CardContent>
                            </Card>
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
