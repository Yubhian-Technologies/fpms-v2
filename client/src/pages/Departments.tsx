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
import { Plus, Pencil, Trash2, Building2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";

interface CollegeDetails {
  id?: string;
  name: string;
  code?: string;
  branches?: string[];
}

export default function Departments() {
  const [collegeDetails, setCollegeDetails] = useState<CollegeDetails | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingDepartment, setIsAddingDepartment] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<string | null>(
    null,
  );
  const [departmentToDelete, setDepartmentToDelete] = useState<string | null>(
    null,
  );
  const [formDepartmentName, setFormDepartmentName] = useState("");

  const collegeName = String(collegeDetails?.name || "").trim();
  const collegeCode = String(collegeDetails?.code || "").trim();
  const departments = useMemo(
    () =>
      Array.isArray(collegeDetails?.branches)
        ? collegeDetails!
            .branches!.map((item) => String(item || "").trim())
            .filter(Boolean)
        : [],
    [collegeDetails],
  );

  const filteredDepartments = departments.filter((department) =>
    department.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const fetchCollegeDetails = async () => {
    try {
      const res = await api.get("/api/admin/college-details");
      const data = res.data?.data || null;
      setCollegeDetails(data);
    } catch {
      toast({
        title: "Failed to load college departments",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        await fetchCollegeDetails();
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const resetForm = () => {
    setFormDepartmentName("");
    setEditingDepartment(null);
  };

  const startAddDepartment = () => {
    resetForm();
    setIsAddingDepartment(true);
  };

  const cancelForm = () => {
    setIsAddingDepartment(false);
    resetForm();
  };

  const openEdit = (department: string) => {
    setFormDepartmentName(department);
    setEditingDepartment(department);
    setIsAddingDepartment(true);
  };

  const persistDepartments = async (nextDepartments: string[]) => {
    await api.put("/api/admin/college-branches", {
      branches: nextDepartments,
    });
  };

  const handleSave = async () => {
    const normalizedDepartmentName = String(formDepartmentName || "").trim();

    if (!normalizedDepartmentName) {
      toast({ title: "Department name is required", variant: "destructive" });
      return;
    }

    const normalizedDepartmentsMap = new Map(
      departments.map((item) => [item.toLowerCase(), item]),
    );
    const currentEditingKey = String(editingDepartment || "").toLowerCase();

    if (
      normalizedDepartmentsMap.has(normalizedDepartmentName.toLowerCase()) &&
      normalizedDepartmentName.toLowerCase() !== currentEditingKey
    ) {
      toast({
        title: "Department already exists",
        variant: "destructive",
      });
      return;
    }

    const nextDepartments = editingDepartment
      ? departments.map((item) =>
          item.toLowerCase() === currentEditingKey
            ? normalizedDepartmentName
            : item,
        )
      : [...departments, normalizedDepartmentName];

    setIsSaving(true);
    try {
      await persistDepartments(nextDepartments);
      toast({
        title: editingDepartment
          ? "Department updated successfully"
          : "Department added successfully",
      });
      await fetchCollegeDetails();
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

  const handleDelete = async (department: string) => {
    const nextDepartments = departments.filter((item) => item !== department);

    try {
      setIsDeleting(true);
      await persistDepartments(nextDepartments);
      toast({ title: "Department deleted" });
      await fetchCollegeDetails();
      setDepartmentToDelete(null);
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
      title="Departments"
      subtitle="Manage departments for your college"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Department Management</h1>
            <p className="text-muted-foreground">
              {collegeName
                ? `Manage departments for ${collegeName}${collegeCode ? ` (${collegeCode})` : ""}`
                : "Manage departments for your college"}
            </p>
          </div>
          {!isAddingDepartment && (
            <Button onClick={startAddDepartment}>
              <Plus className="mr-2 h-4 w-4" /> Add Department
            </Button>
          )}
        </div>

        {isAddingDepartment && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle>
                {editingDepartment ? "Edit Department" : "Add Department"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>College</Label>
                  <Input
                    value={
                      collegeName
                        ? `${collegeName}${collegeCode ? ` (${collegeCode})` : ""}`
                        : ""
                    }
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department Name *</Label>
                  <Input
                    placeholder="Enter department / branch"
                    value={formDepartmentName}
                    onChange={(e) => setFormDepartmentName(e.target.value)}
                  />
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
                  {isSaving ? "Saving..." : "Save Department"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6 flex gap-4">
              <Building2 className="h-5 w-5" />
              <div>
                <p>Total Departments</p>
                <p className="text-2xl font-bold">{departments.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex gap-4">
              <Building2 className="h-5 w-5" />
              <div>
                <p>Visible Results</p>
                <p className="text-2xl font-bold">
                  {filteredDepartments.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Input
          placeholder="Search department..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
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
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDepartments.map((department) => (
                    <TableRow key={department}>
                      <TableCell>{department}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(department)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setDepartmentToDelete(department)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredDepartments.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-center text-muted-foreground py-8"
                      >
                        No department data available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <DeleteConfirmationDialog
          open={!!departmentToDelete}
          onOpenChange={(open) => {
            if (!open && !isDeleting) setDepartmentToDelete(null);
          }}
          title="Delete department?"
          description={`This will permanently delete ${departmentToDelete || "this department"}.`}
          confirmText="Delete"
          isLoading={isDeleting}
          onConfirm={() => {
            if (departmentToDelete) handleDelete(departmentToDelete);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
