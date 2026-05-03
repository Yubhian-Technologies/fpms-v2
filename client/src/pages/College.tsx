import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";

interface College {
  id: string;
  name: string;
  location: string;
  code: string;
  isActive: boolean;
  deadline?: string;
}

export default function College() {
  const { toast } = useToast();

  const [colleges, setColleges] = useState<College[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAddingCollegeLoading, setIsAddingCollegeLoading] = useState(false);
  const [isSavingCollegeEditLoading, setIsSavingCollegeEditLoading] =
    useState(false);
  const [deletingCollegeId, setDeletingCollegeId] = useState<string | null>(
    null,
  );
  const [togglingCollegeId, setTogglingCollegeId] = useState<string | null>(
    null,
  );
  const [collegeToDelete, setCollegeToDelete] = useState<College | null>(null);

  const [isAddingCollege, setIsAddingCollege] = useState(false);
  const [editingCollege, setEditingCollege] = useState<string | null>(null);

  const [newCollege, setNewCollege] = useState<Partial<College>>({
    name: "",
    location: "",
    code: "",
    isActive: true,
    deadline: "",
  });

  const [editForm, setEditForm] = useState<Partial<College>>({});

  const fetchColleges = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const response = await api.get("/api/committee/colleges");
      const list = response.data?.data ?? [];
      setColleges(
        list.map((item: any) => ({
          id: item.id,
          name: item.name,
          location: item.location,
          code: item.code,
          isActive: Boolean(item.isActive),
          deadline: item.deadline || null,
        })),
      );
    } catch (error: any) {
      if (!silent) {
        toast({
          title: "Load Failed",
          description:
            error?.response?.data?.message || "Unable to load colleges.",
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsInitialLoading(true);
        await fetchColleges();
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadInitialData();

    const interval = window.setInterval(() => {
      fetchColleges(true);
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const handleAddCollege = async () => {
    if (!newCollege.name || !newCollege.location || !newCollege.code) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAddingCollegeLoading(true);
      await api.post("/api/committee/colleges", {
        name: newCollege.name,
        location: newCollege.location,
        code: newCollege.code,
        isActive: newCollege.isActive ?? true,
        deadline: newCollege.deadline || null,
      });

      await fetchColleges(true);
      setIsAddingCollege(false);
      setNewCollege({
        name: "",
        location: "",
        code: "",
        isActive: true,
      });

      toast({
        title: "College Added",
        description: "College has been successfully added.",
      });
    } catch (error: any) {
      toast({
        title: "Add Failed",
        description: error?.response?.data?.message || "Unable to add college.",
        variant: "destructive",
      });
    } finally {
      setIsAddingCollegeLoading(false);
    }
  };

  const startEdit = (college: College) => {
    setEditingCollege(college.id);
    setEditForm(college);
  };

  const cancelEdit = () => {
    setEditingCollege(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editForm.name || !editForm.location || !editForm.code) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSavingCollegeEditLoading(true);
      await api.put(`/api/committee/colleges/${editingCollege}`, {
        name: editForm.name,
        location: editForm.location,
        code: editForm.code,
        deadline: editForm.deadline || null,
      });

      await fetchColleges(true);
      setEditingCollege(null);
      setEditForm({});

      toast({
        title: "College Updated",
        description: "College information has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description:
          error?.response?.data?.message || "Unable to update college.",
        variant: "destructive",
      });
    } finally {
      setIsSavingCollegeEditLoading(false);
    }
  };

  const handleDeleteCollege = async (collegeId: string) => {
    try {
      setDeletingCollegeId(collegeId);
      await api.delete(`/api/committee/colleges/${collegeId}`);
      await fetchColleges(true);
      setCollegeToDelete(null);
      toast({
        title: "College Deleted",
        description: "The college has been removed from the system.",
      });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description:
          error?.response?.data?.message || "Unable to delete college.",
        variant: "destructive",
      });
    } finally {
      setDeletingCollegeId(null);
    }
  };

  const toggleStatus = async (collegeId: string) => {
    const target = colleges.find((college) => college.id === collegeId);
    if (!target) return;

    try {
      setTogglingCollegeId(collegeId);
      await api.put(`/api/committee/colleges/${collegeId}`, {
        isActive: !target.isActive,
      });
      await fetchColleges(true);
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description:
          error?.response?.data?.message || "Unable to update college status.",
        variant: "destructive",
      });
    } finally {
      setTogglingCollegeId(null);
    }
  };

  const handleSaveAll = async () => {
    try {
      setIsSyncing(true);
      await fetchColleges(true);
      toast({
        title: "Synced",
        description: "College data is synced with server.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <DashboardLayout title="Manage Colleges" subtitle="Manage colleges">
      {isInitialLoading ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading colleges...</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6 pb-16">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Total Colleges
                  </p>
                  <p className="text-4xl font-bold mt-2">{colleges.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50/50 border-green-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Active Colleges
                  </p>
                  <p className="text-4xl font-bold mt-2 text-green-600">
                    {colleges.filter((college) => college.isActive).length}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50/50 border-orange-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Inactive Colleges
                  </p>
                  <p className="text-4xl font-bold mt-2 text-orange-600">
                    {colleges.filter((college) => !college.isActive).length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <p className="text-muted-foreground">
                {colleges.length} college{colleges.length !== 1 ? "s" : ""}{" "}
                configured
              </p>
              {isLoading && (
                <p className="text-xs text-muted-foreground mt-1">
                  Syncing data...
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setIsAddingCollege(!isAddingCollege)}
                variant={isAddingCollege ? "outline" : "default"}
                className="gap-2"
                disabled={
                  isAddingCollegeLoading ||
                  isSyncing ||
                  isSavingCollegeEditLoading ||
                  deletingCollegeId !== null
                }
              >
                {isAddingCollege ? (
                  "Cancel"
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Add New College
                  </>
                )}
              </Button>

              <Button
                onClick={handleSaveAll}
                className="gap-2 bg-green-700 hover:bg-green-800"
                disabled={
                  isSyncing ||
                  isAddingCollegeLoading ||
                  isSavingCollegeEditLoading ||
                  deletingCollegeId !== null
                }
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSyncing ? "Syncing..." : "Save All Changes"}
              </Button>
            </div>
          </div>

          {isAddingCollege && (
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle>Add New College</CardTitle>
                <CardDescription>Add a college to the society</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>College Name *</Label>
                    <Input
                      placeholder="e.g., St. Joseph's College..."
                      value={newCollege.name}
                      onChange={(event) =>
                        setNewCollege({
                          ...newCollege,
                          name: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location *</Label>
                    <Input
                      placeholder="e.g., Chennai, Bangalore..."
                      value={newCollege.location}
                      onChange={(event) =>
                        setNewCollege({
                          ...newCollege,
                          location: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>College Code *</Label>
                    <Input
                      placeholder="e.g., SJCE, SJIT..."
                      value={newCollege.code}
                      onChange={(event) =>
                        setNewCollege({
                          ...newCollege,
                          code: event.target.value.toUpperCase(),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
  <Label>Deadline</Label>
  <Input
    type="date"
    value={newCollege.deadline?.split("T")[0] || ""} // show only YYYY-MM-DD
    onChange={(event) =>
      setNewCollege({ ...newCollege, deadline: event.target.value })
    }
  />
</div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddingCollege(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddCollege} className="gap-2">
                    {isAddingCollegeLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {isAddingCollegeLoading ? "Adding..." : "Add College"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Existing Colleges</CardTitle>
              <CardDescription>
                View and manage colleges in the society
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>College Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colleges.map((college) => (
                    <TableRow key={college.id}>
                      <TableCell className="font-medium">
                        {editingCollege === college.id ? (
                          <Input
                            value={editForm.name}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                name: event.target.value,
                              })
                            }
                          />
                        ) : (
                          college.name
                        )}
                      </TableCell>
                      <TableCell>
                        {editingCollege === college.id ? (
                          <Input
                            value={editForm.location}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                location: event.target.value,
                              })
                            }
                          />
                        ) : (
                          college.location
                        )}
                      </TableCell>
                      <TableCell>
                        {editingCollege === college.id ? (
                          <Input
                            value={editForm.code}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                code: event.target.value.toUpperCase(),
                              })
                            }
                            className="w-24"
                          />
                        ) : (
                          <Badge variant="outline">{college.code}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={college.isActive ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() =>
                            editingCollege !== college.id &&
                            toggleStatus(college.id)
                          }
                        >
                          {togglingCollegeId === college.id
                            ? "Updating..."
                            : college.isActive
                              ? "Active"
                              : "Inactive"}
                        </Badge>
                      </TableCell>
                     <TableCell>
  {editingCollege === college.id ? (
    <Input
      type="date"
      value={editForm.deadline?.split("T")[0] || ""}
      onChange={(event) =>
        setEditForm({ ...editForm, deadline: event.target.value })
      }
    />
  ) : college.deadline ? (
    new Date(college.deadline).toLocaleDateString()
  ) : (
    "-"
  )}
</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {editingCollege === college.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={saveEdit}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                disabled={isSavingCollegeEditLoading}
                              >
                                {isSavingCollegeEditLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEdit}
                                disabled={isSavingCollegeEditLoading}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEdit(college)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCollegeToDelete(college)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                disabled={deletingCollegeId === college.id}
                              >
                                {deletingCollegeId === college.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {colleges.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No colleges configured yet. Click "Add New College" to create
                  one.
                </div>
              )}
            </CardContent>
          </Card>

          <DeleteConfirmationDialog
            open={!!collegeToDelete}
            onOpenChange={(open) => {
              if (!open && !deletingCollegeId) setCollegeToDelete(null);
            }}
            title="Delete college?"
            description={`This will permanently delete ${collegeToDelete?.name || "this college"}.`}
            confirmText="Delete"
            isLoading={!!deletingCollegeId}
            onConfirm={() => {
              if (collegeToDelete) handleDeleteCollege(collegeToDelete.id);
            }}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
