"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Plus,
  Search,
  Pin,
  Trash2,
  Edit,
  FileText,
  ExternalLink,
  Upload,
  Loader2,
} from "lucide-react";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: string;
  name: string;
  nameTl?: string | null;
  slug: string;
  color?: string | null;
}

interface Notice {
  id: string;
  title: string;
  titleTl?: string | null;
  description?: string | null;
  descriptionTl?: string | null;
  type: string;
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  thumbnailUrl?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  isPinned: boolean;
  isPublished: boolean;
  isPublic: boolean;
  language: string;
  expiresAt?: string | null;
  publishAt?: string | null;
  approvalStatus: string;
  createdAt: string;
  category?: Category | null;
  categoryId?: string | null;
  showOnCalendar?: boolean;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
}

export function NoticeManager({ language }: { language: Language }) {
  const { toast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Notice> | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [noticesRes, categoriesRes] = await Promise.all([
        fetch("/api/notices?showExpired=true&showScheduled=true&showPending=true"),
        fetch("/api/categories"),
      ]);
      if (noticesRes.ok) setNotices(await noticesRes.json());
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredNotices = notices.filter((n) => {
    if (!showDeleted && n.approvalStatus === "deleted") return false;
    if (search) {
      const q = search.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleCreate = () => {
    setEditing({
      title: "",
      type: "text",
      isPinned: false,
      isPublished: true,
      isPublic: true,
      language: "en",
      showOnCalendar: false,
    });
    setEditOpen(true);
  };

  const handleEdit = (notice: Notice) => {
    setEditing({ ...notice });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editing?.title) return;

    const method = editing.id ? "PUT" : "POST";
    const url = editing.id ? `/api/notices/${editing.id}` : "/api/notices";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });

      if (res.ok) {
        toast({ title: editing.id ? "Notice updated" : "Notice created" });
        setEditOpen(false);
        setEditing(null);
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error saving notice", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/notices/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Notice deleted" });
        setDeleteId(null);
        fetchData();
      }
    } catch {
      toast({ title: "Error deleting notice", variant: "destructive" });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "notices");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setEditing({
          ...editing,
          fileUrl: data.url,
          fileName: data.fileName,
          type: file.type.includes("pdf") ? "pdf" : file.type.includes("image") ? "image" : editing.type,
        });
        toast({ title: "File uploaded" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchNotices", language)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <Button onClick={handleCreate} className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20">
          <Plus className="h-4 w-4 mr-1" />
          {t("createNotice", language)}
        </Button>
      </div>

      {/* Notices List */}
      <div className="space-y-3">
        {filteredNotices.length === 0 ? (
          <Card className="rounded-2xl border-border/40">
            <CardContent className="py-8 text-center text-muted-foreground">
              {t("noNotices", language)}
            </CardContent>
          </Card>
        ) : (
          filteredNotices.map((notice) => (
            <Card key={notice.id} className="card-hover rounded-2xl border-border/40">
              <CardContent className="flex items-start gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {notice.isPinned && <Pin className="h-4 w-4 text-amber-500 shrink-0" />}
                    <h3 className="font-semibold truncate">{notice.title}</h3>
                    <Badge variant={notice.approvalStatus === "approved" ? "default" : "secondary"} className="text-xs rounded-md">
                      {notice.approvalStatus}
                    </Badge>
                    {!notice.isPublished && <Badge variant="outline" className="text-xs rounded-md">Draft</Badge>}
                  </div>
                  {notice.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{notice.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs rounded-md">{notice.type}</Badge>
                    {notice.category && <span>{notice.category.name}</span>}
                    <span>{new Date(notice.createdAt).toLocaleDateString()}</span>
                    {notice.fileName && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {notice.fileName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => handleEdit(notice)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => setDeleteId(notice.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editing?.id ? t("editNotice", language) : t("createNotice", language)}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("noticeTitle", language)}</Label>
                <Input
                  value={editing.title || ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("noticeDescription", language)}</Label>
                <Textarea
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("noticeType", language)}</Label>
                  <Select
                    value={editing.type || "text"}
                    onValueChange={(v) => setEditing({ ...editing, type: v })}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">{t("noticeTypeText", language)}</SelectItem>
                      <SelectItem value="pdf">{t("noticeTypePdf", language)}</SelectItem>
                      <SelectItem value="image">{t("noticeTypeImage", language)}</SelectItem>
                      <SelectItem value="link">{t("noticeTypeLink", language)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("noticeCategory", language)}</Label>
                  <Select
                    value={editing.categoryId || ""}
                    onValueChange={(v) => setEditing({ ...editing, categoryId: v || null })}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editing.type === "text" && (
                <div className="space-y-2">
                  <Label>{t("noticeContent", language)}</Label>
                  <Textarea
                    value={editing.content || ""}
                    onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                    rows={4}
                    className="rounded-xl"
                  />
                </div>
              )}

              {editing.type === "link" && (
                <div className="space-y-2">
                  <Label>{t("noticeLink", language)}</Label>
                  <Input
                    value={editing.linkUrl || ""}
                    onChange={(e) => setEditing({ ...editing, linkUrl: e.target.value })}
                    placeholder="https://..."
                    className="rounded-xl"
                  />
                </div>
              )}

              {(editing.type === "pdf" || editing.type === "image") && (
                <div className="space-y-2">
                  <Label>{t("noticeFile", language)}</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                      {t("noticeUploadFile", language)}
                    </Button>
                    {editing.fileName && (
                      <span className="text-sm text-muted-foreground truncate">{editing.fileName}</span>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={editing.type === "pdf" ? ".pdf" : "image/*"}
                    onChange={handleFileUpload}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
                  <Label className="cursor-pointer">{t("noticePin", language)}</Label>
                  <Switch
                    checked={editing.isPinned || false}
                    onCheckedChange={(v) => setEditing({ ...editing, isPinned: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
                  <Label className="cursor-pointer">{t("noticePublish", language)}</Label>
                  <Switch
                    checked={editing.isPublished !== false}
                    onCheckedChange={(v) => setEditing({ ...editing, isPublished: v })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
                  <Label className="cursor-pointer">{t("noticePublic", language)}</Label>
                  <Switch
                    checked={editing.isPublic !== false}
                    onCheckedChange={(v) => setEditing({ ...editing, isPublic: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
                  <Label className="cursor-pointer">{t("noticeShowOnCalendar", language)}</Label>
                  <Switch
                    checked={editing.showOnCalendar || false}
                    onCheckedChange={(v) => setEditing({ ...editing, showOnCalendar: v })}
                  />
                </div>
              </div>

              {editing.showOnCalendar && (
                <div className="space-y-2">
                  <Label>Calendar Dates</Label>
                  <DateRangePicker
                    startDate={editing.eventStartDate || ""}
                    endDate={editing.eventEndDate || ""}
                    onChange={(start, end) => setEditing({ ...editing, eventStartDate: start || null, eventEndDate: end || null })}
                    placeholder="Select dates"
                    language={language}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Event Date (Optional — shows countdown)</Label>
                <Input
                  type="date"
                  value={editing.eventStartDate || ""}
                  onChange={(e) => setEditing({ ...editing, eventStartDate: e.target.value || null })}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label>{t("noticeExpiry", language)}</Label>
                <Input
                  type="datetime-local"
                  value={editing.expiresAt ? new Date(editing.expiresAt).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setEditing({ ...editing, expiresAt: e.target.value || null })}
                  className="rounded-xl"
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
            <AlertDialogTitle>{t("deleteNotice", language)}</AlertDialogTitle>
            <AlertDialogDescription>{t("noticeDeleteConfirm", language)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel", language)}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t("delete", language)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
