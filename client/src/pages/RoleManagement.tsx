import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Plus, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import { formatRoleLabel } from "@/lib/utils";

interface Role {
  id: string;
  name: string;
  level: number;
}

export default function RoleManagement() {
  const { toast } = useToast();

  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isAddingRoleLoading, setIsAddingRoleLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isAddingRole, setIsAddingRole] = useState(false);

  const [newRole, setNewRole] = useState<Partial<Role>>({
    name: "",
    level: 0,
  });

  const fetchRoles = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const response = await api.get("/api/superadmin/roles");
      setRoles(response.data?.data ?? []);
    } catch (error: any) {
      if (!silent) {
        toast({
          title: "Load Failed",
          description:
            error?.response?.data?.message || "Unable to load roles.",
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsInitialLoading(true);
        await fetchRoles();
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadInitialData();

    const interval = window.setInterval(() => {
      fetchRoles(true);
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const handleAddRole = async () => {
    if (!newRole.name || newRole.level === undefined) {
      toast({
        title: "Validation Error",
        description: "Please fill in role name and level.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAddingRoleLoading(true);
      await api.post("/api/superadmin/roles", {
        name: newRole.name,
        level: newRole.level,
      });

      setIsAddingRole(false);
      setNewRole({
        name: "",
        level: 0,
      });

      await fetchRoles(true);

      toast({
        title: "Role Added",
        description: "Role has been successfully added.",
      });
    } catch (error: any) {
      toast({
        title: "Add Failed",
        description: error?.response?.data?.message || "Unable to add role.",
        variant: "destructive",
      });
    } finally {
      setIsAddingRoleLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      setDeletingRoleId(roleId);
      await api.delete(`/api/superadmin/roles/${roleId}`);
      await fetchRoles(true);
      setRoleToDelete(null);
      toast({
        title: "Role Deleted",
        description: "The role has been removed from the system.",
      });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error?.response?.data?.message || "Unable to delete role.",
        variant: "destructive",
      });
    } finally {
      setDeletingRoleId(null);
    }
  };

  const handleSaveAll = async () => {
    try {
      setIsSyncing(true);
      await fetchRoles(true);
      toast({
        title: "Synced",
        description: "Roles are synced with server data.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <DashboardLayout
      title="Role Management"
      subtitle="Manage administrative roles and levels"
    >
      {isInitialLoading ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading role data...</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6 pb-16">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-muted-foreground">
                {roles.length} role{roles.length !== 1 ? "s" : ""} configured
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setIsAddingRole(!isAddingRole)}
                variant={isAddingRole ? "outline" : "default"}
                className="gap-2"
                disabled={
                  isAddingRoleLoading || isSyncing || deletingRoleId !== null
                }
              >
                {isAddingRole ? (
                  "Cancel"
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Add New Role
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Add New Role Form */}
          {isAddingRole && (
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle>Add New Role</CardTitle>
                <CardDescription>
                  Define a new administrative role
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Role Name *</Label>
                    <Input
                      placeholder="e.g., Associate Dean, Director..."
                      value={newRole.name}
                      onChange={(e) =>
                        setNewRole({ ...newRole, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Level *</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0, 1, 2..."
                      value={newRole.level}
                      onChange={(e) =>
                        setNewRole({
                          ...newRole,
                          level: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddingRole(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddRole} className="gap-2">
                    {isAddingRoleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {isAddingRoleLoading ? "Adding..." : "Add Role"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Roles Table */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Roles</CardTitle>
              <CardDescription>
                View and manage configured administrative roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && (
                <div className="text-sm text-muted-foreground mb-4">
                  Loading roles...
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role Name</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        {formatRoleLabel(role.name)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Level {role.level}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRoleToDelete(role)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={
                            deletingRoleId === role.id ||
                            isSyncing ||
                            isAddingRoleLoading
                          }
                        >
                          {deletingRoleId === role.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {roles.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No roles configured yet. Click "Add New Role" to create one.
                </div>
              )}
            </CardContent>
          </Card>

          <DeleteConfirmationDialog
            open={!!roleToDelete}
            onOpenChange={(open) => {
              if (!open && !deletingRoleId) setRoleToDelete(null);
            }}
            title="Delete role?"
            description={`This will permanently delete ${formatRoleLabel(roleToDelete?.name) || "this role"}.`}
            confirmText="Delete"
            isLoading={!!deletingRoleId}
            onConfirm={() => {
              if (roleToDelete) handleDeleteRole(roleToDelete.id);
            }}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
