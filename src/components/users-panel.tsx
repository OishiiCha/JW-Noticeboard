"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Edit,
  Users,
  ShieldCheck,
  Shield,
  User,
  ClipboardList,
  CalendarDays,
  CalendarRange,
  KeyRound,
  Copy,
} from "lucide-react";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

interface UserRecord {
  id: string;
  name?: string | null;
  username: string;
  email: string;
  role: string;
  permissions?: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  tempPassword?: string | null;
  createdAt: string;
}

type ModuleId = "notices" | "meetings" | "events";
type AccessLevel = "none" | "r" | "rw";

const MODULES: Array<{ id: ModuleId; icon: typeof ClipboardList; labelEn: string; labelTl: string }> = [
  { id: "notices", icon: ClipboardList, labelEn: "Notices", labelTl: "Mga Anunsyo" },
  { id: "meetings", icon: CalendarDays, labelEn: "Meetings", labelTl: "Mga Pulong" },
  { id: "events", icon: CalendarRange, labelEn: "Events", labelTl: "Mga Kaganapan" },
];

function parsePermissions(json: string | undefined): Record<ModuleId, AccessLevel> {
  const result: Record<ModuleId, AccessLevel> = { notices: "none", meetings: "none", events: "none" };
  if (!json) return result;
  try {
    const parsed = JSON.parse(json) as Array<{ id: ModuleId; access: "r" | "rw" }>;
    for (const entry of parsed) {
      if (entry.id in result) {
        result[entry.id] = entry.access === "rw" ? "rw" : "r";
      }
    }
  } catch { /* ignore */ }
  return result;
}

function serializePermissions(perms: Record<ModuleId, AccessLevel>): string {
  const entries = Object.entries(perms)
    .filter(([, access]) => access !== "none")
    .map(([id, access]) => ({ id, access }));
  return JSON.stringify(entries);
}

const ROLE_META: Record<string, { icon: typeof ShieldCheck; color: string; label: string }> = {
  super_admin: { icon: ShieldCheck, color: "text-purple-600", label: "Super Admin" },
  admin: { icon: Shield, color: "text-blue-600", label: "Admin" },
  user: { icon: User, color: "text-gray-600", label: "User" },
};

export function UsersPanel({ language }: { language: Language }) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<UserRecord & { password?: string }> | null>(null);
  const [permState, setPermState] = useState<Record<ModuleId, AccessLevel>>({ notices: "none", meetings: "none", events: "none" });
  const [generateTemp, setGenerateTemp] = useState(true);
  const [tempResult, setTempResult] = useState<{ username: string; tempPassword: string } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        setUsers(await res.json());
      } else if (res.status === 403) {
        setForbidden(true);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = () => {
    setEditing({ name: "", username: "", email: "", password: "", role: "user", isActive: true });
    setPermState({ notices: "none", meetings: "none", events: "none" });
    setGenerateTemp(true);
    setEditOpen(true);
  };

  const handleEdit = (user: UserRecord) => {
    setEditing({ ...user, password: "" });
    setPermState(parsePermissions(user.permissions));
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editing?.username) return;

    const method = editing.id ? "PUT" : "POST";
    const url = editing.id ? `/api/admin/users/${editing.id}` : "/api/admin/users";

    const payload = {
      ...editing,
      permissions: serializePermissions(permState),
      ...(!editing.id ? { generateTemp } : {}),
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        toast({ title: editing.id ? "User updated" : "User created" });
        setEditOpen(false);
        setEditing(null);
        fetchUsers();
        if (!editing.id && generateTemp && data.tempPassword) {
          setTempResult({ username: data.username, tempPassword: data.tempPassword });
        }
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error saving user", variant: "destructive" });
    }
  };

  const handleResetTemp = async (user: UserRecord) => {
    setResettingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetTempPassword: true }),
      });
      if (res.ok) {
        const data = await res.json();
        fetchUsers();
        if (data.tempPassword) {
          setTempResult({ username: user.username, tempPassword: data.tempPassword });
        }
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error resetting password", variant: "destructive" });
    } finally {
      setResettingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/users/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "User deleted" });
        setDeleteId(null);
        fetchUsers();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error deleting user", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="flex items-center gap-3 py-6">
          <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {language === "tl"
              ? "Ang super admin lang ang puwedeng mag-manage ng mga user."
              : "Only super admins can manage users."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreate} className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20">
          <Plus className="h-4 w-4 mr-1" />
          {t("createUser", language)}
        </Button>
      </div>

      {users.length === 0 ? (
        <Card className="rounded-2xl border-border/40">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No users found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const roleMeta = ROLE_META[user.role] || ROLE_META.user;
            const RoleIcon = roleMeta.icon;
            const perms = parsePermissions(user.permissions);
            const grantedModules = MODULES.filter((m) => perms[m.id] !== "none");
            return (
              <Card key={user.id} className="card-hover rounded-2xl border-border/40">
                <CardContent className="flex items-center gap-4 py-3">
                  <RoleIcon className={`h-5 w-5 shrink-0 ${roleMeta.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{user.name || user.username}</h3>
                      <Badge variant={user.role === "super_admin" ? "default" : "secondary"} className="text-xs rounded-md">
                        {roleMeta.label}
                      </Badge>
                      {!user.isActive && <Badge variant="destructive" className="text-xs rounded-md">Inactive</Badge>}
                      {user.tempPassword && (
                        <Badge variant="outline" className="text-xs rounded-md bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 gap-1">
                          <KeyRound className="h-3 w-3" />
                          Temp: <span className="font-mono font-bold tracking-wider">{user.tempPassword}</span>
                          <button
                            onClick={() => { navigator.clipboard?.writeText(user.tempPassword!); toast({ title: "Copied" }); }}
                            className="hover:text-amber-900 dark:hover:text-amber-100"
                            title="Copy"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {user.role === "user" && grantedModules.map((m) => (
                        <Badge key={m.id} variant="outline" className="text-xs rounded-md">
                          {m.labelEn}: {perms[m.id] === "rw" ? "upload" : "view"}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      @{user.username} — {user.email}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {user.role !== "super_admin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-lg"
                        onClick={() => handleResetTemp(user)}
                        disabled={resettingId === user.id}
                        title="Generate new temporary password"
                      >
                        <KeyRound className={`h-4 w-4 ${resettingId === user.id ? "animate-pulse" : ""}`} />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => handleEdit(user)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    {user.role !== "super_admin" && (
                      <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => setDeleteId(user.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editing?.id ? t("editUser", language) : t("createUser", language)}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("userName", language)}</Label>
                <Input
                  value={editing.name || ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("userUsername", language)}</Label>
                <Input
                  value={editing.username || ""}
                  onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("userEmail", language)}</Label>
                <Input
                  type="email"
                  value={editing.email || ""}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              {!editing.id && (
                <div className="flex items-center justify-between rounded-xl border border-border/40 px-3 py-2.5">
                  <Label className="text-sm cursor-pointer flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" /> Generate temporary password
                  </Label>
                  <Switch checked={generateTemp} onCheckedChange={setGenerateTemp} />
                </div>
              )}
              {(!generateTemp || editing.id) && (
                <div className="space-y-2">
                  <Label>{t("userPassword", language)}</Label>
                  <Input
                    type="password"
                    value={editing.password || ""}
                    onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                    placeholder={editing.id ? "Leave blank to keep current" : "Enter password"}
                    className="rounded-xl"
                  />
                </div>
              )}
              {!editing.id && generateTemp && (
                <p className="text-[11px] text-muted-foreground -mt-2">
                  A 5-character temporary password will be generated. The user must create a new password on first login.
                </p>
              )}
              <div className="space-y-2">
                <Label>{t("userRole", language)}</Label>
                <Select
                  value={editing.role || "user"}
                  onValueChange={(v) => setEditing({ ...editing, role: v })}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-purple-600" /> Super Admin
                      </span>
                    </SelectItem>
                    <SelectItem value="admin">
                      <span className="flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-blue-600" /> Admin
                      </span>
                    </SelectItem>
                    <SelectItem value="user">
                      <span className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-gray-600" /> User
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {editing.role === "super_admin"
                    ? "Full access — including congregation details and user management."
                    : editing.role === "admin"
                      ? "Can upload and manage content, but cannot change congregation details."
                      : "Access only to the modules granted below."}
                </p>
              </div>

              {editing.role === "user" && (
                <div className="space-y-3 p-3 rounded-xl border border-border/40 bg-muted/30">
                  <Label className="text-sm font-semibold">Access Control</Label>
                  {MODULES.map((mod) => {
                    const Icon = mod.icon;
                    const current = permState[mod.id];
                    return (
                      <div key={mod.id} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {mod.labelEn}
                        </span>
                        <div className="flex gap-1">
                          {(["none", "r", "rw"] as AccessLevel[]).map((level) => (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setPermState({ ...permState, [mod.id]: level })}
                              className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                                current === level
                                  ? level === "rw"
                                    ? "bg-indigo-500 text-white border-indigo-500"
                                    : level === "r"
                                      ? "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-200"
                                      : "bg-muted text-foreground border-border"
                                  : "bg-transparent text-muted-foreground border-border hover:bg-accent"
                              }`}
                            >
                              {level === "none" ? "None" : level === "r" ? "View" : "Upload"}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
                <Label className="cursor-pointer">{t("userActive", language)}</Label>
                <Switch
                  checked={editing.isActive !== false}
                  onCheckedChange={(v) => setEditing({ ...editing, isActive: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setEditOpen(false)}>
              {t("cancel", language)}
            </Button>
            <Button onClick={handleSave} className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20">
              {t("save", language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>{t("userDeleteConfirm", language)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel", language)}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t("delete", language)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Temp Password Result Dialog */}
      <Dialog open={!!tempResult} onOpenChange={() => setTempResult(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <KeyRound className="h-5 w-5 text-amber-500" />
              Temporary Password
            </DialogTitle>
          </DialogHeader>
          {tempResult && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Temporary password for <span className="font-semibold text-foreground">@{tempResult.username}</span>:
              </p>
              <div className="flex items-center justify-center gap-3 py-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                <span className="text-3xl font-bold font-mono tracking-[0.3em] text-amber-700 dark:text-amber-300">
                  {tempResult.tempPassword}
                </span>
                <button
                  onClick={() => { navigator.clipboard?.writeText(tempResult.tempPassword); toast({ title: "Copied to clipboard" }); }}
                  className="p-2 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                  title="Copy"
                >
                  <Copy className="h-4 w-4 text-amber-600" />
                </button>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <p>The user must create a new password on first login. This temporary password will be visible in the user list until they change it.</p>
              </div>
              <Button onClick={() => setTempResult(null)} className="w-full rounded-xl">
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
