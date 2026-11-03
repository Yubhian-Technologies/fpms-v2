import { ReactNode } from "react";
import { History } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { Footer } from "./Footer";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  /** Shows the academic-year chip; its value now always follows the selected year */
  badge?: string;
}

export function DashboardLayout({
  children,
  title,
  subtitle,
}: DashboardLayoutProps) {
  const { years, selectedYear, setSelectedYear, isHistory, currentYear } = useAcademicYear();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      {/* Main content with proper sidebar offset */}
      <div className="ml-0 md:ml-64 flex flex-col min-h-screen">
        <main className="flex-1">
          <div className="container py-8 pt-20 md:pt-8">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold">{title}</h1>
                {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
              </div>
              {years.length > 1 ? (
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground">Academic Year</span>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="h-8 w-[170px] border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y.id} value={y.id} className="text-xs">
                          {y.id}
                          {y.id === currentYear ? " (current)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <span className="mt-1 inline-flex flex-col items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 shrink-0 text-center leading-tight">
                  <span>Academic Year</span>
                  <span className="font-bold">{selectedYear}</span>
                </span>
              )}
            </div>

            {isHistory && (
              <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                <History className="h-4 w-4 shrink-0" />
                <span>
                  Viewing <strong>{selectedYear}</strong> history — read-only. Submissions, reviews and appeals are closed for this year.
                </span>
                <button
                  onClick={() => setSelectedYear(currentYear)}
                  className="ml-auto text-xs font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
                >
                  Back to {currentYear}
                </button>
              </div>
            )}

            {children}
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
