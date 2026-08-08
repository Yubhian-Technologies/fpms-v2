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

interface GuestUser {
  id: string;
  name: string;
  email: string;
}

export default function AddGuest() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guests, setGuests] = useState<GuestUser[]>([]);
  const [isLoadingGuests, setIsLoadingGuests] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchGuests = async () => {
    setIsLoadingGuests(true);
    try {
      const res = await api.get("/api/superadmin/guests");
      const list = res.data?.data || [];
      setGuests(
        list.map((u: any) => ({
          id: u.id || u.uid,
          name: u.name,
          email: u.email,
        })),
      );
    } catch {
      // silently ignore
    } finally {
      setIsLoadingGuests(false);
    }
  };

  useEffect(() => {
    fetchGuests();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    setIsSubmitting(true);
    try {
      await api.post("/api/superadmin/guests", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      toast({ title: "Guest added", description: `${name} can now log in and view all college data.` });
      setName("");
      setEmail("");
      setPassword("");
      fetchGuests();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to add guest";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/superadmin/guests/${deleteId}`);
      toast({ title: "Guest removed" });
      setDeleteId(null);
      fetchGuests();
    } catch {
      toast({ title: "Error", description: "Failed to remove guest", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Guest Users</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Guest accounts can log in and view all college, department, faculty, and module data — read-only access.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Guest
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guest-name">Full Name</Label>
                <Input
                  id="guest-name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-email">Email</Label>
                <Input
                  id="guest-email"
                  type="email"
                  placeholder="guest@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-password">Password</Label>
                <div className="relative">
                  <Input
                    id="guest-password"
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
                  Add Guest
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Existing Guests</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingGuests ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : guests.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No guests added yet.</p>
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
                  {guests.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell className="text-muted-foreground">{g.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Guest</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(g.id)}
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
          title="Remove Guest"
          description="This will permanently delete the guest account. They will no longer be able to log in."
        />
      </div>
    </DashboardLayout>
  );
}
