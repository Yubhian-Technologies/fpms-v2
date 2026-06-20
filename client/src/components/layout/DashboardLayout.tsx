import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { Footer } from "./Footer";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
}

export function DashboardLayout({
  children,
  title,
  subtitle,
  badge,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      {/* Main content with proper sidebar offset */}
      <div className="ml-0 md:ml-64 flex flex-col min-h-screen">
        <main className="flex-1">
          <div className="container py-8 pt-20 md:pt-8">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold">{title}</h1>
                {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
              </div>
              {badge && (
                <span className="mt-1 inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 whitespace-nowrap shrink-0">
                  Academic Year: {badge}
                </span>
              )}
            </div>

            {children}
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
