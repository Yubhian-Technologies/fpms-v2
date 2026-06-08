import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FPMSProvider } from "@/contexts/FPMSContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

import Review from "./pages/Review";
import Reports from "./pages/Reports";
import Faculty from "./pages/Faculty";
import Designations from "./pages/Designations";
import Departments from "./pages/Departments";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";
import TeachingLearning from "./pages/fpms/TeachingLearning";
import DynamicCriteriaForm from "./pages/fpms/DynamicCriteriaForm";
import ResearchDevelopment from "./pages/fpms/ResearchDevelopment";
import ProfessionalDevelopment from "./pages/fpms/ProfessionalDevelopment";
import StudentDevelopment from "./pages/fpms/StudentDevelopment";
import InstitutionalDevelopment from "./pages/fpms/InstitutionalDevelopment";
import Submissions from "./pages/Submissions";
import AppealReview from "./pages/AppealReview";
import College from "./pages/College";
import AddAdmin from "./pages/AddAdmin";
import AddSuperAdmin from "./pages/AddSuperAdmin";
import AddVicePrincipal from "./pages/AddVicePrincipal";
import TeachingandLearning from "./pages/hod-forms/TeachingandLearning";
import AdminReview from "./pages/AdminReview";
import AcademicLeadershipCurriculumGovernance from "./pages/hodb-forms/AcademicLeadershipCurriculumGovernance";
import AppealHod from "./pages/AppealHod";
import CommitteeReview from "./pages/CommitteeReview";
import AddDean from "./pages/AddDean";
import AddHod from "./pages/AddHod";
import AddInternalCommittee from "./pages/AddInternalCommittee";
import DeanTeachingLearning from "./pages/dean-forms/DeanTeachingLearning";
import DeanBTeachingLearning from "./pages/deanb-forms/DeanBTeachingLearning";
import DeanAppeals from "./pages/DeanAppeal";
import SuperAdminCriteriaManagement from "./pages/superadmin";
import RoleManagement from "./pages/RoleManagement";
import ManageColleges from "./pages/ManageColleges";
import CreateFormScreen from "./pages/CreateFormScreen";
import FormPreviewScreen from "./pages/FormPreviewScreen";
import WorkflowRules from "./pages/WorkflowRules";
import MyAppeals from "./pages/MyAppeals";
import AddViewer from "./pages/AddViewer";
import ChangePassword from "./pages/ChangePassword";
import CommitteeMember from "./pages/CommitteeMember";
import CollegeDeadlines from "./pages/CollegeDeadlines";

const queryClient = new QueryClient();

const normalizeRoleForAccess = (role?: string) => {
  const value = String(role || "")
    .trim()
    .toLowerCase();

  if (value.includes("dean")) return "dean";
  if (value === "principal" || value === "principle" || value === "admin" || value === "director") {
    return "principal";
  }
  if (value === "internal committee" || value === "internal commitee") {
    return "internal committee";
  }
  if (
    value === "vice principal" ||
    value === "vice principle" ||
    value === "vice-principal" ||
    value === "viceprincipal"
  ) {
    return "vice principal";
  }

  return value;
};

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user) {
    const normalized = normalizeRoleForAccess(user.role);
    // A user with internalCommittee flag also qualifies for "internal committee" routes
    const effectiveRoles = user.internalCommittee
      ? [normalized, "internal committee"]
      : [normalized];
    if (!allowedRoles.some((r) => effectiveRoles.includes(r))) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/register-superadmin" element={<AddSuperAdmin />} />
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/review"
        element={
          <ProtectedRoute
            allowedRoles={[
              "hod",
              "internal committee",
              "dean",
              "vice principal",
              "principal",
            ]}
          >
            <Review />
          </ProtectedRoute>
        }
      />
      <Route
        path="/appeal-review"
        element={
          <ProtectedRoute
            allowedRoles={[
              "dean",
              "vice principal",
              "principal",
              "internal committee",
            ]}
          >
            <AppealReview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={["hod", "committee", "principal"]}>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty"
        element={
          <ProtectedRoute allowedRoles={["hod"]}>
            <Faculty />
          </ProtectedRoute>
        }
      />
      <Route
        path="/designations"
        element={
          <ProtectedRoute allowedRoles={["principal"]}>
            <Designations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/departments"
        element={
          <ProtectedRoute allowedRoles={["committee", "principal"]}>
            <Departments />
          </ProtectedRoute>
        }
      />
      <Route path="/fpms/teaching" element={<TeachingLearning />} />
      <Route
        path="/fpms/research"
        element={<ResearchDevelopment></ResearchDevelopment>}
      />
      <Route path="/fpms/professional" element={<ProfessionalDevelopment />} />
      <Route path="/fpms/student" element={<StudentDevelopment />} />
      <Route
        path="/fpms/institutional"
        element={<InstitutionalDevelopment />}
      />
      <Route
        path="/fpms/forms/:formId/criteria/:criteriaId"
        element={
          <ProtectedRoute>
            <DynamicCriteriaForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fpms/dean-teaching"
        element={<DeanTeachingLearning></DeanTeachingLearning>}
      ></Route>
      <Route
        path="/fpms/deanb-teaching"
        element={<DeanBTeachingLearning></DeanBTeachingLearning>}
      ></Route>
      <Route path="/dean-appeals" element={<DeanAppeals></DeanAppeals>}></Route>
      <Route path="*" element={<NotFound />} />
      <Route path="/submissions" element={<Submissions></Submissions>}></Route>
      <Route path="/college" element={<College></College>}></Route>
      <Route path="/add" element={<AddAdmin></AddAdmin>}></Route>
      <Route
        path="/add-vice-principal"
        element={<AddVicePrincipal></AddVicePrincipal>}
      ></Route>
      <Route path="/settings" element={<Settings></Settings>}></Route>
      <Route
        path="/workflow-rules"
        element={
          <ProtectedRoute allowedRoles={["principal", "vice principal"]}>
            <WorkflowRules />
          </ProtectedRoute>
        }
      ></Route>
      <Route
        path="/college-deadlines"
        element={
          <ProtectedRoute allowedRoles={["principal"]}>
            <CollegeDeadlines />
          </ProtectedRoute>
        }
      ></Route>
      <Route path="/hod-review" element={<AdminReview></AdminReview>}></Route>
      <Route
        path="/fpms/hod-teaching"
        element={<TeachingandLearning></TeachingandLearning>}
      ></Route>
      <Route path="/hod-appeals" element={<AppealHod></AppealHod>}></Route>
      <Route
        path="/committee-review"
        element={<CommitteeReview></CommitteeReview>}
      ></Route>
      <Route path="/add-dean" element={<AddDean></AddDean>}></Route>
      <Route
        path="/add-viewer"
        element={
          <ProtectedRoute allowedRoles={["committee"]}>
            <AddViewer />
          </ProtectedRoute>
        }
      ></Route>
      <Route path="/add-hod" element={<AddHod></AddHod>}></Route>
      <Route
        path="/add-internal-committee"
        element={
          <ProtectedRoute allowedRoles={["principal"]}>
            <AddInternalCommittee />
          </ProtectedRoute>
        }
      ></Route>
      <Route
        path="/fpms/hodb-teaching"
        element={
          <AcademicLeadershipCurriculumGovernance></AcademicLeadershipCurriculumGovernance>
        }
      ></Route>
      <Route
        path="/superadmin"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <SuperAdminCriteriaManagement />
          </ProtectedRoute>
        }
      />
      <Route path="/my-appeals" element={<MyAppeals></MyAppeals>}></Route>
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/roles"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <RoleManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/colleges"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <ManageColleges />
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/committee-member"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <CommitteeMember />
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/form-builder"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <CreateFormScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/superadmin/form-builder/preview/:formId"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <FormPreviewScreen />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <FPMSProvider>
            <AppRoutes />
          </FPMSProvider>
        </AuthProvider>
      </BrowserRouter>
      <SpeedInsights />
      <Analytics />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
