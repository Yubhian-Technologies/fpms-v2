import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";

interface ViewerUser {
  id: string;
  name: string;
  email: string;
}

export default function AddViewer() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewers, setViewers] = useState<ViewerUser[]>([]);
  const [isLoadingViewers, setIsLoadingViewers] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchViewers = async () => {
    setIsLoadingViewers(true);
    try {
      const res = await api.get("/api/committee/viewers");
      const list = res.data?.data || [];
      setViewers(
        list.map((u: any) => ({
          id: u.id || u.uid,
          name: u.name,
          email: u.email,
        })),
      );
    } catch {
      // silently ignore
    } finally {
      setIsLoadingViewers(false);
    }
  };

  useEffect(() => {
    fetchViewers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    setIsSubmitting(true);
    try {
      await api.post("/api/committee/viewer-add", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      toast({ title: "Viewer added", description: `${name} can now log in and view statistics.` });
      setName("");
      setEmail("");
      setPassword("");
      fetchViewers();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to add viewer";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/committee/delete/${deleteId}`);
      toast({ title: "Viewer removed" });
      setDeleteId(null);
      fetchViewers();
    } catch {
      toast({ title: "Error", description: "Failed to remove viewer", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Viewers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Viewer accounts can log in and view cross-college statistics — read-only access.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Viewer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="viewer-name">Full Name</Label>
                <Input
                  id="viewer-name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="viewer-email">Email</Label>
                <Input
                  id="viewer-email"
                  type="email"
                  placeholder="viewer@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="viewer-password">Password</Label>
                <div className="relative">
                  <Input
                    id="viewer-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Viewer
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Existing Viewers</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingViewers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : viewers.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No viewers added yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewers.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell className="text-muted-foreground">{v.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Viewer</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(v.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <DeleteConfirmationDialog
          open={!!deleteId}
          onOpenChange={(open) => !open && setDeleteId(null)}
          onConfirm={handleDelete}
          isLoading={isDeleting}
          title="Remove Viewer"
          description="This will permanently delete the viewer account. They will no longer be able to log in."
        />
      </div>
    </DashboardLayout>
  );
}
