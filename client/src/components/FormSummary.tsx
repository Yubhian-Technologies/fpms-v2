import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FormSummaryProps {
  formTitle: string;
  roles: string[];
  criteriaCount: number;
  moduleCount: number;
  taskCount: number;
  totalMarks: number;
}

export default function FormSummary({
  formTitle,
  roles,
  criteriaCount,
  moduleCount,
  taskCount,
  totalMarks,
}: FormSummaryProps) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Form Summary</p>
            <p className="text-sm font-medium truncate max-w-[320px]">
              {formTitle || "Untitled Form"}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-xs px-2 py-0">
              Roles: {roles.length}
            </Badge>
            <Badge variant="outline" className="text-xs px-2 py-0">
              C: {criteriaCount}
            </Badge>
            <Badge variant="outline" className="text-xs px-2 py-0">
              M: {moduleCount}
            </Badge>
            <Badge variant="outline" className="text-xs px-2 py-0">
              T: {taskCount}
            </Badge>
            <Badge className="text-xs px-2 py-0">Total: {totalMarks}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
