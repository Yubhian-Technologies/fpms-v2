import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Eye, Trash2, Loader2, Copy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { FPMSForm, Criteria, Module, Task } from "@/types/formBuilder";
import CriteriaForm from "@/components/CriteriaForm";
import FormSummary from "@/components/FormSummary";
import { api } from "@/api/api";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import ImportFormsDialog from "@/components/ImportFormsDialog";
import { useAcademicYear } from "@/contexts/AcademicYearContext";

const createTask = (): Task => ({
  id: `task-${Date.now()}-${Math.random()}`,
  title: "",
  subtitle: "",
  description: "",
  assessmentCriteria: "",
  evidence: "",
  reference: "",
  marks: 0,
  marksType: "fixed",
});

const createModule = (): Module => ({
  id: `module-${Date.now()}-${Math.random()}`,
  moduleNumber: 1,
  moduleName: "",
  totalMarks: 0,
  tasks: [createTask()],
});

const createCriteria = (): Criteria => ({
  id: `criteria-${Date.now()}-${Math.random()}`,
  criteriaName: "",
  totalMarks: 0,
  modules: [createModule()],
});

const createEmptyForm = (): FPMSForm => ({
  id: "",
  formTitle: "",
  applicableRoles: [],
  totalMarks: 0,
  criteria: [],
});

interface RoleOption {
  id: string;
  name: string;
  level: number;
}

interface SavedFormSummary {
  id: string;
  formTitle: string;
  displayOrder?: number;
  applicableRoles: string[];
  totalMarks: number;
  criteriaCount: number;
}

interface ConfirmDialogState {
  title: string;
  description: string;
  confirmText?: string;
  onConfirm: () => void;
}

const recalculateForm = (form: FPMSForm): FPMSForm => {
  const criteria = form.criteria.map((criteriaItem) => {
    const modules = criteriaItem.modules.map((moduleItem) => {
      const tasks = moduleItem.tasks.map((task) => ({
        ...task,
        marks: Math.max(0, Number.isFinite(task.marks) ? task.marks : 0),
      }));

      const moduleTotal = tasks.reduce((sum, task) => sum + task.marks, 0);
      return {
        ...moduleItem,
        totalMarks: moduleTotal,
        tasks,
      };
    });

    const criteriaTotal = modules.reduce(
      (sum, moduleItem) => sum + moduleItem.totalMarks,
      0,
    );
    return {
      ...criteriaItem,
      totalMarks: criteriaTotal,
      modules,
    };
  });

  const totalMarks = criteria.reduce((sum, c) => sum + c.totalMarks, 0);

  return {
    ...form,
    criteria,
    totalMarks,
  };
};

// Unsaved builder work is kept in the browser so a reload, crash or logout
// doesn't lose it. One draft per user; cleared when the form is saved.
interface StoredBuilderDraft {
  editingFormId: string | null;
  draft: FPMSForm;
  savedAt: number;
}

const draftStorageKey = (userId: string) => `fpms.formBuilderDraft.${userId}`;

const readStoredDraft = (key: string): StoredBuilderDraft | null => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.draft ? parsed : null;
  } catch {
    return null;
  }
};

const writeStoredDraft = (key: string, value: StoredBuilderDraft | null) => {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {
    /* storage full or unavailable — auto-save is best effort */
  }
};

export default function CreateFormScreen() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const editFormIdFromQuery = searchParams.get("edit");
  const { isHistory, years } = useAcademicYear();
  const [importOpen, setImportOpen] = useState(false);

  const [draft, setDraft] = useState<FPMSForm>(createEmptyForm());
  const [savedForms, setSavedForms] = useState<SavedFormSummary[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [deletingFormId, setDeletingFormId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(
    null,
  );

  const draftKey = draftStorageKey(String((user as any)?.id || (user as any)?.uid || user?.email || "superadmin"));
  // Set by edits made in the builder; loading or saving a form resets it
  const isDirtyRef = useRef(false);
  const [restorable, setRestorable] = useState<StoredBuilderDraft | null>(null);
  const [lastAutoSaved, setLastAutoSaved] = useState<number | null>(null);

  // Offer unsaved work from a previous visit once the builder has loaded
  useEffect(() => {
    if (!isInitialLoading) setRestorable(readStoredDraft(draftKey));
  }, [isInitialLoading, draftKey]);

  // Auto-save edits shortly after typing stops
  useEffect(() => {
    if (!isDirtyRef.current) return;
    const timer = setTimeout(() => {
      const savedAt = Date.now();
      writeStoredDraft(draftKey, { editingFormId, draft, savedAt });
      setLastAutoSaved(savedAt);
    }, 1000);
    return () => clearTimeout(timer);
  }, [draft, editingFormId, draftKey]);

  const clearStoredDraft = () => {
    isDirtyRef.current = false;
    writeStoredDraft(draftKey, null);
    setLastAutoSaved(null);
  };

  const restoreStoredDraft = () => {
    if (!restorable) return;
    isDirtyRef.current = true;
    setEditingFormId(restorable.editingFormId);
    setDraft(recalculateForm(restorable.draft));
    setRestorable(null);
  };

  const discardStoredDraft = () => {
    writeStoredDraft(draftKey, null);
    setRestorable(null);
  };

  const roleNames = useMemo(
    () => Array.from(new Set(roleOptions.map((role) => role.name))),
    [roleOptions],
  );

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsInitialLoading(true);

        const [rolesResponse, formsResponse] = await Promise.all([
          api.get("/api/superadmin/roles"),
          api.get("/api/superadmin/forms"),
        ]);

        setRoleOptions(rolesResponse.data?.data ?? []);
        setSavedForms(formsResponse.data?.data ?? []);

        if (editFormIdFromQuery) {
          const editResponse = await api.get(
            `/api/superadmin/forms/${editFormIdFromQuery}`,
          );
          const editForm = editResponse.data?.data as FPMSForm | undefined;

          if (editForm) {
            setEditingFormId(editForm.id);
            setDraft(recalculateForm(editForm));
          }
        }
      } catch (error: any) {
        toast({
          title: "Load Failed",
          description:
            error?.response?.data?.message ||
            "Unable to load form builder data.",
          variant: "destructive",
        });
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadInitialData();
  }, [editFormIdFromQuery]);

  const fetchSavedForms = async (silent = false) => {
    try {
      const response = await api.get("/api/superadmin/forms");
      setSavedForms(response.data?.data ?? []);
    } catch (error: any) {
      if (!silent) {
        toast({
          title: "Load Failed",
          description:
            error?.response?.data?.message || "Unable to load saved forms.",
          variant: "destructive",
        });
      }
    }
  };

  const updateDraft = (updater: (prev: FPMSForm) => FPMSForm) => {
    isDirtyRef.current = true;
    setRestorable(null);
    setDraft((prev) => recalculateForm(updater(prev)));
  };

  const toggleRole = (role: string) => {
    updateDraft((prev) => ({
      ...prev,
      applicableRoles: prev.applicableRoles.includes(role)
        ? prev.applicableRoles.filter((r) => r !== role)
        : [...prev.applicableRoles, role],
    }));
  };

  const addCriteria = () => {
    updateDraft((prev) => ({
      ...prev,
      criteria: [...prev.criteria, createCriteria()],
    }));
  };

  const updateCriteria = (criteriaId: string, updates: Partial<Criteria>) => {
    updateDraft((prev) => ({
      ...prev,
      criteria: prev.criteria.map((criteriaItem) =>
        criteriaItem.id === criteriaId
          ? { ...criteriaItem, ...updates }
          : criteriaItem,
      ),
    }));
  };

  const deleteCriteria = (criteriaId: string) => {
    setConfirmDialog({
      title: "Delete criteria?",
      description:
        "This will delete the criteria and all nested modules and tasks.",
      confirmText: "Delete",
      onConfirm: () => {
        updateDraft((prev) => ({
          ...prev,
          criteria: prev.criteria.filter(
            (criteriaItem) => criteriaItem.id !== criteriaId,
          ),
        }));
        setConfirmDialog(null);
      },
    });
  };

  const addModule = (criteriaId: string) => {
    updateDraft((prev) => ({
      ...prev,
      criteria: prev.criteria.map((criteriaItem) =>
        criteriaItem.id === criteriaId
          ? {
              ...criteriaItem,
              modules: [...criteriaItem.modules, createModule()],
            }
          : criteriaItem,
      ),
    }));
  };

  const updateModule = (
    criteriaId: string,
    moduleId: string,
    updates: Partial<Module>,
  ) => {
    updateDraft((prev) => ({
      ...prev,
      criteria: prev.criteria.map((criteriaItem) => {
        if (criteriaItem.id !== criteriaId) return criteriaItem;

        return {
          ...criteriaItem,
          modules: criteriaItem.modules.map((moduleItem) =>
            moduleItem.id === moduleId
              ? { ...moduleItem, ...updates }
              : moduleItem,
          ),
        };
      }),
    }));
  };

  const deleteModule = (criteriaId: string, moduleId: string) => {
    setConfirmDialog({
      title: "Delete module?",
      description: "This will delete the module and all nested tasks.",
      confirmText: "Delete",
      onConfirm: () => {
        updateDraft((prev) => ({
          ...prev,
          criteria: prev.criteria.map((criteriaItem) => {
            if (criteriaItem.id !== criteriaId) return criteriaItem;

            return {
              ...criteriaItem,
              modules: criteriaItem.modules.filter(
                (moduleItem) => moduleItem.id !== moduleId,
              ),
            };
          }),
        }));
        setConfirmDialog(null);
      },
    });
  };

  const addTask = (criteriaId: string, moduleId: string) => {
    updateDraft((prev) => ({
      ...prev,
      criteria: prev.criteria.map((criteriaItem) => {
        if (criteriaItem.id !== criteriaId) return criteriaItem;

        return {
          ...criteriaItem,
          modules: criteriaItem.modules.map((moduleItem) =>
            moduleItem.id === moduleId
              ? { ...moduleItem, tasks: [...moduleItem.tasks, createTask()] }
              : moduleItem,
          ),
        };
      }),
    }));
  };

  const updateTask = (
    criteriaId: string,
    moduleId: string,
    taskId: string,
    updates: Partial<Task>,
  ) => {
    updateDraft((prev) => ({
      ...prev,
      criteria: prev.criteria.map((criteriaItem) => {
        if (criteriaItem.id !== criteriaId) return criteriaItem;

        return {
          ...criteriaItem,
          modules: criteriaItem.modules.map((moduleItem) => {
            if (moduleItem.id !== moduleId) return moduleItem;

            return {
              ...moduleItem,
              tasks: moduleItem.tasks.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      ...updates,
                      marks:
                        updates.marks !== undefined
                          ? Math.max(0, Number(updates.marks) || 0)
                          : task.marks,
                    }
                  : task,
              ),
            };
          }),
        };
      }),
    }));
  };

  const deleteTask = (criteriaId: string, moduleId: string, taskId: string) => {
    setConfirmDialog({
      title: "Delete task?",
      description: "This will permanently remove this task.",
      confirmText: "Delete",
      onConfirm: () => {
        updateDraft((prev) => ({
          ...prev,
          criteria: prev.criteria.map((criteriaItem) => {
            if (criteriaItem.id !== criteriaId) return criteriaItem;

            return {
              ...criteriaItem,
              modules: criteriaItem.modules.map((moduleItem) => {
                if (moduleItem.id !== moduleId) return moduleItem;

                return {
                  ...moduleItem,
                  tasks: moduleItem.tasks.filter((task) => task.id !== taskId),
                };
              }),
            };
          }),
        }));
        setConfirmDialog(null);
      },
    });
  };

  const validateDraft = () => {
    if (!draft.formTitle.trim()) {
      toast({
        title: "Validation Error",
        description: "Form title is required.",
        variant: "destructive",
      });
      return false;
    }

    if (draft.applicableRoles.length === 0) {
      toast({
        title: "Validation Error",
        description: "Select at least one applicable role.",
        variant: "destructive",
      });
      return false;
    }

    if (draft.criteria.length === 0) {
      toast({
        title: "Validation Error",
        description: "Add at least one criteria.",
        variant: "destructive",
      });
      return false;
    }

    const hasNoModules = draft.criteria.some(
      (criteriaItem) => criteriaItem.modules.length === 0,
    );
    if (hasNoModules) {
      toast({
        title: "Validation Error",
        description: "Each criteria must have at least one module.",
        variant: "destructive",
      });
      return false;
    }

    const hasNoTasks = draft.criteria.some((criteriaItem) =>
      criteriaItem.modules.some((moduleItem) => moduleItem.tasks.length === 0),
    );
    if (hasNoTasks) {
      toast({
        title: "Validation Error",
        description: "Each module must have at least one task.",
        variant: "destructive",
      });
      return false;
    }

    const hasInvalidTaskMarks = draft.criteria.some((criteriaItem) =>
      criteriaItem.modules.some((moduleItem) =>
        moduleItem.tasks.some(
          (task) =>
            task.marks === undefined ||
            Number.isNaN(task.marks) ||
            task.marks < 0,
        ),
      ),
    );

    if (hasInvalidTaskMarks) {
      toast({
        title: "Validation Error",
        description: "Task marks are required and must be 0 or positive.",
        variant: "destructive",
      });
      return false;
    }


    return true;
  };

  const saveForm = async () => {
    if (!validateDraft()) return;

    try {
      setIsSavingForm(true);

      const finalForm: FPMSForm = {
        ...recalculateForm(draft),
        id: editingFormId || "",
      };

      if (editingFormId) {
        await api.put(`/api/superadmin/forms/${editingFormId}`, finalForm);
      } else {
        await api.post("/api/superadmin/forms", finalForm);
      }

      clearStoredDraft();
      await fetchSavedForms(true);
      startNewForm();

      toast({
        title: "Form Saved",
        description: "Form saved successfully. Ready to create a new form.",
      });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error?.response?.data?.message || "Unable to save form.",
        variant: "destructive",
      });
    } finally {
      setIsSavingForm(false);
    }
  };

  const startNewForm = () => {
    clearStoredDraft();
    setEditingFormId(null);
    setDraft(createEmptyForm());
  };

  const loadForm = async (formId: string) => {
    try {
      const response = await api.get(`/api/superadmin/forms/${formId}`);
      const found = response.data?.data as FPMSForm | undefined;
      if (!found) return;

      isDirtyRef.current = false;
      setEditingFormId(found.id);
      setDraft(recalculateForm(found));
    } catch (error: any) {
      toast({
        title: "Load Failed",
        description:
          error?.response?.data?.message || "Unable to load selected form.",
        variant: "destructive",
      });
    }
  };

  const executeDeleteSavedForm = async (formId: string) => {
    try {
      setDeletingFormId(formId);
      await api.delete(`/api/superadmin/forms/${formId}`);
      await fetchSavedForms(true);

      if (editingFormId === formId) {
        startNewForm();
      }

      toast({ title: "Form Deleted", description: "Saved form removed." });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error?.response?.data?.message || "Unable to delete form.",
        variant: "destructive",
      });
    } finally {
      setDeletingFormId(null);
      setConfirmDialog(null);
    }
  };

  const requestDeleteSavedForm = (formId: string) => {
    setConfirmDialog({
      title: "Delete saved form?",
      description: "This will permanently delete this saved form.",
      confirmText: "Delete",
      onConfirm: () => {
        void executeDeleteSavedForm(formId);
      },
    });
  };

  const goToPreview = (formId?: string) => {
    const id = formId || editingFormId;
    if (!id) {
      toast({
        title: "Preview Unavailable",
        description: "Save the form first before previewing.",
        variant: "destructive",
      });
      return;
    }

    navigate(`/superadmin/form-builder/preview/${id}`);
  };

  const moduleCount = useMemo(
    () =>
      draft.criteria.reduce(
        (sum, criteriaItem) => sum + criteriaItem.modules.length,
        0,
      ),
    [draft.criteria],
  );

  const taskCount = useMemo(
    () =>
      draft.criteria.reduce(
        (sum, criteriaItem) =>
          sum +
          criteriaItem.modules.reduce(
            (inner, moduleItem) => inner + moduleItem.tasks.length,
            0,
          ),
        0,
      ),
    [draft.criteria],
  );

  // Only superadmin can access (case-insensitive)
  if (String(user?.role || "").toLowerCase() !== "superadmin") {
    return (
      <DashboardLayout title="Create Form" subtitle="Super admin access only">
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
      title="CreateFormScreen"
      subtitle="Build dynamic FPMS forms with criteria, modules, and tasks"
    >
      {isInitialLoading ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading form builder data...</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6 pb-12">
          {restorable && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>
                You have unsaved work
                {restorable.draft.formTitle ? <> on <strong>{restorable.draft.formTitle}</strong></> : null}
                {" "}from {new Date(restorable.savedAt).toLocaleString()}.
              </span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" onClick={restoreStoredDraft}>
                  Restore
                </Button>
                <Button size="sm" variant="outline" onClick={discardStoredDraft}>
                  Discard
                </Button>
              </div>
            </div>
          )}

          <FormSummary
            formTitle={draft.formTitle}
            roles={draft.applicableRoles}
            criteriaCount={draft.criteria.length}
            moduleCount={moduleCount}
            taskCount={taskCount}
            totalMarks={draft.totalMarks}
          />

          <Card>
            <CardHeader>
              <CardTitle>Form Details</CardTitle>
              <CardDescription>
                Define base details and applicable roles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                <div className="space-y-2">
                  <Label>Form Title *</Label>
                  <Input
                    value={draft.formTitle}
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        formTitle: e.target.value,
                      }))
                    }
                    placeholder="Enter form title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Form Order</Label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={draft.displayOrder || ""}
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        displayOrder: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      }))
                    }
                    placeholder="e.g. 1"
                  />
                  <p className="text-xs text-muted-foreground">Position in the sidebar and lists</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Applicable Roles *</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      <span>
                        {draft.applicableRoles.length
                          ? `${draft.applicableRoles.length} role(s) selected`
                          : "Select applicable roles"}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[280px]">
                    <DropdownMenuLabel>Roles</DropdownMenuLabel>
                    {roleNames.map((role) => (
                      <DropdownMenuCheckboxItem
                        key={role}
                        checked={draft.applicableRoles.includes(role)}
                        onCheckedChange={() => toggleRole(role)}
                      >
                        {role}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex flex-wrap gap-2 pt-1">
                  {draft.applicableRoles.map((role) => (
                    <Badge key={role} variant="secondary">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={addCriteria} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Criteria
                </Button>
                <Button variant="outline" onClick={startNewForm}>
                  New Form
                </Button>
                <Button
                  variant="outline"
                  onClick={() => goToPreview()}
                  className="gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Preview Current
                </Button>
                <Button
                  onClick={saveForm}
                  className="gap-2 bg-green-700 hover:bg-green-800"
                  disabled={isSavingForm}
                >
                  {isSavingForm ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSavingForm ? "Saving..." : "Save Form"}
                </Button>
                {lastAutoSaved && (
                  <span className="self-center text-xs text-muted-foreground">
                    Draft auto-saved in this browser at{" "}
                    {new Date(lastAutoSaved).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {draft.criteria.map((criteriaItem) => (
              <CriteriaForm
                key={criteriaItem.id}
                criteria={criteriaItem}
                onCriteriaChange={(updates) =>
                  updateCriteria(criteriaItem.id, updates)
                }
                onDeleteCriteria={() => deleteCriteria(criteriaItem.id)}
                onAddModule={() => addModule(criteriaItem.id)}
                onUpdateModule={(moduleId, updates) =>
                  updateModule(criteriaItem.id, moduleId, updates)
                }
                onDeleteModule={(moduleId) =>
                  deleteModule(criteriaItem.id, moduleId)
                }
                onAddTask={(moduleId) => addTask(criteriaItem.id, moduleId)}
                onUpdateTask={(moduleId, taskId, updates) =>
                  updateTask(criteriaItem.id, moduleId, taskId, updates)
                }
                onDeleteTask={(moduleId, taskId) =>
                  deleteTask(criteriaItem.id, moduleId, taskId)
                }
              />
            ))}

            {draft.criteria.length === 0 && (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No criteria yet. Click "Add Criteria" to start building the
                  form.
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <CardTitle>Saved Forms</CardTitle>
                  <CardDescription>
                    Load, preview, or delete existing forms
                  </CardDescription>
                </div>
                {!isHistory && years.length > 1 && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setImportOpen(true)}>
                    <Copy className="h-4 w-4" />
                    Import from previous year
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {savedForms.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No saved forms found.
                </p>
              )}

              {savedForms.map((form) => (
                <div key={form.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {form.displayOrder ? `${form.displayOrder}. ` : ""}
                        {form.formTitle || "Untitled Form"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Marks: {form.totalMarks} • Criteria:{" "}
                        {form.criteriaCount}
                      </p>
                    </div>
                    {editingFormId === form.id && <Badge>Editing</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadForm(form.id)}
                    >
                      Load
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => goToPreview(form.id)}
                    >
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => requestDeleteSavedForm(form.id)}
                      disabled={deletingFormId === form.id}
                    >
                      {deletingFormId === form.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <ImportFormsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => fetchSavedForms(true)}
      />

      <DeleteConfirmationDialog
        open={!!confirmDialog}
        onOpenChange={(open) => {
          if (!open && !deletingFormId) setConfirmDialog(null);
        }}
        title={confirmDialog?.title || "Confirm action"}
        description={
          confirmDialog?.description || "Are you sure you want to continue?"
        }
        confirmText={confirmDialog?.confirmText || "Confirm"}
        isLoading={!!deletingFormId}
        onConfirm={() => confirmDialog?.onConfirm()}
      />
    </DashboardLayout>
  );
}
