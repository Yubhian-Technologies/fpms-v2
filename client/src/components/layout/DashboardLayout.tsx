import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { Footer } from "./Footer";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({
  children,
  title,
  subtitle,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      {/* Main content with proper sidebar offset */}
      <div className="ml-64 flex flex-col min-h-screen">
        <main className="flex-1">
          <div className="container py-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold">{title}</h1>
              {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
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
