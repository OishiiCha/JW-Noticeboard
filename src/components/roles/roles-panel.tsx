"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Loader2,
  Trash2,
  FileText,
  Download,
  Eye,
  X,
  Plus,
  Users,
} from "lucide-react";
import { t } from "@/lib/i18n";

interface RoleAssignment {
  id: string;
  title: string;
  meetingType: string;
  weekDate: string | null;
  fileUrl: string | null;
  fileName: string | null;
  ocrText: string | null;
  isPublished: boolean;
  showOnNoticeboard: boolean;
  createdAt: string;
  updatedAt: string;
}

export function RolesPanel({ language }: { language: "en" | "tl" }) {
  const { toast } = useToast();
  const [roles, setRoles] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [meetingType, setMeetingType] = useState("midweek");
  const [weekDate, setWeekDate] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [showOnNoticeboard, setShowOnNoticeboard] = useState(true);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles");
      if (res.ok) setRoles(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "roles");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setFileUrl(data.url);
        setFileName(data.fileName);
        toast({ title: language === "tl" ? "Na-upload ang file" : "File uploaded" });
      }
    } catch {
      toast({ title: language === "tl" ? "Nabigo ang upload" : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const resetForm = () => {
    setTitle("");
    setMeetingType("midweek");
    setWeekDate("");
    setFileUrl("");
    setFileName("");
    setOcrText("");
    setIsPublished(true);
    setShowOnNoticeboard(true);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: language === "tl" ? "Kailangan ng pamagat" : "Title is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          meetingType,
          weekDate: weekDate || null,
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          ocrText: ocrText || null,
          isPublished,
          showOnNoticeboard,
        }),
      });

      if (res.ok) {
        toast({ title: t("rolesSaved", language) });
        resetForm();
        fetchRoles();
      } else {
        throw new Error("Failed");
      }
    } catch {
      toast({ title: language === "tl" ? "Nabigo" : "Failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("rolesDeleteConfirm", language))) return;
    try {
      await fetch(`/api/roles/${id}`, { method: "DELETE" });
      toast({ title: t("rolesDeleted", language) });
      fetchRoles();
    } catch {
      toast({ title: language === "tl" ? "Nabigo" : "Failed", variant: "destructive" });
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(language === "tl" ? "fil-PH" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          {t("rolesSection", language)}
        </h2>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t("rolesUpload", language)}
          </Button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                {t("rolesUpload", language)}
              </span>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label>{t("rolesTitle", language)}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={language === "tl" ? "hal. Midweek Pulong — Linggo ng Hulyo 1" : "e.g. Midweek Meeting — Week of July 1"}
              />
            </div>

            {/* Meeting Type + Week Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("rolesMeetingType", language)}</Label>
                <select
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="midweek">{t("rolesMidweek", language)}</option>
                  <option value="weekend">{t("rolesWeekend", language)}</option>
                  <option value="special">{t("rolesSpecial", language)}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("rolesWeekDate", language)}</Label>
                <Input
                  type="date"
                  value={weekDate}
                  onChange={(e) => setWeekDate(e.target.value)}
                />
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>{t("rolesFile", language)}</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                  {uploading ? "..." : t("upload", language)}
                </Button>
                {fileName && (
                  <span className="text-sm text-muted-foreground truncate">{fileName}</span>
                )}
              </div>
            </div>

            {/* Manual text input */}
            <div className="space-y-2">
              <Label>Roles text (optional)</Label>
              <Textarea
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                rows={6}
                placeholder="Paste the roles text here, or use the AI prompt feature in the Weekly Roles modal to extract text from images."
                className="font-mono text-sm"
              />
            </div>

            {/* Publish + Noticeboard toggles */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label>{t("rolesPublished", language)}</Label>
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
              </div>
              <div className="flex items-center justify-between">
                <Label>{t("rolesShowOnNoticeboard", language)}</Label>
                <Switch checked={showOnNoticeboard} onCheckedChange={setShowOnNoticeboard} />
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetForm}>
                {t("cancel", language)}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {t("save", language)}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Roles List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : roles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t("rolesNoRoles", language)}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {roles.map((role) => (
            <Card key={role.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{role.title}</CardTitle>
                  <Badge variant={role.meetingType === "midweek" ? "default" : role.meetingType === "weekend" ? "secondary" : "outline"}>
                    {role.meetingType === "midweek" ? t("rolesMidweek", language) : role.meetingType === "weekend" ? t("rolesWeekend", language) : t("rolesSpecial", language)}
                  </Badge>
                </div>
                {role.weekDate && (
                  <p className="text-xs text-muted-foreground">
                    {t("rolesWeekDate", language)}: {formatDate(role.weekDate)}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {role.ocrText && (
                  <div className="rounded-md border border-border/40 bg-muted/30 p-2 max-h-32 overflow-y-auto">
                    <p className="text-xs whitespace-pre-wrap line-clamp-4">{role.ocrText}</p>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">{formatDate(role.createdAt)}</span>
                  <div className="flex gap-1">
                    {role.fileUrl && (
                      <>
                        <a href={role.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                        <a href={role.fileUrl} download>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(role.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
