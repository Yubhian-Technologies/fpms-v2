import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileEdit, Upload, Eye, Send, FileText, Edit } from "lucide-react";

interface QuickAction {
  title: string;
  description: string;
  icon: React.ElementType;
  variant: "default" | "accent" | "outline";
  href: string;
}

const actions: QuickAction[] = [
  
  {
    title: "My Submissions",
    description: "Track your review progress",
    icon: Eye,
    variant: "outline",
    href: "/submissions",
  },
  
  {
    title: "My Appeals",
    description: "View your Appeal",
    icon: Edit,
    variant: "outline",
    href: "/my-appeals",
  },
];

export function QuickActions() {
  return (
    <Card >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {actions.map((action) => (
          <Button
            key={action.title}
            
            className="h-auto justify-start gap-4 p-4"
            asChild
          >
            <a href={action.href}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
                <action.icon className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-medium">{action.title}</p>
                <p className="text-xs opacity-70">{action.description}</p>
              </div>
            </a>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
