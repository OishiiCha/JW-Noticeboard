"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  FileText,
  Upload,
  Loader2,
  CalendarDays,
  Clock,
  MapPin,
} from "lucide-react";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

interface Meeting {
  id: string;
  meetingType: string;
  date: string;
  time: string;
  location?: string | null;
  scheduleFileUrl?: string | null;
  scheduleFileName?: string | null;
  notes?: string | null;
  isPublished: boolean;
  createdAt: string;
}

export function MeetingManager({ language }: { language: Language }) {
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Meeting> | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/meetings?published=false");
      if (res.ok) setMeetings(await res.json());
    } catch (error) {
      console.error("Error fetching meetings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = () => {
    setEditing({
      meetingType: "midweek",
      date: "",
      time: "",
      location: "Kingdom Hall",
      isPublished: false,
    });
    setEditOpen(true);
  };

  const handleEdit = (meeting: Meeting) => {
    setEditing({ ...meeting });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editing?.date || !editing?.time || !editing?.meetingType) return;

    const method = editing.id ? "PUT" : "POST";
    const url = editing.id ? `/api/meetings/${editing.id}` : "/api/meetings";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });

      if (res.ok) {
        toast({ title: editing.id ? "Meeting updated" : "Meeting created" });
        setEditOpen(false);
        setEditing(null);
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error saving meeting", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/meetings/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Meeting deleted" });
        setDeleteId(null);
        fetchData();
      }
    } catch {
      toast({ title: "Error deleting meeting", variant: "destructive" });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "schedules");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setEditing({
          ...editing,
          scheduleFileUrl: data.url,
          scheduleFileName: data.fileName,
        });
        toast({ title: "Schedule uploaded" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Group by month
  const groupedMeetings: Record<string, Meeting[]> = {};
  for (const m of meetings) {
    const month = m.date.substring(0, 7); // YYYY-MM
    if (!groupedMeetings[month]) groupedMeetings[month] = [];
    groupedMeetings[month].push(m);
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(language === "tl" ? "fil-PH" : "en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatMonth = (monthStr: string) => {
    const [y, m] = monthStr.split("-");
    const d = new Date(parseInt(y), parseInt(m) - 1);
    return d.toLocaleDateString(language === "tl" ? "fil-PH" : "en-US", {
      year: "numeric",
      month: "long",
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-1" />
          {t("meetingCreate", language)}
        </Button>
      </div>

      {Object.keys(groupedMeetings).sort().reverse().map((month) => (
        <div key={month}>
          <h3 className="text-lg font-semibold mb-2">{formatMonth(month)}</h3>
          <div className="space-y-2">
            {groupedMeetings[month].map((meeting) => (
              <Card key={meeting.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex items-center gap-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={meeting.meetingType === "midweek" ? "default" : "secondary"}>
                        {meeting.meetingType === "midweek" ? t("midweekMeeting", language) : t("weekendMeeting", language)}
                      </Badge>
                      {!meeting.isPublished && <Badge variant="outline">Draft</Badge>}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(meeting.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {meeting.time}
                      </span>
                      {meeting.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {meeting.location}
                        </span>
                      )}
                      {meeting.scheduleFileName && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <FileText className="h-3 w-3" />
                          {meeting.scheduleFileName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(meeting)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(meeting.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {meetings.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No meeting entries yet. Create one to get started.</p>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? t("meetingEdit", language) : t("meetingCreate", language)}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("eventType", language)}</Label>
                <Select
                  value={editing.meetingType || "midweek"}
                  onValueChange={(v) => setEditing({ ...editing, meetingType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="midweek">{t("midweekMeeting", language)}</SelectItem>
                    <SelectItem value="weekend">{t("weekendMeeting", language)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("meetingDate", language)}</Label>
                  <Input
                    type="date"
                    value={editing.date || ""}
                    onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("meetingTime", language)}</Label>
                  <Input
                    type="time"
                    value={editing.time || ""}
                    onChange={(e) => setEditing({ ...editing, time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("meetingLocation", language)}</Label>
                <Input
                  value={editing.location || ""}
                  onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("meetingUploadSchedule", language)}</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                    {t("upload", language)}
                  </Button>
                  {editing.scheduleFileName && (
                    <span className="text-sm text-muted-foreground truncate">{editing.scheduleFileName}</span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf"
                  onChange={handleFileUpload}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("meetingNotes", language)}</Label>
                <Input
                  value={editing.notes || ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>{t("meetingPublished", language)}</Label>
                <Switch
                  checked={editing.isPublished || false}
                  onCheckedChange={(v) => setEditing({ ...editing, isPublished: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t("cancel", language)}
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              {t("save", language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>{t("meetingDeleteConfirm", language)}</AlertDialogDescription>
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
