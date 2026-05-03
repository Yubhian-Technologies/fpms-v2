import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  Briefcase,
  Loader2,
  GraduationCap,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";

interface Designation {
  name: string;
  target: string;
  phd: boolean;
}

interface DesignationPayload {
  college: string;
  designations: Designation[];
}

export default function Designations() {
  const [collegeName, setCollegeName] = useState("");
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingDesignation, setIsAddingDesignation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingDesignation, setEditingDesignation] =
    useState<Designation | null>(null);
  const [designationToDelete, setDesignationToDelete] =
    useState<Designation | null>(null);
  const [formDesignationName, setFormDesignationName] = useState("");
  const [formDesignationTarget, setFormDesignationTarget] = useState("");
  const [formDesignationPhd, setFormDesignationPhd] = useState(false);

  const filteredDesignations = useMemo(
    () =>
      designations.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [designations, searchQuery],
  );

  const fetchDesignations = async () => {
    try {
      const res = await api.get("/api/admin/designations");
      const data: DesignationPayload = res.data?.data || {
        college: "",
        designations: [],
      };

      setCollegeName(String(data.college || "").trim());
      setDesignations(
        Array.isArray(data.designations)
          ? data.designations.map((d) => ({
              name: String(d.name || "").trim(),
              target: String(d.target || "").trim(),
              phd: Boolean(d.phd),
            }))
          : [],
      );
    } catch {
      toast({ title: "Failed to load designations", variant: "destructive" });
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        await fetchDesignations();
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const resetForm = () => {
    setFormDesignationName("");
    setFormDesignationTarget("");
    setFormDesignationPhd(false);
    setEditingDesignation(null);
  };

  const startAddDesignation = () => {
    resetForm();
    setIsAddingDesignation(true);
  };

  const cancelForm = () => {
    setIsAddingDesignation(false);
    resetForm();
  };

  const openEdit = (designation: Designation) => {
    setFormDesignationName(designation.name);
    setFormDesignationTarget(designation.target);
    setFormDesignationPhd(Boolean(designation.phd));
    setEditingDesignation(designation);
    setIsAddingDesignation(true);
  };

  const persistDesignations = async (nextDesignations: Designation[]) => {
    await api.put("/api/admin/designations", {
      designations: nextDesignations,
    });
  };

  const handleSave = async () => {
    const normalizedName = String(formDesignationName || "").trim();
    const normalizedTarget = String(formDesignationTarget || "").trim();

    if (!normalizedName) {
      toast({ title: "Designation name is required", variant: "destructive" });
      return;
    }

    // Unique key is name + phd combo
    const isDuplicate = designations.some((d) => {
      const sameKey =
        d.name.toLowerCase() === normalizedName.toLowerCase() &&
        Boolean(d.phd) === formDesignationPhd;
      if (!editingDesignation) return sameKey;
      // When editing, exclude the current entry
      const isCurrentEntry =
        d.name.toLowerCase() === editingDesignation.name.toLowerCase() &&
        Boolean(d.phd) === Boolean(editingDesignation.phd);
      return sameKey && !isCurrentEntry;
    });

    if (isDuplicate) {
      toast({
        title: "Designation already exists",
        description: `A "${normalizedName}" entry ${formDesignationPhd ? "with PhD" : "without PhD"} already exists.`,
        variant: "destructive",
      });
      return;
    }

    const nextDesignations = editingDesignation
      ? designations.map((d) =>
          d.name.toLowerCase() === editingDesignation.name.toLowerCase() &&
          Boolean(d.phd) === Boolean(editingDesignation.phd)
            ? {
                name: normalizedName,
                target: normalizedTarget,
                phd: formDesignationPhd,
              }
            : d,
        )
      : [
          ...designations,
          {
            name: normalizedName,
            target: normalizedTarget,
            phd: formDesignationPhd,
          },
        ];

    setIsSaving(true);
    try {
      await persistDesignations(nextDesignations);
      toast({
        title: editingDesignation
          ? "Designation updated successfully"
          : "Designation added successfully",
      });
      await fetchDesignations();
      cancelForm();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Server error",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (designation: Designation) => {
    const nextDesignations = designations.filter(
      (d) =>
        !(
          d.name === designation.name &&
          Boolean(d.phd) === Boolean(designation.phd)
        ),
    );
    try {
      setIsDeleting(true);
      await persistDesignations(nextDesignations);
      toast({ title: "Designation deleted" });
      await fetchDesignations();
      setDesignationToDelete(null);
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.response?.data?.message || "Server error",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout
      title="Designations"
      subtitle="Manage faculty designations for your college"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Designation Management</h1>
            <p className="text-muted-foreground">
              {collegeName
                ? `Manage faculty designations for ${collegeName}`
                : "Manage faculty designations for your college"}
            </p>
          </div>
          {!isAddingDesignation && (
            <Button onClick={startAddDesignation}>
              <Plus className="mr-2 h-4 w-4" /> Add Designation
            </Button>
          )}
        </div>

        {isAddingDesignation && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle>
                {editingDesignation ? "Edit Designation" : "Add Designation"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>College</Label>
                  <Input value={collegeName} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Designation Name *</Label>
                  <Input
                    placeholder="Enter designation"
                    value={formDesignationName}
                    onChange={(e) => setFormDesignationName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Score</Label>
                  <Input
                    placeholder="Enter target score"
                    value={formDesignationTarget}
                    onChange={(e) => setFormDesignationTarget(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    PhD Holder
                  </Label>
                  <div className="flex items-center gap-3 pt-2">
                    <Switch
                      id="phd-toggle"
                      checked={formDesignationPhd}
                      onCheckedChange={(checked) =>
                        setFormDesignationPhd(checked)
                      }
                    />
                    <Label
                      htmlFor="phd-toggle"
                      className="cursor-pointer font-normal"
                    >
                      {formDesignationPhd ? "Yes – PhD" : "No PhD"}
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={cancelForm}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {isSaving ? "Saving..." : "Save Designation"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6 flex gap-4">
              <Briefcase className="h-5 w-5" />
              <div>
                <p>Total Designations</p>
                <p className="text-2xl font-bold">{designations.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex gap-4">
              <Briefcase className="h-5 w-5" />
              <div>
                <p>Visible Results</p>
                <p className="text-2xl font-bold">
                  {filteredDesignations.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Input
          placeholder="Search designation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <Card>
          <CardHeader>
            <CardTitle>Designations</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Designation</TableHead>
                    <TableHead>PhD</TableHead>
                    <TableHead>Target Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDesignations.map((d) => (
                    <TableRow key={`${d.name}-${d.phd}`}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>
                        {d.phd ? (
                          <Badge variant="default" className="gap-1">
                            <GraduationCap className="h-3 w-3" />
                            PhD
                          </Badge>
                        ) : (
                          <Badge variant="outline">No PhD</Badge>
                        )}
                      </TableCell>
                      <TableCell>{d.target || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(d)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setDesignationToDelete(d)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredDesignations.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-8"
                      >
                        No designation data available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <DeleteConfirmationDialog
          open={!!designationToDelete}
          onOpenChange={(open) => {
            if (!open && !isDeleting) setDesignationToDelete(null);
          }}
          title="Delete designation?"
          description={`This will permanently delete ${designationToDelete?.name || "this designation"}.`}
          confirmText="Delete"
          isLoading={isDeleting}
          onConfirm={() => {
            if (designationToDelete) handleDelete(designationToDelete);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
