import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import { formatRoleLabel } from "@/lib/utils";

interface RoleOption {
  id?: string;
  name: string;
  level: number;
}

interface WorkflowRule {
  role: string;
  submitToRoles: string[];
  appealToRoles: string[];
  submitToRole?: string;
  appealToRole?: string;
}

const normalizeRoleKey = (value: string) => {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (
    cleaned === "principal" ||
    cleaned === "principle" ||
    cleaned === "admin"
  ) {
    return "principle";
  }

  if (cleaned === "committee" || cleaned === "commitee") {
    return "committee";
  }

  if (cleaned === "internalcommittee" || cleaned === "internalcommitee") {
    return "internal committee";
  }

  return cleaned;
};

const isReviewerOnlyRole = (value: string) => {
  const key = normalizeRoleKey(value);
  return (
    key === "committee" ||
    key === "principle" ||
    key === "viceprinciple" ||
    key === "viceprincipal"
  );
};

const isAllowedAppealReviewerRole = (value: string) => {
  const key = normalizeRoleKey(value);
  return key === "principle" || key === "viceprinciple" || key === "viceprincipal";
};

export default function WorkflowRules() {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const sortedRoles = useMemo(
    () =>
      [...roles].sort(
        (a, b) =>
          Number(a.level || 0) - Number(b.level || 0) ||
          String(a.name).localeCompare(String(b.name)),
      ),
    [roles],
  );

  const appealReviewerRoles = useMemo(
    () => sortedRoles.filter((role) => isAllowedAppealReviewerRole(role.name)),
    [sortedRoles],
  );

  const buildRules = (
    roleOptions: RoleOption[],
    existingRules: WorkflowRule[],
  ) => {
    const byRole = new Map(
      existingRules.map((item) => [String(item.role || "").trim(), item]),
    );

    return roleOptions.filter((role) => !isReviewerOnlyRole(role.name)).map((role) => {
      const roleName = String(role.name || "").trim();
      const existing = byRole.get(roleName);
      return {
        role: roleName,
        submitToRoles: Array.isArray(existing?.submitToRoles)
          ? existing.submitToRoles
          : String(existing?.submitToRole || "").trim()
            ? [String(existing?.submitToRole || "").trim()]
            : [],
        appealToRoles: Array.isArray(existing?.appealToRoles)
          ? existing.appealToRoles.filter((value) =>
              isAllowedAppealReviewerRole(value),
            )
          : String(existing?.appealToRole || "").trim()
            ? isAllowedAppealReviewerRole(
                String(existing?.appealToRole || "").trim(),
              )
              ? [String(existing?.appealToRole || "").trim()]
              : []
            : [],
      };
    });
  };

  const fetchData = async () => {
    const [rolesRes, rulesRes] = await Promise.all([
      api.get("/api/auth/admin-workflow-roles"),
      api.get("/api/auth/workflow-rules"),
    ]);

    const roleList = Array.isArray(rolesRes.data?.data)
      ? rolesRes.data.data
      : [];
    const normalizedRoles: RoleOption[] = roleList
      .map((item: any) => ({
        id: item.id,
        name: String(item.name || "").trim(),
        level: Number(item.level || 0),
      }))
      .filter((item) => item.name);

    const serverRules = Array.isArray(rulesRes.data?.data)
      ? rulesRes.data.data
      : [];
    const normalizedRules: WorkflowRule[] = serverRules.map((item: any) => ({
      role: String(item.role || "").trim(),
      submitToRoles: Array.isArray(item.submitToRoles)
        ? item.submitToRoles
            .map((value: string) => String(value || "").trim())
            .filter(Boolean)
        : String(item.submitToRole || "").trim()
          ? [String(item.submitToRole || "").trim()]
          : [],
      appealToRoles: Array.isArray(item.appealToRoles)
        ? item.appealToRoles
            .map((value: string) => String(value || "").trim())
            .filter((value: string) => isAllowedAppealReviewerRole(value))
        : String(item.appealToRole || "").trim()
          ? isAllowedAppealReviewerRole(String(item.appealToRole || "").trim())
            ? [String(item.appealToRole || "").trim()]
            : []
          : [],
    }));

    setRoles(normalizedRoles);
    setRules(buildRules(normalizedRoles, normalizedRules));
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        await fetchData();
      } catch {
        toast({
          title: "Failed to load workflow rules",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const updateRule = (
    roleName: string,
    field: "submitToRoles" | "appealToRoles",
    value: string,
  ) => {
    setRules((prev) =>
      prev.map((item) =>
        item.role === roleName
          ? {
              ...item,
              [field]: item[field].includes(value)
                ? item[field].filter((selected) => selected !== value)
                : [...item[field], value],
            }
          : item,
      ),
    );
  };

  const renderSelectedRoles = (selectedRoles: string[]) => {
    if (!Array.isArray(selectedRoles) || selectedRoles.length === 0) {
      return "None";
    }
    return selectedRoles.map((role) => formatRoleLabel(role)).join(", ");
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await api.put("/api/auth/workflow-rules", { rules });
      toast({ title: "Workflow rules saved" });
      await fetchData();
    } catch (err: any) {
      toast({
        title: "Failed to save workflow rules",
        description: err.response?.data?.message || "Server error",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout
      title="Workflow Rules"
      subtitle="Role to submission and appeal routing"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Role Routing Table</CardTitle>
            <Button onClick={handleSave} disabled={isSaving || isLoading}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>To Be Submitted Role</TableHead>
                      <TableHead>To Be Appealed Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((item) => (
                      <TableRow key={item.role}>
                        <TableCell className="font-medium">
                          {formatRoleLabel(item.role)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between"
                              >
                                <span className="truncate text-left">
                                  {renderSelectedRoles(item.submitToRoles)}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[280px]">
                              <DropdownMenuLabel>
                                Select submit roles
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {sortedRoles
                                .filter((role) => role.name !== item.role)
                                .map((role) => (
                                  <DropdownMenuCheckboxItem
                                    key={`${item.role}-submit-${role.name}`}
                                    checked={item.submitToRoles.includes(
                                      role.name,
                                    )}
                                    onCheckedChange={() =>
                                      updateRule(
                                        item.role,
                                        "submitToRoles",
                                        role.name,
                                      )
                                    }
                                    onSelect={(event) => event.preventDefault()}
                                  >
                                    {formatRoleLabel(role.name)}
                                  </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between"
                              >
                                <span className="truncate text-left">
                                  {renderSelectedRoles(item.appealToRoles)}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[280px]">
                              <DropdownMenuLabel>
                                Select appeal roles
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {appealReviewerRoles
                                .filter((role) => role.name !== item.role)
                                .map((role) => (
                                  <DropdownMenuCheckboxItem
                                    key={`${item.role}-appeal-${role.name}`}
                                    checked={item.appealToRoles.includes(
                                      role.name,
                                    )}
                                    onCheckedChange={() =>
                                      updateRule(
                                        item.role,
                                        "appealToRoles",
                                        role.name,
                                      )
                                    }
                                    onSelect={(event) => event.preventDefault()}
                                  >
                                    {formatRoleLabel(role.name)}
                                  </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {rules.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No roles found. Add roles in superadmin first.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
