import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  AlertTriangle,
  Calendar,
  User,
  FileText,
  ChevronRight,
  Upload
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Appeal {
  id: string;
  category: string;
  subParameter: string;
  originalScore: number;
  requestedScore: number;
  status: "pending" | "approved" | "rejected" | "under_review";
  submittedDate: string;
  reason: string;
  response?: string;
  reviewer?: string;
  resolvedDate?: string;
}

const mockAppeals: Appeal[] = [
  {
    id: "1",
    category: "Research & Consultancy",
    subParameter: "Publications in Scopus Indexed Journals",
    originalScore: 15,
    requestedScore: 20,
    status: "under_review",
    submittedDate: "2024-01-10",
    reason: "The publication was indexed in Scopus after initial review. Attached updated evidence.",
    reviewer: "Dr. Priya Sharma",
  },
  {
    id: "2",
    category: "Professional Development",
    subParameter: "FDP Participation",
    originalScore: 5,
    requestedScore: 10,
    status: "approved",
    submittedDate: "2024-01-05",
    reason: "Attended two additional FDPs which were not reflected in the initial submission.",
    response: "Appeal approved. Additional FDP certificates verified and score updated.",
    reviewer: "Dr. Anil Verma",
    resolvedDate: "2024-01-12",
  },
  {
    id: "3",
    category: "Teaching & Learning",
    subParameter: "Course Feedback Score",
    originalScore: 18,
    requestedScore: 22,
    status: "rejected",
    submittedDate: "2023-12-28",
    reason: "The feedback score calculation seems incorrect based on the raw data.",
    response: "After review, the original score calculation was found to be accurate as per the prescribed methodology.",
    reviewer: "Dr. Priya Sharma",
    resolvedDate: "2024-01-08",
  },
];

const statusConfig = {
  pending: { label: "Pending", variant: "secondary" as const, icon: Clock, color: "text-muted-foreground" },
  under_review: { label: "Under Review", variant: "warning" as const, icon: AlertTriangle, color: "text-warning" },
  approved: { label: "Approved", variant: "success" as const, icon: CheckCircle2, color: "text-success" },
  rejected: { label: "Rejected", variant: "destructive" as const, icon: XCircle, color: "text-destructive" },
};

export default function DeanAppeals() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const stats = {
    total: mockAppeals.length,
    pending: mockAppeals.filter(a => a.status === "pending" || a.status === "under_review").length,
    approved: mockAppeals.filter(a => a.status === "approved").length,
    rejected: mockAppeals.filter(a => a.status === "rejected").length,
  };

  return (
    <DashboardLayout
      title="Appeals"
      subtitle="Submit and track appeals for score revisions"
      
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Appeals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                  <p className="text-sm text-muted-foreground">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
                  <XCircle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* New Appeal Button */}
        <div className="flex justify-end">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Submit New Appeal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Submit New Appeal</DialogTitle>
                <DialogDescription>
                  Request a score revision for a specific category. Provide clear justification and supporting evidence.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teaching">Teaching & Learning</SelectItem>
                      <SelectItem value="research">Research & Consultancy</SelectItem>
                      <SelectItem value="professional">Professional Development</SelectItem>
                      <SelectItem value="student">Student Development</SelectItem>
                      <SelectItem value="institutional">Institutional Development</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Sub-Parameter</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sub-parameter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feedback">Course Feedback Score</SelectItem>
                      <SelectItem value="results">Result Analysis</SelectItem>
                      <SelectItem value="innovation">Innovative Teaching</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Current Score</Label>
                    <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm">
                      15
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Requested Score</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="18">18</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="22">22</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Reason for Appeal</Label>
                  <Textarea 
                    placeholder="Provide detailed justification for your appeal request..."
                    className="min-h-[100px]"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Supporting Evidence</Label>
                  <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-6">
                    <div className="text-center">
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Drop files here or click to upload
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsDialogOpen(false)}>
                  Submit Appeal
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Appeals List */}
        <Card>
          <CardHeader>
            <CardTitle>Appeal History</CardTitle>
            <CardDescription>Track the status of your submitted appeals</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-4">
                <div className="space-y-4">
                  {mockAppeals.map((appeal, index) => {
                    const StatusIcon = statusConfig[appeal.status].icon;
                    return (
                      <div
                        key={appeal.id}
                        className="rounded-lg border p-4 transition-all hover:bg-muted/30"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                              <Badge  className="gap-1">
                                <StatusIcon className="h-3 w-3" />
                                {statusConfig[appeal.status].label}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {appeal.category}
                              </span>
                            </div>
                            <h4 className="font-medium">{appeal.subParameter}</h4>
                            <p className="text-sm text-muted-foreground">{appeal.reason}</p>
                            
                            <div className="flex flex-wrap items-center gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Score:</span>
                                <span className="font-medium">{appeal.originalScore}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-medium text-primary">{appeal.requestedScore}</span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                {appeal.submittedDate}
                              </div>
                              {appeal.reviewer && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <User className="h-4 w-4" />
                                  {appeal.reviewer}
                                </div>
                              )}
                            </div>

                            {appeal.response && (
                              <div className="mt-3 rounded-lg bg-muted/50 p-3">
                                <p className="text-xs font-medium text-muted-foreground">Committee Response:</p>
                                <p className="mt-1 text-sm">{appeal.response}</p>
                              </div>
                            )}
                          </div>
                          <Button variant="ghost" size="icon">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
              <TabsContent value="pending" className="mt-4">
                <div className="space-y-4">
                  {mockAppeals
                    .filter(a => a.status === "pending" || a.status === "under_review")
                    .map((appeal) => {
                      const StatusIcon = statusConfig[appeal.status].icon;
                      return (
                        <div key={appeal.id} className="rounded-lg border p-4">
                          <div className="flex items-center gap-3">
                            <Badge  className="gap-1">
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig[appeal.status].label}
                            </Badge>
                            <span className="font-medium">{appeal.subParameter}</span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{appeal.reason}</p>
                        </div>
                      );
                    })}
                </div>
              </TabsContent>
              <TabsContent value="resolved" className="mt-4">
                <div className="space-y-4">
                  {mockAppeals
                    .filter(a => a.status === "approved" || a.status === "rejected")
                    .map((appeal) => {
                      const StatusIcon = statusConfig[appeal.status].icon;
                      return (
                        <div key={appeal.id} className="rounded-lg border p-4">
                          <div className="flex items-center gap-3">
                            <Badge  className="gap-1">
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig[appeal.status].label}
                            </Badge>
                            <span className="font-medium">{appeal.subParameter}</span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{appeal.reason}</p>
                          {appeal.response && (
                            <div className="mt-3 rounded-lg bg-muted/50 p-3">
                              <p className="text-xs font-medium">Response:</p>
                              <p className="mt-1 text-sm">{appeal.response}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}