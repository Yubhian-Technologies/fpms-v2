import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Loader2,
  Users,
  Building2,
  Search,
  UserCheck,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";

interface FacultyMember {
  id: string;
  uid: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  role: string;
  college: string;
}

interface ReviewerAssignment {
  id: string;
  department: string;
  reviewerUid: string;
  reviewerName: string;
  reviewerEmail: string;
  reviewerDepartment: string;
  college: string;
  isActive: boolean;
}

interface CollegeDetails {
  name: string;
  code?: string;
  branches?: string[];
}

export default function AddReviewer() {
  const [collegeDetails, setCollegeDetails] = useState<CollegeDetails | null>(null);
  const [allFaculty, setAllFaculty] = useState<FacultyMember[]>([]);
  const [reviewerAssignments, setReviewerAssignments] = useState<ReviewerAssignment[]>([]);

  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>("");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [collegeRes, facultyRes, reviewersRes] = await Promise.all([
        api.get("/api/admin/college-details"),
        api.get("/api/admin/college-faculty"),
        api.get("/api/admin/department-reviewers"),
      ]);

      const details = collegeRes.data?.data || null;
      setCollegeDetails(details);

      const branches = details?.branches || [];
      if (branches.length > 0 && !selectedDepartment) {
        setSelectedDepartment(branches[0]);
      }

      setAllFaculty(Array.isArray(facultyRes.data?.data) ? facultyRes.data.data : []);
      setReviewerAssignments(
        Array.isArray(reviewersRes.data?.data) ? reviewersRes.data.data : [],
      );
    } catch {
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const departments = useMemo(
    () => collegeDetails?.branches || [],
    [collegeDetails],
  );

  const assignedUidsForDept = useMemo(() => {
    return new Set(
      reviewerAssignments
        .filter((r) => r.department === selectedDepartment)
        .map((r) => r.reviewerUid),
    );
  }, [reviewerAssignments, selectedDepartment]);

  const currentReviewers = useMemo(() => {
    return reviewerAssignments.filter((r) => r.department === selectedDepartment);
  }, [reviewerAssignments, selectedDepartment]);

  const availableFaculty = useMemo(() => {
    let list = allFaculty.filter((f) => !assignedUidsForDept.has(f.uid || f.id));

    if (deptFilter && deptFilter !== "all") {
      list = list.filter(
        (f) => f.department.toLowerCase() === deptFilter.toLowerCase(),
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.email.toLowerCase().includes(q) ||
          f.designation.toLowerCase().includes(q),
      );
    }

    return list;
  }, [allFaculty, assignedUidsForDept, deptFilter, searchQuery]);

  const allDepartmentsInFaculty = useMemo(() => {
    const depts = new Set(allFaculty.map((f) => f.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [allFaculty]);

  const handleAssign = async () => {
    if (!selectedFacultyId || !selectedDepartment) return;

    setIsAssigning(true);
    try {
      await api.post("/api/admin/department-reviewers", {
        department: selectedDepartment,
        reviewerId: selectedFacultyId,
      });
      toast({ title: "Reviewer assigned", description: "Reviewer has been added successfully." });
      setShowAddDialog(false);
      setSelectedFacultyId("");
      setSearchQuery("");
      setDeptFilter("all");
      await fetchAll();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to assign reviewer";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    setRemovingId(assignmentId);
    try {
      await api.delete(`/api/admin/department-reviewers/${assignmentId}`);
      toast({ title: "Reviewer removed", description: "Reviewer has been removed." });
      setReviewerAssignments((prev) => prev.filter((r) => r.id !== assignmentId));
    } catch {
      toast({ title: "Error", description: "Failed to remove reviewer", variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const formatRole = (role: string) =>
    role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();

  if (isLoading) {
    return (
      <DashboardLayout title="Manage Reviewers">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Manage Reviewers">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Manage Reviewers</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Assign faculty members to review submissions for each department.
              A reviewer from any department can review another department's submissions.
            </p>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1">
            <Building2 className="h-3.5 w-3.5 mr-1" />
            {collegeDetails?.name || "College"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Department Selector Panel */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Departments
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {departments.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 pb-4">
                  No departments configured.
                </p>
              ) : (
                <ul className="space-y-0.5 pb-2">
                  {departments.map((dept) => {
                    const count = reviewerAssignments.filter(
                      (r) => r.department === dept,
                    ).length;
                    const isSelected = selectedDepartment === dept;
                    return (
                      <li key={dept}>
                        <button
                          onClick={() => setSelectedDepartment(dept)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors text-left ${
                            isSelected
                              ? "bg-primary text-primary-foreground font-medium"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          <span className="truncate">{dept}</span>
                          <span
                            className={`ml-2 text-xs font-medium rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${
                              isSelected
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : "bg-muted-foreground/15 text-muted-foreground"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Reviewer Management Panel */}
          <div className="lg:col-span-3 space-y-4">
            {!selectedDepartment ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Building2 className="h-10 w-10 mb-3 opacity-30" />
                  <p>Select a department to manage reviewers</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div>
                    <CardTitle className="text-lg">{selectedDepartment}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {currentReviewers.length} reviewer
                      {currentReviewers.length !== 1 ? "s" : ""} assigned
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setDeptFilter("all");
                      setSelectedFacultyId("");
                      setShowAddDialog(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Reviewer
                  </Button>
                </CardHeader>

                <CardContent>
                  {currentReviewers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                      <UserCheck className="h-10 w-10 mb-3 opacity-30" />
                      <p className="font-medium">No reviewers assigned</p>
                      <p className="text-sm mt-1">
                        Add a reviewer to this department to enable submission review.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="w-20 text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentReviewers.map((reviewer) => {
                          const isSameDept =
                            reviewer.reviewerDepartment.toLowerCase() ===
                            selectedDepartment.toLowerCase();
                          return (
                            <TableRow key={reviewer.id}>
                              <TableCell className="font-medium">
                                {reviewer.reviewerName}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {reviewer.reviewerEmail}
                              </TableCell>
                              <TableCell>
                                <span className="flex items-center gap-1.5">
                                  {reviewer.reviewerDepartment || "—"}
                                  {!isSameDept && reviewer.reviewerDepartment && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      Cross-dept
                                    </Badge>
                                  )}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {reviewer.reviewerDepartment
                                    ? formatRole(
                                        allFaculty.find(
                                          (f) => (f.uid || f.id) === reviewer.reviewerUid,
                                        )?.role || "faculty",
                                      )
                                    : "Faculty"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRemove(reviewer.id)}
                                  disabled={removingId === reviewer.id}
                                >
                                  {removingId === reviewer.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Add Reviewer Dialog */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          if (!isAssigning) setShowAddDialog(open);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Add Reviewer for {selectedDepartment}
            </DialogTitle>
          </DialogHeader>

          {/* Search & filter */}
          <div className="flex gap-3 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {allDepartmentsInFaculty.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Faculty list */}
          <div className="flex-1 overflow-y-auto border rounded-lg mt-1">
            {availableFaculty.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Users className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No faculty found</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableFaculty.map((faculty) => {
                    const fid = faculty.uid || faculty.id;
                    const isSelected = selectedFacultyId === fid;
                    const isCrossDept =
                      faculty.department.toLowerCase() !==
                      selectedDepartment.toLowerCase();
                    return (
                      <TableRow
                        key={fid}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/10 hover:bg-primary/15"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() =>
                          setSelectedFacultyId(isSelected ? "" : fid)
                        }
                      >
                        <TableCell>
                          <div
                            className={`h-4 w-4 rounded-full border-2 transition-colors ${
                              isSelected
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/40"
                            }`}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{faculty.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {faculty.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-sm">
                            {faculty.department || "—"}
                            {isCrossDept && faculty.department && (
                              <Badge variant="secondary" className="text-xs">
                                Cross-dept
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {faculty.designation || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {formatRole(faculty.role || "faculty")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              disabled={isAssigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedFacultyId || isAssigning}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Assign Reviewer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
