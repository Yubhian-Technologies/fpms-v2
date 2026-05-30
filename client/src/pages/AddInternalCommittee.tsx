import { useEffect, useMemo, useState } from "react";
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
import { Loader2, Plus, Search, Trash2, UserCheck, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";

interface InternalCommitteeUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  level?: number;
  college?: string;
}

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

interface CollegeDetails {
  name: string;
  branches?: string[];
}

export default function AddInternalCommittee() {
  const [members, setMembers] = useState<InternalCommitteeUser[]>([]);
  const [collegeDetails, setCollegeDetails] = useState<CollegeDetails | null>(null);
  const [allFaculty, setAllFaculty] = useState<FacultyMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<InternalCommitteeUser | null>(null);

  const fetchMembers = async () => {
    const res = await api.get("/api/admin/internal-committees");
    setMembers(Array.isArray(res.data?.data) ? res.data.data : []);
  };

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [membersRes, collegeRes, facultyRes] = await Promise.all([
        api.get("/api/admin/internal-committees"),
        api.get("/api/admin/college-details"),
        api.get("/api/admin/college-faculty"),
      ]);
      setMembers(Array.isArray(membersRes.data?.data) ? membersRes.data.data : []);
      setCollegeDetails(collegeRes.data?.data || null);
      setAllFaculty(Array.isArray(facultyRes.data?.data) ? facultyRes.data.data : []);
    } catch {
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const assignedUids = useMemo(
    () => new Set(members.map((m) => m.id)),
    [members],
  );

  const allDepartments = useMemo(() => {
    const depts = new Set(allFaculty.map((f) => f.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [allFaculty]);

  const availableFaculty = useMemo(() => {
    let list = allFaculty.filter((f) => !assignedUids.has(f.uid || f.id));
    if (deptFilter && deptFilter !== "all") {
      list = list.filter((f) => f.department.toLowerCase() === deptFilter.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.email.toLowerCase().includes(q) ||
          (f.designation || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [allFaculty, assignedUids, deptFilter, searchQuery]);

  const filteredMembers = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.name, m.email, m.phone, m.college]
        .map((v) => String(v || "").toLowerCase())
        .join(" ")
        .includes(q),
    );
  }, [members, tableSearch]);

  const handleAssign = async () => {
    if (!selectedUserId) return;
    setIsAssigning(true);
    try {
      await api.post("/api/admin/internal-committee/assign", { userId: selectedUserId });
      toast({ title: "Internal committee member assigned" });
      setShowDialog(false);
      setSelectedUserId("");
      setSearchQuery("");
      setDeptFilter("all");
      await fetchMembers();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.response?.data?.message || "Failed to assign member",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await api.delete(`/api/admin/internal-committee/${id}`);
      setMemberToDelete(null);
      await fetchMembers();
      toast({ title: "Internal committee member removed" });
    } catch (err: any) {
      toast({
        title: "Remove failed",
        description: err?.response?.data?.message || "Server error",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout
      title="Internal Committee"
      subtitle="Assign an existing user as the internal committee member for your college"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Members</p>
              <p className="text-3xl font-bold mt-2">{members.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">College</p>
              <p className="text-sm font-medium mt-2">{collegeDetails?.name || "-"}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Input
            placeholder="Search by name, email, or college..."
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
          />
          <Button
            onClick={() => {
              setSearchQuery("");
              setDeptFilter("all");
              setSelectedUserId("");
              setShowDialog(true);
            }}
            className="gap-2 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Assign Member
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Internal Committee Members
            </CardTitle>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>College</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>{member.name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.phone || "-"}</TableCell>
                      <TableCell>{member.role || "internal committee"}</TableCell>
                      <TableCell>{member.level ?? "-"}</TableCell>
                      <TableCell>{member.college || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setMemberToDelete(member)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredMembers.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No internal committee members found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assign Member Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!isAssigning) setShowDialog(open); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Internal Committee Member
            </DialogTitle>
          </DialogHeader>

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
                {allDepartments.map((dept) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto border rounded-lg mt-1">
            {availableFaculty.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Users className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No users found</p>
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
                    const isSelected = selectedUserId === fid;
                    return (
                      <TableRow
                        key={fid}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedUserId(isSelected ? "" : fid)}
                      >
                        <TableCell>
                          <div
                            className={`h-4 w-4 rounded-full border-2 transition-colors ${
                              isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                            }`}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{faculty.name}</p>
                            <p className="text-xs text-muted-foreground">{faculty.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{faculty.department || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {faculty.designation || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {faculty.role || "faculty"}
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
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isAssigning}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!selectedUserId || isAssigning}>
              {isAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Assign Member
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={!!memberToDelete}
        onOpenChange={(open) => { if (!open && !isDeleting) setMemberToDelete(null); }}
        title="Remove internal committee member?"
        description={`This will remove ${memberToDelete?.name || "this user"} from the internal committee. Their account will not be deleted.`}
        confirmText="Remove"
        isLoading={isDeleting}
        onConfirm={() => { if (memberToDelete) handleDelete(memberToDelete.id); }}
      />
    </DashboardLayout>
  );
}
