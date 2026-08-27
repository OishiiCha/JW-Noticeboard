"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Search,
  Pin,
  LayoutGrid,
  LogIn,
  LogOut,
  CalendarDays,
  Moon,
  Sun,
  Clock,
  MapPin,
  FileText,
  ExternalLink,
  Download,
  CalendarClock,
  Sparkles,
  Navigation,
  UserCog,
  Users,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Archive,
  Plus,
  Settings,
  X,
  Upload,
  Loader2,
  FileImage,
  Link2,
  Menu,
  Home,
  ScrollText,
  Volume2,
  Mail,
  Building2,
  FolderClosed,
  Save,
  Database,
  Bell,
  CheckCheck,
  KeyRound,
  Copy,
  Check,
  Square,
  AlertTriangle,
  Layers,
  Lock,
  BookOpen,
  Mic,
  MoreVertical,
  Share2,
  Code,
  List,
  Type,
  ClipboardPaste,
  Wand2,
  Star,
  ShieldCheck,
  History,
  Printer,
} from "lucide-react";
import { t } from "@/lib/i18n";
import dynamic from "next/dynamic";
const PdfViewer = dynamic(() => import("@/components/pdf-canvas").then(m => m.PdfViewer), { ssr: false });
const MiniMap = dynamic(() => import("@/components/mini-map").then(m => m.MiniMap), { ssr: false });
import { PhotoViewer } from "@/components/photo-viewer";
import { CalendarView } from "@/components/calendar/calendar-view";
import { SettingsPanel } from "@/components/settings-panel";
import { FileManager } from "@/components/file-manager";
import { BackupHistory } from "@/components/backup-history";
import { AddItemPicker, type AddItemChoice } from "@/components/add-item-picker";
import { ScheduleModal } from "@/components/modals/schedule-modal";
import { AnnouncementModal } from "@/components/modals/announcement-modal";
import { LinkModal } from "@/components/modals/link-modal";
import { EditLinkModal } from "@/components/modals/edit-link-modal";
import { MediaModal } from "@/components/modals/media-modal";
import { WeeklyRolesModal } from "@/components/modals/weekly-roles-modal";
import { SpecialEventModal } from "@/components/modals/special-event-modal";
import { NoticeDetailModal, ScheduleContentDisplay } from "@/components/modals/notice-detail-modal";
import { UsersPanel } from "@/components/users-panel";
import { LogsPanel } from "@/components/admin/logs-panel";
import { ReportsPanel } from "@/components/admin/reports-panel";
import { EventsPanel } from "@/components/events-panel";
import { LazyImage } from "@/components/lazy-image";
import { AdvancedOptions as AdvancedOptionsFields, type AdvancedOptionsState } from "@/components/shared/advanced-options";
import { CalendarClock as CalendarCountdown, Heart, Bookmark, Image as ImageIcon } from "lucide-react";
import { getFieldConfig, parseScheduleFields as parseScheduleFieldsShared, isScheduleContent, MIDWEEK_FIELD_TEMPLATES, PUBLIC_TALK_FIELD_TEMPLATES, type ScheduleVariant } from "@/lib/schedule-field-config";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  nameTl?: string | null;
  slug: string;
  color?: string | null;
  icon?: string | null;
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
  linkIcon?: string | null;
  galleryUrls?: string | null;
  isPinned: boolean;
  isPublished: boolean;
  isPublic: boolean;
  isArchived?: boolean;
  archivedAt?: string | null;
  language: string;
  expiresAt?: string | null;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  showOnCalendar?: boolean;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  categoryId?: string | null;
  createdAt: string;
  updatedAt?: string;
  category?: {
    id: string;
    name: string;
    nameTl?: string | null;
    color?: string | null;
    icon?: string | null;
  } | null;
}

interface Meeting {
  id: string;
  meetingType: string;
  date: string;
  time: string;
  location?: string | null;
  scheduleFileUrl?: string | null;
  scheduleFileName?: string | null;
  isPublished: boolean;
}

interface SpecialEvent {
  id: string;
  title: string;
  titleTl?: string | null;
  type: string;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  imageUrl?: string | null;
  showOnNoticeboard?: boolean;
}

interface RoleAssignment {
  id: string;
  title: string;
  meetingType: string;
  weekDate: string | null;
  fileUrl: string | null;
  fileName: string | null;
  ocrText: string | null;
  ocrStatus: string;
  isPublished: boolean;
  showOnNoticeboard: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ────────────────────────────────────────────

const EVENT_TYPE_COLORS: Record<string, { bg: string; border: string; accent: string; dot: string; label: string; labelTl: string }> = {
  convention: { bg: "from-blue-50 to-blue-50 dark:from-blue-950/30 dark:to-blue-950/20", border: "border-blue-200 dark:border-blue-800/50", accent: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500", label: "Convention", labelTl: "Kumbensiyon" },
  assembly: { bg: "from-green-50 to-green-50 dark:from-green-950/30 dark:to-green-950/20", border: "border-green-200 dark:border-green-800/50", accent: "text-green-700 dark:text-green-300", dot: "bg-green-500", label: "Circuit Assembly", labelTl: "Asemblya ng Sirkito" },
  co_visit: { bg: "from-purple-50 to-purple-50 dark:from-purple-950/30 dark:to-purple-950/20", border: "border-purple-200 dark:border-purple-800/50", accent: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500", label: "CO Visit", labelTl: "Bisita ng CO" },
  memorial: { bg: "from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/20", border: "border-rose-200 dark:border-rose-800/50", accent: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500", label: "Memorial", labelTl: "Pag-alala" },
  other: { bg: "from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/20", border: "border-slate-200 dark:border-slate-800/50", accent: "text-slate-700 dark:text-slate-300", dot: "bg-slate-500", label: "Special Event", labelTl: "Espesyal na Kaganapan" },
};

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(str: string) { return new Date(str + "T00:00:00"); }
function getDayNum(str: string) { return parseDate(str).getDate(); }
function getMonthShort(str: string) { return MONTHS_SHORT[parseDate(str).getMonth()]; }

function formatDateRange(start: string, end?: string | null): string {
  const s = parseDate(start).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (!end || end === start) return s;
  return `${s} — ${parseDate(end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

interface RoleLine { name: string; assignee: string }

function parseRoleLines(text: string): RoleLine[] {
  if (!text || !text.trim()) return [];
  const lines = text.split("\n");
  const result: RoleLine[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[:\-—]|\t/).map(s => s.trim());
    if (parts.length >= 2) {
      result.push({ name: parts[0], assignee: parts.slice(1).join(" ") });
    } else {
      result.push({ name: trimmed, assignee: "" });
    }
  }
  return result;
}

function roleLinesToText(lines: RoleLine[]): string {
  return lines
    .filter(l => l.name.trim() || l.assignee.trim())
    .map(l => l.assignee.trim() ? `${l.name.trim()}: ${l.assignee.trim()}` : l.name.trim())
    .join("\n");
}

function rolesToJson(weekDate: string, rolesText: string): string {
  const parsed = parseRoleLines(rolesText);
  const obj: Record<string, string> = {};
  obj["Date"] = weekDate || "";
  for (const r of parsed) {
    if (r.name.trim()) obj[r.name.trim()] = r.assignee.trim() || "___";
  }
  return JSON.stringify(obj, null, 2);
}

function timeAgo(dateStr: string, lang: "en" | "tl"): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (lang === "tl") {
    if (diffMin < 1) return "ngayon";
    if (diffMin < 60) return `${diffMin} min ang nakalipas`;
    if (diffHr < 24) return `${diffHr} oras ang nakalipas`;
    if (diffDay < 7) return `${diffDay} araw ang nakalipas`;
    return new Date(dateStr).toLocaleDateString("fil-PH", { month: "short", day: "numeric" });
  }
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isRecentlyUpdated(updatedAt?: string): boolean {
  if (!updatedAt) return false;
  return (Date.now() - new Date(updatedAt).getTime()) / 3600000 < 48;
}

function isImageFile(url?: string | null, fileName?: string | null): boolean {
  if (!url) return false;
  const ext = url.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"].includes(ext || "")) return true;
  // For DB-served files (/api/files/[id]), check fileName instead
  if (fileName) {
    const fExt = fileName.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"].includes(fExt || "");
  }
  return false;
}

function isPdfFile(url?: string | null, fileName?: string | null): boolean {
  if (!url) return false;
  const ext = url.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return true;
  // For DB-served files (/api/files/[id]), check fileName instead
  if (fileName) {
    const fExt = fileName.split(".").pop()?.toLowerCase();
    return fExt === "pdf";
  }
  return false;
}

function getNoticeImages(n: Notice): string[] {
  const primary = isImageFile(n.thumbnailUrl, n.fileName) ? n.thumbnailUrl! : (isImageFile(n.fileUrl, n.fileName) ? n.fileUrl! : null);
  let gallery: string[] = [];
  if (n.galleryUrls) {
    try {
      const parsed = JSON.parse(n.galleryUrls);
      if (Array.isArray(parsed)) gallery = parsed.filter((u): u is string => typeof u === "string");
    } catch { /* ignore malformed gallery data */ }
  }
  return primary ? [primary, ...gallery.filter(u => u !== primary)] : gallery;
}

function noticeHasMedia(n: Notice): boolean {
  return (isPdfFile(n.fileUrl, n.fileName) && !!n.fileUrl) || getNoticeImages(n).length > 0;
}

function getCountdown(targetDate: string): { days: number; hours: number; mins: number; isPast: boolean } {
  const target = new Date(targetDate + "T00:00:00").getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff < 0) return { days: 0, hours: 0, mins: 0, isPast: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return { days, hours, mins, isPast: false };
}

function shareUrl(url: string, title: string, origin?: string) {
  const base = origin || window.location.origin;
  const fullUrl = base + url;
  if (navigator.share) {
    navigator.share({ title, url: fullUrl }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(fullUrl);
  }
}

// ─── Main Component ──────────────────────────────────────

export default function PublicNoticeboard() {
  const { data: session } = useSession();
  const sessionUserId = (session?.user as { id?: string })?.id;
  const router = useRouter();
  const language: "en" = "en";
  const [notices, setNotices] = useState<Notice[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [events, setEvents] = useState<SpecialEvent[]>([]);
  const [roles, setRoles] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archivedNotices, setArchivedNotices] = useState<Notice[]>([]);
  const [showMobileCalendar, setShowMobileCalendar] = useState(false);
  const [showQuickLinks, setShowQuickLinks] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; title: string; type: "new" | "updated"; timestamp: number }[]>([]);
  const [dismissedNotifIds, setDismissedNotifIds] = useState<Set<string>>(new Set());
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const prevNoticeIdsRef = useRef<Set<string> | null>(null);
  const prevNoticeUpdatesRef = useRef<Record<string, string> | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [detailNotice, setDetailNotice] = useState<Notice | null>(null);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [changePwCurrent, setChangePwCurrent] = useState("");
  const [changePwNew, setChangePwNew] = useState("");
  const [changePwConfirm, setChangePwConfirm] = useState("");
  const [changePwError, setChangePwError] = useState("");
  const [changePwLoading, setChangePwLoading] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"meetings" | "display" | "conventions" | "map" | "events" | "files" | "backup" | "users" | "reports" | "logs">("meetings");
  const [theme, setTheme] = useState<"light" | "dark" | "modern">("light");
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{ images: { url: string; title?: string }[]; index: number } | null>(null);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const [passcodeUnlocked, setPasscodeUnlocked] = useState(false);

  const openPdf = useCallback((url: string, title: string) => {
    setPdfViewer({ url, title });
  }, []);

  const openPhoto = useCallback((url: string, title: string) => {
    setPhotoViewer({ images: [{ url, title }], index: 0 });
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarked(prev => {
      const next = new Set(prev);
      const isAdding = !next.has(id);
      if (isAdding) next.add(id); else next.delete(id);
      localStorage.setItem("bookmarks", JSON.stringify([...next]));
      // Sync to server if logged in
      if (sessionUserId) {
        fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noticeId: id, action: isAdding ? "add" : "remove" }),
        }).catch(() => {});
      }
      return next;
    });
  }, [sessionUserId]);

  const { toast } = useToast();
  const [editingNotice, setEditingNotice] = useState<Partial<Notice> | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [showEditAiSection, setShowEditAiSection] = useState(false);
  const [editAiPasteText, setEditAiPasteText] = useState("");
  const [editAiCopying, setEditAiCopying] = useState(false);
  const [editAiProcessing, setEditAiProcessing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState<null | "midweek" | "public-talk">(null);
  const [editingSchedule, setEditingSchedule] = useState<Notice | null>(null);
  const [showMediaModal, setShowMediaModal] = useState<null | { defaultCategoryId?: string; defaultTitle?: string } | true>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showWeeklyRolesModal, setShowWeeklyRolesModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleAssignment | null>(null);
  const [roleEditMode, setRoleEditMode] = useState<"list" | "raw">("list");
  const [showRoleJson, setShowRoleJson] = useState(false);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [showRoleGrid, setShowRoleGrid] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [showSpecialEventModal, setShowSpecialEventModal] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SpecialEvent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<Notice | null>(null);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedNoticeIds, setSelectedNoticeIds] = useState<Set<string>>(new Set());
  const [bulkDeleteNoticesConfirm, setBulkDeleteNoticesConfirm] = useState(false);

  const handleEditNotice = useCallback((notice: Notice) => {
    setDetailNotice(null);
    if (notice.type === "link") {
      setEditingLink(notice);
    } else if (
      (notice.title || "").startsWith("Midweek Meeting Schedule") ||
      (notice.title || "").startsWith("Public Talk Schedule") ||
      isScheduleContent(notice.content || notice.description || "")
    ) {
      // Schedule notices edit in the schedule modal with the editable field list
      setEditingSchedule(notice);
      setShowScheduleModal((notice.title || "").startsWith("Public Talk Schedule") ? "public-talk" : "midweek");
    } else {
      setEditingNotice({ ...notice });
      setEditAiPasteText("");
      // Auto-expand AI section for schedule notices with an image but no content
      const titleLower = (notice.title || "").toLowerCase();
      const isSchedule = titleLower.includes("midweek") || titleLower.includes("public talk") || titleLower.includes("schedule");
      const hasImage = !!notice.fileUrl && isImageFile(notice.fileUrl, notice.fileName);
      const hasNoContent = !notice.content && !notice.description;
      setShowEditAiSection(isSchedule && hasImage && hasNoContent);
      setEditOpen(true);
    }
  }, []);

  const handleEditEvent = useCallback((eventId: string) => {
    setEditEventId(eventId);
    setShowSpecialEventModal(true);
  }, []);

  const handleEditNoticeById = useCallback((noticeId: string) => {
    const notice = notices.find(n => n.id === noticeId);
    if (notice) {
      handleEditNotice(notice);
    }
  }, [notices, handleEditNotice]);

  const handleSaveNotice = async () => {
    if (!editingNotice?.title) return;
    const noticeWithAutoType = { ...editingNotice, type: autoType(editingNotice) };
    const method = noticeWithAutoType.id ? "PUT" : "POST";
    const url = noticeWithAutoType.id ? `/api/notices/${noticeWithAutoType.id}` : "/api/notices";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noticeWithAutoType),
      });
      if (res.ok) {
        toast({ title: editingNotice.id ? "Notice updated" : "Notice created" });
        pushNotification(editingNotice.title || "Notice", editingNotice.id ? "updated" : "new");
        setEditOpen(false);
        setEditingNotice(null);
        fetchData();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error saving notice", variant: "destructive" });
    }
  };

  const handleDeleteNotice = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/notices/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Notice deleted" });
        pushNotification("Notice deleted", "updated");
        setDeleteId(null);
        fetchData();
      }
    } catch {
      toast({ title: "Error deleting notice", variant: "destructive" });
    }
  };

  const handleBulkDeleteNotices = async () => {
    if (selectedNoticeIds.size === 0) return;
    try {
      let deleted = 0;
      for (const id of selectedNoticeIds) {
        const res = await fetch(`/api/notices/${id}`, { method: "DELETE" });
        if (res.ok) deleted++;
      }
      toast({ title: `${deleted} notice(s) deleted` });
      pushNotification(`${deleted} notices deleted`, "updated");
      setSelectedNoticeIds(new Set());
      setBulkDeleteNoticesConfirm(false);
      setBulkSelectMode(false);
      fetchData();
    } catch {
      toast({ title: "Error deleting notices", variant: "destructive" });
    }
  };

  const toggleNoticeSelection = (id: string) => {
    setSelectedNoticeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllNotices = () => {
    const allIds = [...pinnedNotices, ...regularNotices].map(n => n.id);
    if (selectedNoticeIds.size === allIds.length) {
      setSelectedNoticeIds(new Set());
    } else {
      setSelectedNoticeIds(new Set(allIds));
    }
  };

  const handleTogglePin = async (notice: Notice) => {
    try {
      const res = await fetch(`/api/notices/${notice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...notice, isPinned: !notice.isPinned }),
      });
      if (res.ok) {
        toast({ title: notice.isPinned ? "Unpinned" : "Pinned" });
        pushNotification(notice.title || "Notice", "updated");
        fetchData();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleArchive = async (notice: Notice) => {
    try {
      const res = await fetch(`/api/notices/${notice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...notice, isArchived: true }),
      });
      if (res.ok) {
        toast({ title: "Archived" });
        pushNotification(notice.title || "Notice archived", "updated");
        if (showArchive) fetchArchived();
        fetchData();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteRoleId) return;
    try {
      const res = await fetch(`/api/roles/${deleteRoleId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Role assignment deleted" });
        setDeleteRoleId(null);
        fetchData();
      }
    } catch {
      toast({ title: "Error deleting role", variant: "destructive" });
    }
  };

  const handleSaveRole = async () => {
    if (!editingRole) return;
    try {
      const res = await fetch(`/api/roles/${editingRole.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingRole.title,
          meetingType: editingRole.meetingType,
          weekDate: editingRole.weekDate,
          ocrText: editingRole.ocrText,
        }),
      });
      if (res.ok) {
        toast({ title: "Role assignment updated" });
        setEditingRole(null);
        fetchData();
      }
    } catch {
      toast({ title: "Error updating role", variant: "destructive" });
    }
  };

  const handleBulkDeleteRoles = async () => {
    for (const id of selectedRoleIds) {
      try {
        await fetch(`/api/roles/${id}`, { method: "DELETE" });
      } catch { /* ignore */ }
    }
    toast({ title: `${selectedRoleIds.size} role(s) deleted` });
    setSelectedRoleIds(new Set());
    setBulkDeleteConfirm(false);
    fetchData();
  };

  const handleCopySelectedRolesJson = () => {
    const selected = roles.filter(r => selectedRoleIds.has(r.id));
    const json = selected.map(r => ({
      weekDate: r.weekDate,
      meetingType: r.meetingType,
      roles: r.ocrText,
    }));
    navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    toast({ title: `Copied ${selected.length} role(s) as JSON` });
  };

  const handleCreateNotice = useCallback(() => {
    setShowAddPicker(true);
  }, []);

  const handleAddItemSelect = useCallback((choice: AddItemChoice) => {
    setShowAddPicker(false);
    switch (choice.type) {
      case "midweek-schedule":
        setShowScheduleModal("midweek");
        break;
      case "public-talk-schedule":
        setShowScheduleModal("public-talk");
        break;
      case "weekly-roles":
        setShowWeeklyRolesModal(true);
        break;
      case "event":
        setEditEventId(null);
        setShowSpecialEventModal(true);
        break;
      case "upload":
        setShowMediaModal(true);
        break;
      case "schedule":
        setShowMediaModal({});
        break;
      case "announcement":
        setShowAnnouncementModal(true);
        break;
      case "link":
        setShowLinkModal(true);
        break;
      default:
        break;
    }
  }, []);

  const handleSelectCategory = useCallback((categoryId: string | null) => {
    setEditingNotice({
      title: "",
      type: "text",
      isPinned: false,
      isPublished: true,
      isPublic: true,
      language: "en",
      showOnCalendar: false,
      categoryId,
    });
    setShowCreateModal(false);
    setShowEditAiSection(false);
    setEditAiPasteText("");
    setEditOpen(true);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const detectType = (file: File): "text" | "pdf" | "image" | "link" => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
    return "text";
  };

  const autoType = (notice: typeof editingNotice): "text" | "pdf" | "image" | "link" => {
    if (notice?.fileUrl) {
      if (isImageFile(notice.fileUrl, notice.fileName)) return "image";
      if (isPdfFile(notice.fileUrl, notice.fileName)) return "pdf";
      return "text";
    }
    if (notice?.linkUrl) return "link";
    return "text";
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "notices");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        const detectedType = detectType(file);
        setEditingNotice((prev) => prev ? {
          ...prev,
          fileUrl: data.url,
          fileName: file.name,
          type: detectedType,
          thumbnailUrl: detectedType === "image" ? data.url : prev.thumbnailUrl,
          title: prev.title || file.name.replace(/\.[^.]+$/, ""),
        } : prev);
        toast({ title: "File uploaded" });
      } else {
        toast({ title: "Upload failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("bookmarks");
    if (stored) setBookmarked(new Set(JSON.parse(stored)));
    // Fetch from server if logged in
    if (sessionUserId) {
      fetch("/api/bookmarks").then(r => r.ok ? r.json() : []).then((ids: string[]) => {
        if (ids.length > 0) {
          setBookmarked(new Set(ids));
          localStorage.setItem("bookmarks", JSON.stringify(ids));
        }
      }).catch(() => {});
    }
  }, [sessionUserId]);

  const userRole = (session?.user as { role?: string })?.role;
  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const isSuperAdmin = userRole === "super_admin";
  const mustChangePassword = (session?.user as { mustChangePassword?: boolean })?.mustChangePassword === true;
  const isLoggedIn = !!sessionUserId;
  const needsPasscode = !!settings.noticeboardPasscode && !isLoggedIn && !passcodeUnlocked;

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "modern") {
      setTheme(stored);
      document.documentElement.classList.add(stored);
    }
  }, []);

  const switchTheme = (nt: "light" | "dark" | "modern") => {
    setTheme(nt); localStorage.setItem("theme", nt);
    document.documentElement.classList.remove("dark", "modern");
    if (nt !== "light") document.documentElement.classList.add(nt);
    setThemeDropdownOpen(false);
  };

  const fetchNotices = useCallback(async () => {
    try {
      const res = await fetch("/api/notices?visitor=true", { cache: "no-store" });
      if (res.ok) {
        const newNotices = await res.json();
        const newIds = new Set<string>(newNotices.map((nn: Notice) => nn.id));
        const nowUpdates: Record<string, string> = {};
        newNotices.forEach((nn: Notice) => {
          nowUpdates[nn.id] = nn.updatedAt || nn.createdAt;
        });
        prevNoticeIdsRef.current = newIds;
        prevNoticeUpdatesRef.current = nowUpdates;
        setNotices(newNotices);
        setServerOnline(true);
      } else {
        setServerOnline(false);
      }
    } catch (e) {
      console.error("Fetch notices error:", e);
      setServerOnline(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [n, c, m, e, r, s] = await Promise.all([
        fetch("/api/notices?visitor=true", { cache: "no-store" }), fetch("/api/categories", { cache: "no-store" }),
        fetch("/api/meetings?published=true", { cache: "no-store" }), fetch("/api/events", { cache: "no-store" }),
        fetch("/api/roles?visitor=true", { cache: "no-store" }), fetch("/api/settings", { cache: "no-store" }),
      ]);
      setServerOnline(n.ok && c.ok && m.ok && e.ok && r.ok && s.ok);
      if (n.ok) {
        const newNotices = await n.json();
        if (prevNoticeIdsRef.current !== null) {
          const newIds = new Set<string>(newNotices.map((nn: Notice) => nn.id));
          const updates: { id: string; title: string; type: "new" | "updated" }[] = [];
          const nowUpdates: Record<string, string> = {};
          newNotices.forEach((nn: Notice) => {
            nowUpdates[nn.id] = nn.updatedAt || nn.createdAt;
            if (!prevNoticeIdsRef.current!.has(nn.id)) {
              updates.push({ id: nn.id, title: nn.title, type: "new" });
            } else if (prevNoticeUpdatesRef.current && prevNoticeUpdatesRef.current[nn.id] !== (nn.updatedAt || nn.createdAt)) {
              updates.push({ id: nn.id, title: nn.title, type: "updated" });
            }
          });
          if (updates.length > 0) {
            setNotifications(prev => [...updates.map(u => ({ ...u, timestamp: Date.now() })), ...prev].slice(0, 20));
          }
          prevNoticeIdsRef.current = newIds;
          prevNoticeUpdatesRef.current = nowUpdates;
        } else {
          prevNoticeIdsRef.current = new Set(newNotices.map((nn: Notice) => nn.id));
          prevNoticeUpdatesRef.current = Object.fromEntries(newNotices.map((nn: Notice) => [nn.id, nn.updatedAt || nn.createdAt]));
        }
        setNotices(newNotices);
      }
      if (c.ok) setCategories(await c.json());
      if (m.ok) setMeetings(await m.json());
      if (e.ok) setEvents(await e.json());
      if (r.ok) setRoles(await r.json());
      if (s.ok) setSettings(await s.json());
    } catch (e) {
      console.error("Fetch error:", e);
      setServerOnline(false);
    }
    finally { setLoading(false); }
  }, []);

  const fetchArchived = useCallback(async () => {
    try {
      const res = await fetch("/api/notices?archived=true");
      if (res.ok) setArchivedNotices(await res.json());
    } catch (e) { console.error("Fetch archived error:", e); }
  }, []);

  const handleToggleArchive = useCallback(() => {
    setShowArchive(prev => {
      if (!prev) fetchArchived();
      return !prev;
    });
  }, [fetchArchived]);

  const handleRestore = async (notice: Notice) => {
    try {
      const res = await fetch(`/api/notices/${notice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...notice, isArchived: false }),
      });
      if (res.ok) {
        toast({ title: "Restored" });
        fetchArchived();
        fetchData();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fast health check every 5 seconds — quickly detects when server goes down
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        setServerOnline(res.ok);
      } catch {
        setServerOnline(false);
      }
    };
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll for updates as a fallback (SSE below handles instant updates)
  useEffect(() => {
    const interval = setInterval(() => fetchData(), serverOnline ? 30000 : 10000);
    return () => clearInterval(interval);
  }, [fetchData, serverOnline]);

  // Live updates — SSE stream pushes a new data version the instant anything changes
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let lastVersion: string | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      es = new EventSource("/api/stream");
      es.onmessage = (e) => {
        setServerOnline(true);
        if (lastVersion !== null && e.data !== lastVersion) fetchData();
        lastVersion = e.data;
      };
      es.onopen = () => setServerOnline(true);
      es.onerror = () => {
        es?.close();
        es = null;
        // Refetch on reconnect in case we missed changes while disconnected
        lastVersion = null;
        if (!closed) retry = setTimeout(connect, 3000);
      };
    };
    connect();

    return () => {
      closed = true;
      es?.close();
      if (retry) clearTimeout(retry);
    };
  }, [fetchData]);

  // Refetch immediately when the tab regains focus or becomes visible
  useEffect(() => {
    let lastFetch = Date.now();
    const refetchIfStale = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch > 3000) {
        lastFetch = Date.now();
        fetchData();
      }
    };
    window.addEventListener("focus", refetchIfStale);
    document.addEventListener("visibilitychange", refetchIfStale);
    return () => {
      window.removeEventListener("focus", refetchIfStale);
      document.removeEventListener("visibilitychange", refetchIfStale);
    };
  }, [fetchData]);

  const today = new Date().toISOString().split("T")[0];

  const upcomingMeetings = meetings.filter(m => m.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const midweekMeetings = upcomingMeetings.filter(m => m.meetingType === "midweek").slice(0, 2);
  const weekendMeetings = upcomingMeetings.filter(m => m.meetingType === "weekend").slice(0, 2);

  const upcomingEvents = events
    .filter(e => e.showOnNoticeboard !== false)
    .filter(e => (e.endDate || e.startDate) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const pinnedNotices = notices.filter(n => n.isPinned);
  // Identify schedule notices by title (not category, since categories may not exist)
  const isScheduleNotice = (n: Notice) =>
    n.eventStartDate &&
    n.title.toLowerCase().includes("schedule") && !n.isArchived && n.isPublished !== false;
  const midweekSchedules = notices.filter(n => isScheduleNotice(n) && n.title.toLowerCase().includes("midweek"))
    .sort((a, b) => (a.eventStartDate || "").localeCompare(b.eventStartDate || ""));
  const publicTalkSchedules = notices.filter(n => isScheduleNotice(n) && n.title.toLowerCase().includes("public talk"))
    .sort((a, b) => (a.eventStartDate || "").localeCompare(b.eventStartDate || ""));
  const regularNotices = notices.filter(n => !n.isPinned && !isScheduleNotice(n));
  const activeNotifCount = notifications.filter(n => !dismissedNotifIds.has(n.id)).length;

  const pushNotification = useCallback((title: string, type: "new" | "updated" = "new") => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setNotifications(prev => [{ id, title, type, timestamp: Date.now() }, ...prev].slice(0, 20));
  }, []);

  // Group notices by category
  const noticesByCategory = categories.map(cat => ({
    category: cat,
    items: regularNotices.filter(n => n.category?.id === cat.id),
  })).filter(g => g.items.length > 0);

  const uncategorizedNotices = regularNotices.filter(n => !n.category && n.type !== "link");

  // Filter by search + category
  const filterFn = (n: Notice) => {
    if (activeCategory && n.category?.id !== activeCategory) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.titleTl?.toLowerCase().includes(q) ||
      n.description?.toLowerCase().includes(q) || n.descriptionTl?.toLowerCase().includes(q) ||
      n.content?.toLowerCase().includes(q);
  };

  // Count notices per category for sidebar badges
  const categoryCounts: Record<string, number> = {};
  for (const g of noticesByCategory) {
    categoryCounts[g.category.id] = g.items.filter(filterFn).length;
  }

  const highlight = (text: string): React.ReactNode => {
    if (!search || !text) return text;
    const q = search.toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded px-0.5">{text.slice(idx, idx + search.length)}</mark>
      {text.slice(idx + search.length)}
    </>;
  };



  const formatDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/40 bg-card/60 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/jwnb_logo.png" alt="Logo" className="h-11 w-11 rounded-2xl object-cover" />
              <Skeleton className="h-7 w-52 rounded-lg" />
            </div>
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-3 sm:px-6 py-8">
          <Skeleton className="h-12 w-full max-w-xl mx-auto rounded-2xl mb-10" />
          <div className="columns-1 sm:columns-2 md:columns-3 2xl:columns-4 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
            {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className={`w-full rounded-2xl ${i % 3 === 0 ? 'h-64' : i % 2 === 0 ? 'h-48' : 'h-56'}`} />)}
          </div>
        </main>
      </div>
    );
  }

  if (needsPasscode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3">
            <img src="/jwnb_logo.png" alt="Logo" className="h-16 w-16 rounded-2xl object-cover" />
            <h1 className="text-lg font-bold text-center">
              {settings.congregationTitle || t("noticeboardTitle", language)}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span className="text-sm">Passcode required</span>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (passcodeInput === settings.noticeboardPasscode) {
                setPasscodeUnlocked(true);
                setPasscodeError(false);
              } else {
                setPasscodeError(true);
              }
            }}
            className="space-y-3"
          >
            <Input
              type="password"
              value={passcodeInput}
              onChange={(e) => { setPasscodeInput(e.target.value); setPasscodeError(false); }}
              placeholder="Enter passcode"
              className="rounded-xl text-center text-lg tracking-widest"
              autoFocus
            />
            {passcodeError && (
              <p className="text-xs text-red-500 text-center">Incorrect passcode. Please try again.</p>
            )}
            <Button type="submit" className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700">
              Enter Noticeboard
            </Button>
          </form>
          <div className="text-center">
            <button
              onClick={() => router.push("/login")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Admin login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/60 backdrop-blur-xl sticky top-0 z-50" style={settings.topBarColor ? { backgroundColor: settings.topBarColor } : undefined}>
        {/* Top row: logo + actions */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden flex items-center justify-center h-10 w-10 sm:h-9 sm:w-9 rounded-xl hover:bg-accent transition-colors shrink-0">
            <Menu className="h-5 w-5" />
          </button>
          <img src="/jwnb_logo.png" alt="Logo" className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl object-cover shrink-0" />
          <div className="hidden md:block min-w-0 shrink-0">
            <h1 className="text-sm font-bold leading-tight truncate tracking-tight">
              {settings.congregationTitle || t("noticeboardTitle", language)}
            </h1>
            {settings.congregationTitle && (
              <p className="text-[10px] text-muted-foreground font-medium">{t("noticeboardTitle", language)}</p>
            )}
          </div>
          {/* Search bar — desktop only in top row */}
          <div className="hidden sm:block relative flex-1 min-w-0 max-w-md mx-auto">
            <Search className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input placeholder={t("searchNotices", language)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 sm:pl-10 h-9 sm:h-10 rounded-xl bg-background border-border/60 text-sm" />
          </div>
          {/* Quick links in header bar */}
          <div className="hidden lg:flex items-center gap-1 shrink-0">
            {notices.filter(n => n.type === "link" && !n.categoryId && !n.isArchived && n.isPublished !== false).slice(0, 6).map(n => (
              <a
                key={n.id}
                href={n.linkUrl || n.content || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-accent transition-colors shrink-0"
                title={n.linkLabel || n.title}
              >
                {n.linkIcon ? (
                  <img src={n.linkIcon} alt="" className="h-6 w-6 rounded-md" />
                ) : (
                  <div className="h-6 w-6 rounded-md bg-cyan-500 text-white flex items-center justify-center">
                    <Link2 className="h-3.5 w-3.5" />
                  </div>
                )}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
            {isAdmin && (
              <Button onClick={() => setShowAddPicker(true)} className="rounded-xl h-9 w-9 sm:w-auto sm:h-8 p-0 sm:p-2 bg-indigo-600 hover:bg-indigo-700 shrink-0">
                <Plus className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Add</span>
              </Button>
            )}
            <div className="relative">
              <Button variant="ghost" size="icon" onClick={() => setShowNotifPanel(o => !o)} className="rounded-xl h-10 w-10 sm:h-9 sm:w-9 relative" title="Notifications">
                <Bell className="h-[18px] w-[18px]" />
                {activeNotifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {activeNotifCount > 9 ? "9+" : activeNotifCount}
                  </span>
                )}
              </Button>
              {showNotifPanel && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifPanel(false)} />
                  <div className="fixed sm:absolute bottom-0 left-0 right-0 sm:bottom-auto sm:right-0 sm:top-full sm:mt-1 z-50 sm:w-[calc(100vw-1.5rem)] max-w-80 sm:max-h-96 max-h-[70dvh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-border/40 bg-card shadow-xl">
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40 sticky top-0 bg-card z-10">
                      <span className="text-sm font-semibold">Notifications</span>
                      {activeNotifCount > 0 && (
                        <button
                          onClick={() => {
                            setDismissedNotifIds(prev => new Set([...prev, ...notifications.map(n => n.id)]));
                          }}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                        </button>
                      )}
                    </div>
                    {activeNotifCount === 0 ? (
                      <div className="px-3 py-8 text-center">
                        <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No new notifications</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/20">
                        {notifications.filter(n => !dismissedNotifIds.has(n.id)).slice(0, 15).map(n => (
                          <div
                            key={n.id}
                            className={`flex items-start gap-2.5 px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors ${
                              n.type === "new" ? "bg-emerald-50/50 dark:bg-emerald-950/10" : "bg-amber-50/50 dark:bg-amber-950/10"
                            }`}
                          >
                            {n.type === "new" ? (
                              <Sparkles className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <Edit className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-xs">{n.type === "new" ? "New" : "Updated"}</span>
                              <p className="text-muted-foreground text-xs truncate">{n.title}</p>
                              {n.timestamp && (
                                <span className="text-[10px] text-muted-foreground/60">
                                  {new Date(n.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => setDismissedNotifIds(prev => new Set(prev).add(n.id))}
                              className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="relative hidden sm:block">
              <Button variant="ghost" size="icon" onClick={() => setThemeDropdownOpen(o => !o)} className="rounded-xl h-9 w-9" title="Theme">
                {theme === "light" ? <Sun className="h-[18px] w-[18px]" /> : theme === "dark" ? <Moon className="h-[18px] w-[18px]" /> : <Sparkles className="h-[18px] w-[18px]" />}
              </Button>
              {themeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setThemeDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-xl border border-border/40 bg-card shadow-xl overflow-hidden">
                    <button onClick={() => switchTheme("light")} className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${theme === "light" ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400" : "hover:bg-accent"}`}>
                      <Sun className="h-4 w-4" /> Light
                    </button>
                    <button onClick={() => switchTheme("dark")} className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${theme === "dark" ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400" : "hover:bg-accent"}`}>
                      <Moon className="h-4 w-4" /> Dark
                    </button>
                    <button onClick={() => switchTheme("modern")} className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${theme === "modern" ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400" : "hover:bg-accent"}`}>
                      <Sparkles className="h-4 w-4" /> Modern
                    </button>
                  </div>
                </>
              )}
            </div>
            {!session ? (
              <Button variant="outline" size="sm" onClick={() => setShowLoginModal(true)} className="rounded-xl h-9 w-9 sm:w-auto sm:h-8 p-0 sm:p-2">
                <LogIn className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">{t("login", language)}</span>
              </Button>
            ) : (
              <>
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => setShowSettingsModal(true)} className="rounded-xl h-9 w-9 sm:w-auto sm:h-8 p-0 sm:p-2">
                    <Settings className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Manage</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })} className="rounded-xl h-9 w-9 sm:w-auto sm:h-8 p-0 sm:p-2">
                  <LogOut className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            )}
          </div>
        </div>
        {/* Mobile search row */}
        <div className="sm:hidden px-3 pb-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input placeholder={t("searchNotices", language)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl bg-background border-border/60 text-sm w-full" />
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 sm:w-72 bg-card border-r border-border/40 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border/40">
              <span className="font-bold text-sm">Navigation</span>
              <button onClick={() => setSidebarOpen(false)} className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-accent transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent
              onSectionJump={(id) => { setSidebarOpen(false); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); }}
              categories={categories}
              upcomingEventsCount={upcomingEvents.length}
              pinnedCount={pinnedNotices.filter(filterFn).length}
              rolesCount={roles.length}
              hasMap={!!(settings.mapEmbedUrl || (settings.mapLat && settings.mapLng))}
              isAdmin={isAdmin}
              onOpenSettings={() => { setSidebarOpen(false); setShowSettingsModal(true); }}
              onToggleArchive={handleToggleArchive}
              showArchive={showArchive}
              activeCategory={activeCategory}
              onCategoryClick={(id: string | null) => { setActiveCategory(id); setSidebarOpen(false); if (id) setTimeout(() => document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); }}
              categoryCounts={categoryCounts}
              serverOnline={serverOnline}
            />
            {/* Theme toggle — mobile sidebar only */}
            <div className="mt-auto p-4 border-t border-border/40">
              <div className="flex rounded-xl border border-border/40 overflow-hidden">
                <button
                  onClick={() => switchTheme("light")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${theme === "light" ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600" : "hover:bg-accent"}`}
                >
                  <Sun className="h-4 w-4" /> Light
                </button>
                <button
                  onClick={() => switchTheme("dark")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-l border-border/40 ${theme === "dark" ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600" : "hover:bg-accent"}`}
                >
                  <Moon className="h-4 w-4" /> Dark
                </button>
                <button
                  onClick={() => switchTheme("modern")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-l border-border/40 ${theme === "modern" ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600" : "hover:bg-accent"}`}
                >
                  <Sparkles className="h-4 w-4" /> Modern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-[65px] h-[calc(100vh-65px)] border-r border-border/40 p-4" style={settings.sideBarColor ? { backgroundColor: settings.sideBarColor } : undefined}>
          <SidebarContent
            onSectionJump={(id) => { setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); }}
            categories={categories}
            upcomingEventsCount={upcomingEvents.length}
            pinnedCount={pinnedNotices.filter(filterFn).length}
            rolesCount={roles.length}
            hasMap={!!(settings.mapEmbedUrl || (settings.mapLat && settings.mapLng))}
            isAdmin={isAdmin}
            onOpenSettings={() => setShowSettingsModal(true)}
            onToggleArchive={handleToggleArchive}
            showArchive={showArchive}
            activeCategory={activeCategory}
            onCategoryClick={(id: string | null) => { setActiveCategory(id); if (id) setTimeout(() => document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); }}
            categoryCounts={categoryCounts}
            serverOnline={serverOnline}
          />
        </aside>

        {/* Desktop calendar column — sticky like the sidebar */}
        <div className="hidden lg:flex flex-col w-[320px] xl:w-[360px] 2xl:w-[400px] shrink-0 sticky top-[65px] h-[calc(100vh-65px)] border-r border-border/40 overflow-visible z-20">
          <div className="flex items-center gap-3 p-4 pb-2 shrink-0">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5 text-indigo-500" />
            </div>
            <h2 className="text-base font-bold tracking-tight">Calendar</h2>
          </div>
          <div className="flex-1 px-4 pb-4 overflow-visible">
            <CalendarView language={language} isAdmin={isAdmin} onEditEvent={handleEditEvent} onEditNotice={handleEditNoticeById} />
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-3 sm:px-6 py-4 sm:py-6 w-full pb-20 lg:pb-6">
          {/* Notification banners */}
          {notifications.filter(n => !dismissedNotifIds.has(n.id)).length > 0 && (
            <div className="space-y-2 mb-4">
              {notifications.filter(n => !dismissedNotifIds.has(n.id)).slice(0, 3).map(n => (
                <div
                  key={n.id}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm fade-in-up ${
                    n.type === "new"
                      ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20"
                      : "border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20"
                  }`}
                >
                  {n.type === "new" ? (
                    <Sparkles className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Edit className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="font-medium">{n.type === "new" ? "New: " : "Updated: "}</span>
                    <span className="text-muted-foreground truncate">{n.title}</span>
                  </span>
                  <button
                    onClick={() => setDismissedNotifIds(prev => new Set(prev).add(n.id))}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Archive view — replaces normal content when active */}
          {showArchive ? (
            <div className="fade-in-up">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600">
                    <Archive className="h-5 w-5" />
                  </div>
                  <h2 className="text-base font-bold tracking-tight">Archived Notices</h2>
                  <span className="text-xs text-muted-foreground">({archivedNotices.length})</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowArchive(false)} className="rounded-xl">
                  Back to Board
                </Button>
              </div>
              {archivedNotices.length === 0 ? (
                <Card className="rounded-2xl border-border/40">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Archive className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No archived notices</p>
                  </CardContent>
                </Card>
              ) : (
                <MasonryGrid>
                  {archivedNotices.map(n => (
                    <Card key={n.id} className="rounded-2xl border-border/40 opacity-75 hover:opacity-100 transition-opacity">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-sm">{n.title}</h3>
                          <Badge variant="outline" className="text-[10px] shrink-0 rounded-md">{n.type}</Badge>
                        </div>
                        {n.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{n.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-3">
                          {n.category && <span>{n.category.name}</span>}
                          <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                          {n.archivedAt && <span className="text-amber-600 dark:text-amber-400">· Archived {new Date(n.archivedAt).toLocaleDateString()}</span>}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg text-xs h-7"
                            onClick={() => handleRestore(n)}
                          >
                            Restore
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg text-xs h-7 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setDeleteId(n.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </MasonryGrid>
              )}
            </div>
          ) : (
          <>
          {/* Notices content */}
          <div className="space-y-6">
            {/* Mobile calendar button — opens modal */}
            <section id="calendar" className="fade-in-up scroll-mt-20 lg:hidden">
              <button
                onClick={() => setShowMobileCalendar(true)}
                className="w-full flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-4 hover:bg-accent/50 transition-colors text-left"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary shrink-0">
                  <CalendarDays className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-bold tracking-tight">Calendar & Events</h2>
                  <p className="text-xs text-muted-foreground">View meetings, events & schedules</p>
                </div>
                {upcomingEvents.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">{upcomingEvents.length}</span>
                )}
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>
              </section>

              {/* Quick Links — mobile button (desktop shows them in header bar) */}
          {(() => {
            const quickLinks = notices.filter(n => n.type === "link" && !n.categoryId && !n.isArchived && n.isPublished !== false);
            const filteredLinks = activeCategory ? [] : quickLinks;
            if (filteredLinks.length === 0) return null;
            return (
              <section className="lg:hidden fade-in-up">
                <button
                  onClick={() => setShowQuickLinks(true)}
                  className="w-full flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-4 hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-600 shrink-0">
                    <Link2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-bold tracking-tight">Quick Links</h2>
                    <p className="text-xs text-muted-foreground">{filteredLinks.length} links</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>
              </section>
            );
          })()}

              {/* Upcoming Events — grid on desktop */}
              {upcomingEvents.length > 0 && (
                <section id="events" className="fade-in-up scroll-mt-20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center h-7 w-7 rounded-xl bg-primary/10 text-primary">
                      <CalendarClock className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <h2 className="text-sm font-bold tracking-tight">{t("upcomingEvents", language)}</h2>
                  </div>
                  <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
                    {upcomingEvents.slice(0, 12).map(e => (
                      <EventCard key={e.id} event={e} language={language} onClick={setSelectedEvent} />
                    ))}
                  </div>
                </section>
              )}

              {/* Category filter pills */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setActiveCategory(null); }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${!activeCategory ? "bg-indigo-500 text-white" : "bg-card border border-border/40 text-muted-foreground hover:border-indigo-300"}`}
                  >
                    All
                    {(() => { const allCount = [...pinnedNotices, ...regularNotices].filter(filterFn).length; return allCount > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${!activeCategory ? "bg-white/20" : "bg-muted/40"}`}>{allCount}</span>; })()}
                  </button>
                  {categories.map(c => {
                    const count = categoryCounts[c.id] || 0;
                    return (
                    <button
                      key={c.id}
                      onClick={() => { setActiveCategory(activeCategory === c.id ? null : c.id); setTimeout(() => document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeCategory === c.id ? "bg-indigo-500 text-white" : "bg-card border border-border/40 text-muted-foreground hover:border-indigo-300"}`}
                    >
                      {c.color && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />}
                      {c.name}
                      {count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeCategory === c.id ? "bg-white/20" : "bg-muted/40"}`}>{count}</span>}
                    </button>
                    );
                  })}
                </div>
              )}

              {/* Bulk select toolbar — super admin only */}
              {isSuperAdmin && (
                <div className="flex items-center gap-2 flex-wrap">
                  {!bulkSelectMode ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg h-8 text-xs"
                      onClick={() => setBulkSelectMode(true)}
                    >
                      <CheckCheck className="h-3.5 w-3.5 mr-1" />
                      Select Notices
                    </Button>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground">
                        {selectedNoticeIds.size > 0 ? `${selectedNoticeIds.size} selected` : "Click notices to select"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-8 text-xs"
                        onClick={toggleSelectAllNotices}
                      >
                        {selectedNoticeIds.size === [...pinnedNotices, ...regularNotices].length ? "Deselect All" : "Select All"}
                      </Button>
                      {selectedNoticeIds.size > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="rounded-lg h-8 text-xs"
                          onClick={() => setBulkDeleteNoticesConfirm(true)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete Selected ({selectedNoticeIds.size})
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg h-8 text-xs"
                        onClick={() => { setBulkSelectMode(false); setSelectedNoticeIds(new Set()); }}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Exit
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Pinned Schedule Strip — current week's meeting + public talk side by side */}
              {(midweekSchedules.length > 0 || publicTalkSchedules.length > 0) && (
                <PinnedScheduleStrip
                  midweekSchedules={midweekSchedules}
                  publicTalkSchedules={publicTalkSchedules}
                  meetings={upcomingMeetings}
                  language={language}
                  isAdmin={isAdmin}
                  onOpenPdf={openPdf}
                  onOpenPhoto={openPhoto}
                  onCardClick={setDetailNotice}
                  onEdit={handleEditNotice}
                  onDelete={(id) => setDeleteId(id)}
                  midweekDay={parseInt(String(settings.midweekDay ?? "2"), 10)}
                  weekendDay={parseInt(String(settings.weekendDay ?? "0"), 10)}
                />
              )}

              {/* This week at a glance — roles and upcoming events */}
              <ThisWeekGlance
                roles={roles}
                events={upcomingEvents}
                onOpenPhoto={openPhoto}
              />

              {/* Pinned Notices */}
          {pinnedNotices.filter(filterFn).length > 0 && (
            <DashboardSection
              id="pinned"
              title={t("pinned", language)}
              icon={<Pin className="h-5 w-5 text-amber-500" />}
            >
              <MasonryGrid>
                {pinnedNotices.filter(filterFn).map(n => (
                  <PadletCard key={n.id} notice={n} language={language} onCardClick={setDetailNotice} bookmarked={bookmarked.has(n.id)} onToggleBookmark={toggleBookmark} isAdmin={isAdmin} onEdit={handleEditNotice} onDelete={(id) => setDeleteId(id)} onTogglePin={handleTogglePin} onArchive={handleArchive} highlight={highlight} siteDomain={settings.siteDomain} bulkSelectMode={bulkSelectMode} isSelected={selectedNoticeIds.has(n.id)} onToggleSelect={toggleNoticeSelection} />
                ))}
              </MasonryGrid>
            </DashboardSection>
          )}

          {/* Roles & Assignments */}
          {roles.length > 0 && (
            <DashboardSection
              id="roles"
              title={t("rolesSection", language)}
              icon={<UserCog className="h-5 w-5 text-blue-600" />}
            >
              <RolesCarousel
                roles={roles}
                language={language}
                isAdmin={isAdmin}
                onOpenPdf={openPdf}
                onOpenPhoto={openPhoto}
                onEdit={(role) => { setEditingRole(role); }}
                onDelete={(id) => { setDeleteRoleId(id); }}
                onShowGrid={() => { setSelectedRoleIds(new Set()); setShowRoleGrid(true); }}
              />
            </DashboardSection>
          )}

          {/* Meeting Schedules (Midweek) */}
          {midweekSchedules.length > 0 && (
            <DashboardSection
              id="schedules"
              title="Meeting Schedules"
              icon={<BookOpen className="h-5 w-5 text-indigo-600" />}
            >
              <ScheduleCarousel
                schedules={midweekSchedules}
                language={language}
                isAdmin={isAdmin}
                onOpenPdf={openPdf}
                onOpenPhoto={openPhoto}
                onCardClick={setDetailNotice}
                onEdit={handleEditNotice}
                onDelete={(id) => setDeleteId(id)}
              />
            </DashboardSection>
          )}

          {/* Public Talk Schedules */}
          {publicTalkSchedules.length > 0 && (
            <DashboardSection
              id="public-talks"
              title="Public Talks"
              icon={<Mic className="h-5 w-5 text-purple-600" />}
            >
              <ScheduleCarousel
                schedules={publicTalkSchedules}
                language={language}
                isAdmin={isAdmin}
                onOpenPdf={openPdf}
                onOpenPhoto={openPhoto}
                onCardClick={setDetailNotice}
                onEdit={handleEditNotice}
                onDelete={(id) => setDeleteId(id)}
              />
            </DashboardSection>
          )}

          {/* Notices by Category */}
          {noticesByCategory.map(({ category, items }) => {
            const filtered = items.filter(filterFn);
            if (filtered.length === 0) return null;
            return (
              <DashboardSection
                key={category.id}
                id={`cat-${category.id}`}
                title={category.name}
                icon={<ClipboardList className="h-5 w-5" style={{ color: category.color || undefined }} />}
              >
                <MasonryGrid>
                  {filtered.map(n => <PadletCard key={n.id} notice={n} language={language} onCardClick={setDetailNotice} bookmarked={bookmarked.has(n.id)} onToggleBookmark={toggleBookmark} isAdmin={isAdmin} onEdit={handleEditNotice} onDelete={(id) => setDeleteId(id)} onTogglePin={handleTogglePin} onArchive={handleArchive} highlight={highlight} siteDomain={settings.siteDomain} bulkSelectMode={bulkSelectMode} isSelected={selectedNoticeIds.has(n.id)} onToggleSelect={toggleNoticeSelection} />)}
                </MasonryGrid>
              </DashboardSection>
            );
          })}

          {/* Uncategorized notices */}
          {uncategorizedNotices.filter(filterFn).length > 0 && (
            <DashboardSection
              id="other"
              title="Other Notices"
              icon={<ClipboardList className="h-5 w-5 text-muted-foreground" />}
            >
              <MasonryGrid>
                {uncategorizedNotices.filter(filterFn).map(n => (
                  <PadletCard key={n.id} notice={n} language={language} onCardClick={setDetailNotice} bookmarked={bookmarked.has(n.id)} onToggleBookmark={toggleBookmark} isAdmin={isAdmin} onEdit={handleEditNotice} onDelete={(id) => setDeleteId(id)} onTogglePin={handleTogglePin} onArchive={handleArchive} highlight={highlight} siteDomain={settings.siteDomain} bulkSelectMode={bulkSelectMode} isSelected={selectedNoticeIds.has(n.id)} onToggleSelect={toggleNoticeSelection} />
                ))}
              </MasonryGrid>
            </DashboardSection>
          )}

          {/* Empty state */}
          {notices.length === 0 && upcomingEvents.length === 0 && roles.length === 0 && (
            <div className="text-center py-32 text-muted-foreground">
              <div className="h-20 w-20 rounded-3xl bg-muted/40 flex items-center justify-center mx-auto mb-6">
                <ClipboardList className="h-10 w-10 opacity-40" />
              </div>
              <p className="text-xl font-semibold text-foreground/70">No notices yet</p>
              <p className="text-sm mt-1">Check back later for updates.</p>
            </div>
          )}

          {/* Map */}
          {(settings.mapEmbedUrl || (settings.mapLat && settings.mapLng)) && (
            <DashboardSection
              id="map"
              title={t("ourLocation", language)}
              icon={<MapPin className="h-5 w-5 text-red-600" />}
            >
              <Card className="overflow-hidden max-w-sm">
                <CardContent className="p-0">
                  <div className="h-32 w-full">
                    {settings.mapEmbedUrl ? (
                      <iframe src={settings.mapEmbedUrl} className="w-full h-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
                    ) : (
                      <MiniMap latitude={parseFloat(settings.mapLat)} longitude={parseFloat(settings.mapLng)} />
                    )}
                  </div>
                  {settings.mapAddress && (
                    <div className="p-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{settings.mapAddress}</span>
                      </div>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${settings.mapLat && settings.mapLng ? `${settings.mapLat},${settings.mapLng}` : encodeURIComponent(settings.mapAddress)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline shrink-0">
                        <Navigation className="h-3 w-3" /><span className="hidden sm:inline">{t("getDirections", language)}</span>
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </DashboardSection>
          )}
            </div>
          </>
          )}
        </main>
      </div>

      {/* Mobile bottom navigation bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border/40 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex flex-col items-center gap-0.5 py-2 px-3 text-muted-foreground hover:text-foreground transition-colors min-w-[56px]"
        >
          <Home className="h-5 w-5" />
          <span className="text-xs font-medium">Home</span>
        </button>
        <button
          onClick={() => document.getElementById("events")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="flex flex-col items-center gap-0.5 py-2 px-3 text-muted-foreground hover:text-foreground transition-colors min-w-[56px]"
        >
          <CalendarDays className="h-5 w-5" />
          <span className="text-xs font-medium">Events</span>
        </button>
        {isAdmin ? (
          <button
            onClick={() => document.getElementById("roles")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex flex-col items-center gap-0.5 py-2 px-3 text-muted-foreground hover:text-foreground transition-colors min-w-[56px]"
          >
            <UserCog className="h-5 w-5" />
            <span className="text-xs font-medium">Roles</span>
          </button>
        ) : (
          <button
            onClick={() => document.getElementById("roles")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex flex-col items-center gap-0.5 py-2 px-3 text-muted-foreground hover:text-foreground transition-colors min-w-[56px]"
          >
            <UserCog className="h-5 w-5" />
            <span className="text-xs font-medium">Roles</span>
          </button>
        )}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center gap-0.5 py-2 px-3 text-muted-foreground hover:text-foreground transition-colors min-w-[56px]"
        >
          <Menu className="h-5 w-5" />
          <span className="text-xs font-medium">Menu</span>
        </button>
      </nav>

      {/* In-built PDF Viewer */}
      <PdfViewer
        url={pdfViewer?.url ?? null}
        title={pdfViewer?.title}
        onClose={() => setPdfViewer(null)}
      />

      {/* Photo Viewer Lightbox */}
      <PhotoViewer
        images={photoViewer?.images ?? []}
        index={photoViewer?.index ?? null}
        onClose={() => setPhotoViewer(null)}
        siteDomain={settings.siteDomain}
      />

      {/* Create New Item Modal */}
      {/* Add Item Picker */}
      <AddItemPicker
        open={showAddPicker}
        onClose={() => setShowAddPicker(false)}
        onSelect={handleAddItemSelect}
      />

      {/* Admin Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => {
        if (!open && editingNotice && (editingNotice.title || editingNotice.content || editingNotice.fileUrl)) {
          setShowCloseConfirm(true);
        } else {
          setEditOpen(open);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingNotice?.id ? "Edit Notice" : "Create Notice"}
            </DialogTitle>
          </DialogHeader>
          {editingNotice && (
            <div className="space-y-4">
              {/* File Upload */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = "";
                }}
              />
              {editingNotice.fileUrl && isImageFile(editingNotice.fileUrl, editingNotice.fileName) ? (
                <div className="relative rounded-xl overflow-hidden border border-border/40 group">
                  <img src={editingNotice.fileUrl} alt="Preview" className="w-full max-h-96 object-contain bg-muted/20" />
                  <button
                    onClick={() => setEditingNotice({ ...editingNotice, fileUrl: null, thumbnailUrl: null, fileName: null })}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : editingNotice.fileUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 p-3">
                  <div className="h-10 w-10 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{editingNotice.fileName || "File"}</p>
                  </div>
                  <button
                    onClick={() => setEditingNotice({ ...editingNotice, fileUrl: null, fileName: null })}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full rounded-xl border-2 border-dashed border-border/60 p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10 transition-colors"
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm font-medium">Upload file</p>
                      <p className="text-xs text-muted-foreground">Image or PDF — type auto-detected</p>
                    </div>
                  )}
                </button>
              )}

              {/* AI Prompt section — for any image upload, with schedule detection */}
              {editingNotice.fileUrl && isImageFile(editingNotice.fileUrl, editingNotice.fileName) && (() => {
                const titleLower = (editingNotice.title || "").toLowerCase();
                const contentLower = (editingNotice.content || editingNotice.description || "").toLowerCase();
                // Detect midweek by title keywords or known midweek field names in content
                const isMidweekSchedule = titleLower.includes("midweek") ||
                  ["biblereading", "treasurestalk", "treasuresgem", "applyyourself", "livingtalk", "congregationbiblestudy"].some(f => contentLower.includes(f));
                // Detect public talk by title keywords or known public talk field names in content
                const isPublicTalkSchedule = titleLower.includes("public talk") || titleLower.includes("publictalk") ||
                  ["talktheme", "wtstudyreader", "speaker:"].some(f => contentLower.includes(f));
                // Also show if title contains "schedule"
                const isSchedule = isMidweekSchedule || isPublicTalkSchedule || titleLower.includes("schedule");
                // Default variant: auto-detect, default to midweek
                const useMidweek = isMidweekSchedule || !isPublicTalkSchedule;
                const aiPrompt = useMidweek
                  ? `Convert the following midweek meeting schedule image into this exact JSON format:\n\n[\n  {\n    "Date": "{YYYY-MM-DD}",\n    "BibleReading": "{Name}",\n    "TreasuresTalk": "{Name}",\n    "TreasuresGem": "{Name}",\n    "ApplyYourself1": "{Name}",\n    "ApplyYourself2": "{Name}",\n    "LivingTalk": "{Name}",\n    "CongregationBibleStudy": "{Name}",\n    "Reader": "{Name}",\n    "Prayer": "{Name}",\n    "Color": "{optional: the background or highlight color of this row/section in the image, as a hex code like #RRGGBB or a color name}"\n  }\n]\n\nReturn ONLY the JSON array, one object per meeting date. If there are multiple dates in the image, include multiple objects in the array. The "Color" field is optional — if you can identify a color associated with each entry in the image (e.g. a colored row, header, or highlight), include it; otherwise omit it.`
                  : `Convert the following public talk schedule image into this exact JSON format:\n\n[\n  {\n    "Date": "{YYYY-MM-DD}",\n    "Speaker": "{Name}",\n    "Congregation": "{Congregation Name}",\n    "TalkTheme": "{Theme Number or Title}",\n    "Chairman": "{Name}",\n    "Prayer": "{Name}",\n    "WTStudyReader": "{Name}"\n  }\n]\n\nReturn ONLY the JSON array, one object per meeting date. If there are multiple dates in the image, include multiple objects in the array.`;

                const copyForAi = async () => {
                  setEditAiCopying(true);
                  try {
                    // Resolve the file URL to an absolute URL
                    const imgUrl = editingNotice.fileUrl!;
                    const absoluteUrl = imgUrl.startsWith("http") ? imgUrl : `${window.location.origin}${imgUrl.startsWith("/") ? "" : "/"}${imgUrl}`;
                    // Fetch the image as a blob
                    const imgRes = await fetch(absoluteUrl);
                    if (!imgRes.ok) throw new Error("Failed to fetch image");
                    let imgBlob = await imgRes.blob();
                    // ClipboardItem only supports image/png in most browsers — convert if needed
                    if (imgBlob.type !== "image/png") {
                      // Re-encode as PNG via canvas
                      const bitmap = await createImageBitmap(imgBlob);
                      const canvas = document.createElement("canvas");
                      canvas.width = bitmap.width;
                      canvas.height = bitmap.height;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) throw new Error("Canvas not supported");
                      ctx.drawImage(bitmap, 0, 0);
                      imgBlob = await new Promise<Blob>((resolve, reject) => {
                        canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), "image/png");
                      });
                    }
                    // Try to write both text and image to clipboard
                    if (navigator.clipboard && window.ClipboardItem) {
                      const clipboardItem = new ClipboardItem({
                        "text/plain": new Blob([aiPrompt], { type: "text/plain" }),
                        "image/png": imgBlob,
                      });
                      await navigator.clipboard.write([clipboardItem]);
                      toast({ title: "AI prompt + image copied to clipboard!", description: "Paste into your AI chat (Ctrl+V / Cmd+V)" });
                    } else {
                      // Fallback: copy text only
                      await navigator.clipboard.writeText(aiPrompt);
                      toast({ title: "AI prompt copied (image not supported on this browser)", description: "Attach the image manually in your AI chat" });
                    }
                  } catch (err) {
                    // Fallback: copy text only
                    try {
                      await navigator.clipboard.writeText(aiPrompt);
                      toast({ title: "AI prompt copied to clipboard", description: "Attach the image manually in your AI chat" });
                    } catch {
                      toast({ title: "Failed to copy", variant: "destructive" });
                    }
                  } finally {
                    setEditAiCopying(false);
                  }
                };

                const parseAiToContent = () => {
                  if (!editAiPasteText.trim()) return;
                  let cleanText = editAiPasteText.trim();
                  cleanText = cleanText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
                  try {
                    const parsed = JSON.parse(cleanText);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      const template = useMidweek ? MIDWEEK_FIELD_TEMPLATES : PUBLIC_TALK_FIELD_TEMPLATES;
                      const orderMap = new Map(template.map((k, i) => [k, i]));
                      // Build content string from all entries, with fields sorted by template order
                      const lines: string[] = [];
                      for (const obj of parsed) {
                        const dateStr = obj.Date || obj.date || "";
                        const fields = Object.entries(obj)
                          .filter(([k]) => k.toLowerCase() !== "date" && k.toLowerCase() !== "color")
                          .map(([k, v]) => ({ key: k, value: String(v || "") }))
                          .sort((a, b) => {
                            const aIdx = orderMap.get(a.key);
                            const bIdx = orderMap.get(b.key);
                            if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
                            if (aIdx !== undefined) return -1;
                            if (bIdx !== undefined) return 1;
                            return 0;
                          })
                          .map(f => f.value.trim() ? `${f.key}: ${f.value}` : f.key);
                        if (dateStr) {
                          const d = new Date(dateStr + "T00:00:00");
                          if (!isNaN(d.getTime())) {
                            lines.push(d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
                          }
                        }
                        lines.push(...fields);
                        lines.push("");
                      }
                      setEditingNotice({ ...editingNotice, content: lines.join("\n").trim() });
                      toast({ title: `Parsed ${parsed.length} entr${parsed.length === 1 ? "y" : "ies"} from AI output` });
                    } else {
                      toast({ title: "No valid entries found in AI output", variant: "destructive" });
                    }
                  } catch {
                    toast({ title: "Failed to parse AI JSON output", variant: "destructive" });
                  }
                };

                const autoProcessEditWithAi = async () => {
                  if (!editingNotice.fileUrl) return;
                  setEditAiProcessing(true);
                  try {
                    const res = await fetch("/api/ai-process", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ imageUrl: editingNotice.fileUrl, prompt: aiPrompt }),
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      toast({ title: data.error || "AI processing failed", variant: "destructive" });
                      return;
                    }
                    const data = await res.json();
                    const result = data.result || "";
                    let cleanText = result.trim();
                    cleanText = cleanText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
                    setEditAiPasteText(cleanText);
                    // Auto-parse
                    try {
                      const parsed = JSON.parse(cleanText);
                      if (Array.isArray(parsed) && parsed.length > 0) {
                        const template = useMidweek ? MIDWEEK_FIELD_TEMPLATES : PUBLIC_TALK_FIELD_TEMPLATES;
                        const orderMap = new Map(template.map((k, i) => [k, i]));
                        const lines: string[] = [];
                        for (const obj of parsed) {
                          const dateStr = obj.Date || obj.date || "";
                          const fields = Object.entries(obj)
                            .filter(([k]) => k.toLowerCase() !== "date" && k.toLowerCase() !== "color")
                            .map(([k, v]) => ({ key: k, value: String(v || "") }))
                            .sort((a, b) => {
                              const aIdx = orderMap.get(a.key);
                              const bIdx = orderMap.get(b.key);
                              if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
                              if (aIdx !== undefined) return -1;
                              if (bIdx !== undefined) return 1;
                              return 0;
                            })
                            .map(f => f.value.trim() ? `${f.key}: ${f.value}` : f.key);
                          if (dateStr) {
                            const d = new Date(dateStr + "T00:00:00");
                            if (!isNaN(d.getTime())) {
                              lines.push(d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
                            }
                          }
                          lines.push(...fields);
                          lines.push("");
                        }
                        setEditingNotice({ ...editingNotice, content: lines.join("\n").trim() });
                        toast({ title: `AI processed ${parsed.length} entr${parsed.length === 1 ? "y" : "ies"}!` });
                      } else {
                        toast({ title: "AI returned unexpected format", variant: "destructive" });
                      }
                    } catch {
                      toast({ title: "AI returned invalid JSON", variant: "destructive" });
                    }
                  } catch {
                    toast({ title: "Failed to connect to AI service", variant: "destructive" });
                  } finally {
                    setEditAiProcessing(false);
                  }
                };

                const hasNoContent = !editingNotice.content && !editingNotice.description;
                return (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowEditAiSection(!showEditAiSection)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showEditAiSection ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      <Wand2 className="h-3.5 w-3.5" />
                      AI Image Processing
                      {isSchedule && hasNoContent && <span className="text-teal-600 dark:text-teal-400 font-medium">· recommended</span>}
                    </button>
                    {showEditAiSection && (
                      <div className="space-y-3 rounded-xl border border-border/40 p-3 bg-muted/10">
                        {/* Auto-process with AI (only if Gemini API key is configured) */}
                        {!!settings.geminiApiKey && (
                          <Button
                            size="sm"
                            className="rounded-lg w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white"
                            onClick={autoProcessEditWithAi}
                            disabled={editAiProcessing}
                          >
                            {editAiProcessing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
                            {editAiProcessing ? "Processing with AI..." : "Auto-Process with AI"}
                          </Button>
                        )}
                        {!!settings.geminiApiKey && (
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <div className="flex-1 h-px bg-border/40" />
                            OR MANUAL
                            <div className="flex-1 h-px bg-border/40" />
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Copy the AI prompt + schedule image to your clipboard in one action, then paste into an AI chat to get structured JSON.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg w-full bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-950/30"
                          onClick={copyForAi}
                          disabled={editAiCopying}
                        >
                          {editAiCopying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" />}
                          {editAiCopying ? "Copying..." : "Copy for AI (prompt + image)"}
                        </Button>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-muted-foreground">Paste AI JSON Output Here</Label>
                          <Textarea
                            value={editAiPasteText}
                            onChange={(e) => setEditAiPasteText(e.target.value)}
                            rows={6}
                            placeholder="Paste the AI model's JSON output here. It will be converted to schedule content."
                            className="rounded-lg text-sm font-mono"
                          />
                          <Button
                            size="sm"
                            className="rounded-lg w-full bg-teal-600 hover:bg-teal-700"
                            onClick={parseAiToContent}
                            disabled={!editAiPasteText.trim()}
                          >
                            <ClipboardPaste className="h-3.5 w-3.5 mr-1" /> Parse & Fill Content
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editingNotice.title || ""}
                  onChange={(e) => setEditingNotice({ ...editingNotice, title: e.target.value })}
                  placeholder="Notice title"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingNotice.description || ""}
                  onChange={(e) => setEditingNotice({ ...editingNotice, description: e.target.value })}
                  rows={3}
                  placeholder="Brief description..."
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editingNotice.categoryId || ""}
                  onValueChange={(v) => setEditingNotice({ ...editingNotice, categoryId: v || null })}
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
              {(autoType(editingNotice) === "text" || editingNotice.content) && (
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    value={editingNotice.content || ""}
                    onChange={(e) => setEditingNotice({ ...editingNotice, content: e.target.value })}
                    rows={4}
                    placeholder="Notice content..."
                    className="rounded-xl"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>External Link (optional)</Label>
                <Input
                  value={editingNotice.linkUrl || ""}
                  onChange={(e) => setEditingNotice({ ...editingNotice, linkUrl: e.target.value })}
                  placeholder="https://..."
                  className="rounded-xl"
                />
                {editingNotice.linkUrl && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>Link Label (optional)</Label>
                        <Input
                          value={editingNotice.linkLabel || ""}
                          onChange={(e) => setEditingNotice({ ...editingNotice, linkLabel: e.target.value })}
                          placeholder="Click here..."
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Link Icon URL (optional)</Label>
                        <Input
                          value={editingNotice.linkIcon || ""}
                          onChange={(e) => setEditingNotice({ ...editingNotice, linkIcon: e.target.value })}
                          placeholder="Favicon URL..."
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                    {editingNotice.linkUrl && !editingNotice.linkIcon && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/link-preview?url=${encodeURIComponent(editingNotice.linkUrl || '')}`);
                            if (res.ok) {
                              const data = await res.json();
                              if (data.favicon) setEditingNotice({ ...editingNotice, linkIcon: data.favicon });
                              if (data.title && !editingNotice.title) setEditingNotice({ ...editingNotice, title: data.title });
                            }
                          } catch {}
                        }}
                        className="rounded-lg text-xs"
                      >
                        <Search className="h-3 w-3 mr-1" /> Fetch favicon
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <AdvancedOptionsFields
                state={{
                  isPinned: editingNotice.isPinned || false,
                  expiresAt: editingNotice.expiresAt ? new Date(editingNotice.expiresAt).toISOString().split("T")[0] : "",
                  showOnCalendar: editingNotice.showOnCalendar || false,
                  eventStartDate: editingNotice.eventStartDate || "",
                  eventEndDate: editingNotice.eventEndDate || "",
                  location: editingNotice.location || "",
                  latitude: editingNotice.latitude ?? null,
                  longitude: editingNotice.longitude ?? null,
                  isPublished: editingNotice.isPublished !== false,
                }}
                showPublished={true}
                onChange={(s: AdvancedOptionsState) => setEditingNotice({
                  ...editingNotice,
                  isPinned: s.isPinned,
                  expiresAt: s.expiresAt ? new Date(s.expiresAt).toISOString() : null,
                  showOnCalendar: s.showOnCalendar,
                  eventStartDate: s.eventStartDate || null,
                  eventEndDate: s.eventEndDate || null,
                  location: s.location || null,
                  latitude: s.latitude,
                  longitude: s.longitude,
                  isPublished: s.isPublished,
                })}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSaveNotice} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Link Modal */}
      <EditLinkModal
        open={!!editingLink}
        onClose={() => setEditingLink(null)}
        onSaved={() => { setEditingLink(null); pushNotification("Link updated", "updated"); fetchData(); }}
        notice={editingLink}
        categories={categories.map(c => ({ id: c.id, name: c.name }))}
      />

      {/* Specialized Modals */}
      <ScheduleModal
        open={!!showScheduleModal}
        onClose={() => { setShowScheduleModal(null); setEditingSchedule(null); }}
        onSaved={() => { setShowScheduleModal(null); setEditingSchedule(null); pushNotification("Schedule saved", "new"); fetchData(); }}
        variant={showScheduleModal === "public-talk" ? "public-talk" : "midweek"}
        categories={categories.map(c => ({ id: c.id, name: c.name }))}
        aiEnabled={!!settings.geminiApiKey}
        editNotice={editingSchedule ? {
          id: editingSchedule.id,
          title: editingSchedule.title,
          content: editingSchedule.content ?? null,
          description: editingSchedule.description ?? null,
          eventStartDate: editingSchedule.eventStartDate ?? null,
          eventEndDate: editingSchedule.eventEndDate ?? null,
          fileUrl: editingSchedule.fileUrl ?? null,
          fileName: editingSchedule.fileName ?? null,
        } : null}
      />
      <WeeklyRolesModal
        open={showWeeklyRolesModal}
        onClose={() => setShowWeeklyRolesModal(false)}
        onSaved={() => { setShowWeeklyRolesModal(false); pushNotification("Weekly roles saved", "new"); fetchData(); }}
      />

      {/* Edit Role Modal */}
      {editingRole && (
        <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingRole(null)}>
          <div className="bg-card border border-border/40 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
              <h2 className="text-base font-bold">Edit Role Assignment</h2>
              <Button variant="ghost" size="icon" onClick={() => setEditingRole(null)} className="rounded-lg h-8 w-8"><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Meeting Type</Label>
                <div className="flex rounded-lg border border-border/40 overflow-hidden mt-1">
                  {["midweek", "weekend", "special"].map(mt => (
                    <button
                      key={mt}
                      type="button"
                      onClick={() => setEditingRole(prev => prev ? { ...prev, meetingType: mt } : prev)}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${editingRole.meetingType === mt ? "bg-teal-500 text-white" : "hover:bg-accent"}`}
                    >
                      {mt === "midweek" ? "MW" : mt === "weekend" ? "WE" : "Special"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Week Date</Label>
                <Input
                  type="date"
                  value={editingRole.weekDate || ""}
                  onChange={(e) => setEditingRole(prev => prev ? { ...prev, weekDate: e.target.value } : prev)}
                  className="rounded-lg mt-1"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground">Roles</Label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setRoleEditMode("list")}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${roleEditMode === "list" ? "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" : "text-muted-foreground hover:bg-accent"}`}
                    >
                      <List className="h-3 w-3" /> List
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleEditMode("raw")}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${roleEditMode === "raw" ? "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" : "text-muted-foreground hover:bg-accent"}`}
                    >
                      <Type className="h-3 w-3" /> Raw
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRoleJson(!showRoleJson)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${showRoleJson ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" : "text-muted-foreground hover:bg-accent"}`}
                    >
                      <Code className="h-3 w-3" /> JSON
                    </button>
                  </div>
                </div>

                {roleEditMode === "list" ? (
                  <div className="space-y-1.5 mt-2">
                    {parseRoleLines(editingRole.ocrText || "").map((line, lineIdx) => (
                      <div key={lineIdx} className="flex items-center gap-1.5">
                        <Input
                          value={line.name}
                          onChange={(e) => {
                            const lines = parseRoleLines(editingRole.ocrText || "");
                            lines[lineIdx] = { ...lines[lineIdx], name: e.target.value };
                            setEditingRole(prev => prev ? { ...prev, ocrText: roleLinesToText(lines) } : prev);
                          }}
                          placeholder="Role name"
                          className="rounded-lg text-xs h-8 flex-shrink-0 w-[110px]"
                        />
                        <span className="text-muted-foreground text-xs shrink-0">:</span>
                        <Input
                          value={line.assignee}
                          onChange={(e) => {
                            const lines = parseRoleLines(editingRole.ocrText || "");
                            lines[lineIdx] = { ...lines[lineIdx], assignee: e.target.value };
                            setEditingRole(prev => prev ? { ...prev, ocrText: roleLinesToText(lines) } : prev);
                          }}
                          placeholder="Assignee name(s)"
                          className="rounded-lg text-xs h-8 flex-1 min-w-0"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const lines = parseRoleLines(editingRole.ocrText || "");
                            lines.splice(lineIdx, 1);
                            setEditingRole(prev => prev ? { ...prev, ocrText: roleLinesToText(lines) } : prev);
                          }}
                          className="h-7 w-7 rounded-lg shrink-0 text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const lines = parseRoleLines(editingRole.ocrText || "");
                        lines.push({ name: "", assignee: "" });
                        setEditingRole(prev => prev ? { ...prev, ocrText: roleLinesToText(lines) } : prev);
                      }}
                      className="rounded-lg w-full text-xs h-7"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add role
                    </Button>
                  </div>
                ) : (
                  <Textarea
                    value={editingRole.ocrText || ""}
                    onChange={(e) => setEditingRole(prev => prev ? { ...prev, ocrText: e.target.value } : prev)}
                    rows={8}
                    placeholder={"Audio: ___\nVideo: ___\nMicrophones: ___\nAttendant: ___\nSecurity: ___"}
                    className="rounded-lg mt-2 text-sm font-mono"
                  />
                )}

                {showRoleJson && (
                  <div className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden mt-2">
                    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/30 bg-muted/30">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">JSON Preview</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] rounded"
                        onClick={() => {
                          navigator.clipboard.writeText(rolesToJson(editingRole.weekDate || "", editingRole.ocrText || "")).then(() => toast({ title: "JSON copied" }));
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    </div>
                    <pre className="text-[11px] font-mono whitespace-pre-wrap p-2.5 overflow-x-auto max-h-48 overflow-y-auto">
                      {rolesToJson(editingRole.weekDate || "", editingRole.ocrText || "")}
                    </pre>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border/40 shrink-0 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingRole(null)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSaveRole} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl">Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Role Confirmation */}
      {deleteRoleId && (
        <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteRoleId(null)}>
          <div className="bg-card border border-border/40 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base">Delete Role Assignment?</h3>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteRoleId(null)} className="rounded-xl">Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteRole} className="rounded-xl">Delete</Button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Role Grid Modal */}
      {showRoleGrid && (
        <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowRoleGrid(false)}>
          <div className="bg-card border border-border/40 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-500" />
                All Role Assignments
              </h2>
              <div className="flex items-center gap-2">
                {selectedRoleIds.size > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">{selectedRoleIds.size} selected</span>
                    <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={handleCopySelectedRolesJson}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy JSON
                    </Button>
                    <Button size="sm" variant="destructive" className="rounded-lg h-8" onClick={() => setBulkDeleteConfirm(true)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Selected
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" onClick={() => setShowRoleGrid(false)} className="rounded-lg h-8 w-8"><X className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...roles].sort((a, b) => (b.weekDate || "").localeCompare(a.weekDate || "")).map(r => {
                  const selected = selectedRoleIds.has(r.id);
                  const isPast = r.weekDate && r.weekDate < new Date().toISOString().split("T")[0];
                  const mtColors = r.meetingType === "midweek" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" :
                    r.meetingType === "weekend" ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" :
                    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
                  return (
                    <div
                      key={r.id}
                      className={`rounded-xl border-2 p-3 cursor-pointer transition-all ${selected ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20" : "border-border/40 hover:border-border/80"} ${isPast ? "opacity-50" : ""}`}
                      onClick={() => {
                        setSelectedRoleIds(prev => {
                          const next = new Set(prev);
                          if (next.has(r.id)) next.delete(r.id);
                          else next.add(r.id);
                          return next;
                        });
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${mtColors}`}>
                            {r.meetingType === "midweek" ? "MW" : r.meetingType === "weekend" ? "WE" : "SP"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold leading-tight">
                              {r.weekDate ? new Date(r.weekDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "No date"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{isPast ? "Past" : "Upcoming"}</p>
                          </div>
                        </div>
                        {selected ? <Check className="h-4 w-4 text-indigo-500" /> : <Square className="h-4 w-4 text-muted-foreground/40" />}
                      </div>
                      {r.ocrText && (
                        <p className="text-xs whitespace-pre-wrap line-clamp-4 text-muted-foreground font-mono leading-relaxed">{r.ocrText}</p>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                        <span className="text-[10px] text-muted-foreground">{timeAgo(r.updatedAt, language)}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-6 px-1.5 rounded-md" onClick={(e) => { e.stopPropagation(); setEditingRole(r); }}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 px-1.5 rounded-md text-red-500" onClick={(e) => { e.stopPropagation(); setDeleteRoleId(r.id); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setBulkDeleteConfirm(false)}>
          <div className="bg-card border border-border/40 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h3 className="font-bold text-base">Delete {selectedRoleIds.size} role(s)?</h3>
            </div>
            <p className="text-sm text-muted-foreground">This will permanently delete all selected role assignments. This action cannot be undone.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setBulkDeleteConfirm(false)} className="rounded-xl">Cancel</Button>
              <Button variant="destructive" onClick={handleBulkDeleteRoles} className="rounded-xl">Delete All</Button>
            </div>
          </div>
        </div>
      )}

      <SpecialEventModal
        open={showSpecialEventModal}
        editEventId={editEventId}
        onClose={() => { setShowSpecialEventModal(false); setEditEventId(null); }}
        onSaved={() => { setShowSpecialEventModal(false); setEditEventId(null); pushNotification("Special event saved", "new"); fetchData(); }}
      />
      <MediaModal
        open={!!showMediaModal}
        onClose={() => setShowMediaModal(null)}
        onSaved={() => { setShowMediaModal(null); pushNotification("Media saved", "new"); fetchData(); }}
        categories={categories.map(c => ({ id: c.id, name: c.name }))}
        defaultCategoryId={typeof showMediaModal === "object" ? showMediaModal?.defaultCategoryId : undefined}
        defaultTitle={typeof showMediaModal === "object" ? showMediaModal?.defaultTitle : undefined}
      />
      <AnnouncementModal
        open={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        onSaved={() => { setShowAnnouncementModal(false); pushNotification("Announcement saved", "new"); fetchData(); }}
        categories={categories.map(c => ({ id: c.id, name: c.name }))}
      />
      <LinkModal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onSaved={() => { setShowLinkModal(false); pushNotification("Link saved", "new"); fetchData(); }}
        categories={categories.map(c => ({ id: c.id, name: c.name }))}
        defaultCategoryId={activeCategory}
      />

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowLoginModal(false)}>
          <div className="bg-card border border-border/40 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <img src="/jwnb_logo.png" alt="Logo" className="h-10 w-10 rounded-xl object-cover" />
                <div>
                  <h2 className="text-lg font-bold">Sign In</h2>
                  <p className="text-xs text-muted-foreground">Manage notices and meetings</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowLoginModal(false)} className="rounded-lg h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoginLoading(true);
              setLoginError("");
              const result = await signIn("credentials", {
                username: loginUsername,
                password: loginPassword,
                redirect: false,
              });
              if (result?.error) {
                setLoginError("Invalid username or password");
                setLoginLoading(false);
              } else {
                setShowLoginModal(false);
                setLoginUsername("");
                setLoginPassword("");
                setLoginLoading(false);
                router.refresh();
              }
            }} className="space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  autoFocus
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="rounded-xl"
                />
              </div>
              {loginError && (
                <p className="text-sm text-red-500 text-center">{loginError}</p>
              )}
              <Button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
              >
                {loginLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sign In
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Forced Password Change Modal */}
      {session && mustChangePassword && (
        <div className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/40 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                <KeyRound className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Change Password</h2>
                <p className="text-xs text-muted-foreground">Required on first login</p>
              </div>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setChangePwError("");
              if (changePwNew.length < 6) {
                setChangePwError("New password must be at least 6 characters");
                return;
              }
              if (changePwNew !== changePwConfirm) {
                setChangePwError("Passwords do not match");
                return;
              }
              setChangePwLoading(true);
              try {
                const res = await fetch("/api/auth/change-password", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ currentPassword: changePwCurrent, newPassword: changePwNew }),
                });
                if (res.ok) {
                  setChangePwCurrent("");
                  setChangePwNew("");
                  setChangePwConfirm("");
                  // Sign out — session is invalidated by tokenVersion increment
                  await signOut({ callbackUrl: "/" });
                } else {
                  const data = await res.json();
                  setChangePwError(data.error || "Failed to change password");
                }
              } catch {
                setChangePwError("Failed to change password");
              } finally {
                setChangePwLoading(false);
              }
            }} className="space-y-4">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={changePwCurrent}
                  onChange={(e) => setChangePwCurrent(e.target.value)}
                  required
                  autoFocus
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={changePwNew}
                  onChange={(e) => setChangePwNew(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={changePwConfirm}
                  onChange={(e) => setChangePwConfirm(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>
              {changePwError && (
                <p className="text-sm text-red-500 text-center">{changePwError}</p>
              )}
              <Button
                type="submit"
                disabled={changePwLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
              >
                {changePwLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Change Password
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Calendar Modal */}
      {showMobileCalendar && (
        <div className="fixed inset-0 z-[100] bg-background lg:hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0 bg-card">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-500" />
              Calendar & Events
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setShowMobileCalendar(false)} className="rounded-lg h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <CalendarView language={language} isAdmin={isAdmin} onEditEvent={handleEditEvent} onEditNotice={handleEditNoticeById} />
            {upcomingEvents.length > 0 && (
              <section id="events" className="fade-in-up scroll-mt-20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10 text-primary">
                    <CalendarClock className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-base font-bold tracking-tight">{t("upcomingEvents", language)}</h2>
                </div>
                <div className="space-y-3">
                  {upcomingEvents.map(e => (
                    <EventCard key={e.id} event={e} language={language} onClick={setSelectedEvent} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {/* Mobile Quick Links Modal */}
      {showQuickLinks && (
        <div className="fixed inset-0 z-[100] bg-background lg:hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0 bg-card">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Link2 className="h-5 w-5 text-cyan-500" />
              Quick Links
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setShowQuickLinks(false)} className="rounded-lg h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-4 gap-3">
              {notices.filter(n => n.type === "link" && !n.categoryId && !n.isArchived && n.isPublished !== false).map(n => (
                <a
                  key={n.id}
                  href={n.linkUrl || n.content || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border/40 bg-card p-3 hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-700/50 transition-all relative aspect-square"
                >
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.preventDefault(); handleEditNotice(n); }}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                  )}
                  {n.linkIcon ? (
                    <img src={n.linkIcon} alt="" className="h-10 w-10 rounded-lg shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-cyan-500 text-white flex items-center justify-center shrink-0">
                      <Link2 className="h-5 w-5" />
                    </div>
                  )}
                  <p className="text-[10px] font-medium text-center leading-tight line-clamp-2 group-hover:text-cyan-600 transition-colors w-full">
                    {n.linkLabel || n.title}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notice Detail Modal */}
      <Dialog open={!!detailNotice} onOpenChange={(open) => { if (!open) { setDetailNotice(null); setDetailExpanded(false); } }}>
        <DialogContent className={detailNotice && noticeHasMedia(detailNotice)
          ? detailExpanded
            ? "max-w-[100vw] sm:max-w-[98vw] w-full h-[100vh] sm:h-[98vh] max-h-[100vh] sm:max-h-[98vh] p-0 gap-0 overflow-hidden rounded-none sm:rounded-2xl [&>button]:hidden"
            : "max-md:max-w-[100vw] max-md:rounded-none max-md:h-[100vh] max-md:max-h-[100vh] sm:max-w-3xl sm:h-[70vh] w-full max-h-[92vh] p-0 gap-0 overflow-hidden rounded-2xl [&>button]:hidden"
          : "max-w-2xl sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl gap-0"
        }>
          {detailNotice && (() => {
            const n = detailNotice;
            const lang = String(language);
            const isTl = lang === "tl";
            const title = isTl && n.titleTl ? n.titleTl : n.title;
            const description = isTl && n.descriptionTl ? n.descriptionTl : n.description;
            const isPdf = isPdfFile(n.fileUrl, n.fileName) && !!n.fileUrl;
            const images = getNoticeImages(n);
            const hasMedia = isPdf || images.length > 0;

            const detailsBody = (
              <div className="space-y-4">
                {/* Category + pinned */}
                <div className="flex items-center gap-2 flex-wrap">
                  {n.isPinned && (
                    <Badge className="bg-amber-500 text-white gap-1">
                      <Pin className="h-3 w-3" /> Pinned
                    </Badge>
                  )}
                  {n.category && (
                    <Badge variant="outline" className="rounded-md">
                      {n.category.name}
                    </Badge>
                  )}
                </div>

                {/* Description — structured blocks for schedules, plain text otherwise */}
                {description && <ScheduleContentDisplay text={description} plainClassName="text-sm text-foreground/80 leading-relaxed" />}

                {/* Text content — schedules show their list even with an image attached (only when there's no description, which already carries the text) */}
                {n.content && !description && (!hasMedia || !n.fileUrl || isScheduleContent(n.content)) && <ScheduleContentDisplay text={n.content} plainClassName="text-sm text-foreground/80 leading-relaxed" whitespacePreWrap />}

                {/* Countdown */}
                {n.eventStartDate && (() => {
                  const cd = getCountdown(n.eventStartDate);
                  return cd && !cd.isPast ? (
                    <div className="flex items-center gap-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 px-3 py-2 border border-indigo-200 dark:border-indigo-800/40">
                      <CalendarCountdown className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                        {cd.days > 0 && `${cd.days}d `}{cd.hours > 0 && `${cd.hours}h `}{cd.days === 0 && `${cd.mins}m `}until event
                      </span>
                    </div>
                  ) : null;
                })()}

                {/* Location */}
                {n.location && (
                  <a
                    href={n.latitude != null && n.longitude != null
                      ? `https://www.google.com/maps/dir/?api=1&destination=${n.latitude},${n.longitude}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(n.location)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/20 px-3 py-2 border border-blue-200 dark:border-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors"
                  >
                    <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">{n.location}</span>
                  </a>
                )}

                {/* Pinned location map */}
                {n.latitude != null && n.longitude != null && (
                  <div className="rounded-xl overflow-hidden border border-border/40 h-48">
                    <MiniMap latitude={n.latitude} longitude={n.longitude} />
                  </div>
                )}

                {/* Link */}
                {n.linkUrl && (
                  <a href={n.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                    {n.linkIcon ? (
                      <img src={n.linkIcon} alt="" className="h-4 w-4 rounded shrink-0" />
                    ) : (
                      <ExternalLink className="h-3.5 w-3.5" />
                    )}
                    {n.linkLabel || n.linkUrl}
                  </a>
                )}
              </div>
            );

            const detailsFooter = (
              <div className="flex items-center justify-between w-full">
                  <span className="text-xs text-muted-foreground">{timeAgo(n.updatedAt || n.createdAt, language)}</span>
                  <div className="flex items-center gap-1">
                    {isScheduleContent(n.content || n.description || "") && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => printScheduleNotice(title, n.content || n.description || "")} title="Print schedule">
                        <Printer className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => shareUrl(`/notice/${n.id}`, title, settings.siteDomain)}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                    {n.fileUrl && (
                      <a href={n.fileUrl} download>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                    {isAdmin && (
                      <>
                        <div className="w-px h-5 bg-border mx-1" />
                        <Button variant="ghost" size="sm" className={`h-8 w-8 p-0 rounded-lg ${n.isPinned ? "text-amber-500" : ""}`} onClick={() => { handleTogglePin(n); }} title="Pin/Unpin">
                          <Pin className={`h-4 w-4 ${n.isPinned ? "fill-amber-500" : ""}`} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => { setDetailNotice(null); handleEditNotice(n); }} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => { setDetailNotice(null); handleArchive(n); }} title="Archive">
                          <Archive className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-red-500 hover:text-red-600" onClick={() => { setDetailNotice(null); setDeleteId(n.id); }} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
            );

            if (!hasMedia) {
              return (
                <>
                  <DialogHeader className="sticky top-0 z-20 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-5 pb-4 bg-card">
                    <DialogTitle className="text-lg font-bold pr-8">{title}</DialogTitle>
                  </DialogHeader>
                  {detailsBody}
                  <div className="sticky bottom-0 z-20 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-3 bg-card border-t border-border/40">
                    {detailsFooter}
                  </div>
                </>
              );
            }

            return (
              <div className="flex flex-col md:flex-row h-full min-h-0 items-stretch">
                {/* Media pane — fills available space so image expands with modal */}
                <div className={`${detailExpanded ? "md:w-[75%]" : "md:w-[65%] md:min-w-[300px]"} flex-1 md:flex-none h-full min-h-0 min-w-0 flex items-center justify-center overflow-hidden relative`}>
                  {isPdf ? (
                    <PdfViewer url={n.fileUrl!} title={title} onClose={() => { setDetailNotice(null); setDetailExpanded(false); }} embedded />
                  ) : (
                    <PhotoViewer
                      images={images.map(u => ({ url: u, title }))}
                      index={0}
                      onClose={() => { setDetailNotice(null); setDetailExpanded(false); }}
                      embedded
                      isExpanded={detailExpanded}
                      onToggleExpand={() => setDetailExpanded(prev => !prev)}
                      onOpenFullScreen={(idx) => {
                        // On mobile: close modal and open full-screen viewer
                        setDetailNotice(null);
                        setDetailExpanded(false);
                        setPhotoViewer({ images: images.map(u => ({ url: u, title })), index: idx });
                      }}
                    />
                  )}
                </div>
                {/* Details sidebar — fixed title, scrollable list box, fixed footer */}
                <div className={`${detailExpanded ? "md:w-[25%] md:min-w-[200px]" : "md:w-[35%] md:min-w-[280px] md:max-w-[420px]"} shrink-0 max-md:max-h-[45vh] border-t md:border-t-0 md:border-l border-border/40 min-h-0 bg-card flex flex-col p-4 sm:p-5 gap-3`}>
                  <DialogHeader className="shrink-0">
                    <DialogTitle className="text-lg font-bold pr-2">{title}</DialogTitle>
                  </DialogHeader>
                  {/* The list lives in its own box — only this part scrolls */}
                  <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-border/40 bg-muted/10 p-3">
                    {detailsBody}
                  </div>
                  <div className="shrink-0 pt-3 border-t border-border/40">
                    {detailsFooter}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Event Detail Modal */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => { if (!open) setSelectedEvent(null); }}>
        <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              {selectedEvent && (
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: (EVENT_TYPE_COLORS[selectedEvent.type] || EVENT_TYPE_COLORS.other).dot || "#6b7280" }} />
              )}
              {selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              {selectedEvent.imageUrl && (
                <img src={selectedEvent.imageUrl} alt={selectedEvent.title} className="w-full max-h-64 object-cover rounded-xl" />
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="rounded-md">
                  {(EVENT_TYPE_COLORS[selectedEvent.type] || EVENT_TYPE_COLORS.other).label}
                </Badge>
                <Badge variant="outline" className="rounded-md">
                  <CalendarDays className="h-3 w-3 mr-1" />
                  {new Date(selectedEvent.startDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </Badge>
                {selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.startDate && (
                  <Badge variant="outline" className="rounded-md">
                    to {new Date(selectedEvent.endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </Badge>
                )}
              </div>
              {selectedEvent.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedEvent.description}</p>
              )}
              {selectedEvent.location && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span>{selectedEvent.location}</span>
                  </div>
                  {selectedEvent.latitude != null && selectedEvent.longitude != null && (
                    <div className="rounded-xl overflow-hidden border border-border/40 h-48">
                      <MiniMap latitude={selectedEvent.latitude} longitude={selectedEvent.longitude} />
                    </div>
                  )}
                  <a
                    href={selectedEvent.latitude != null && selectedEvent.longitude != null
                      ? `https://www.google.com/maps/dir/?api=1&destination=${selectedEvent.latitude},${selectedEvent.longitude}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.location)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                  >
                    <MapPin className="h-3 w-3" /> Get directions
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notice</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this notice? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteNotice} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Notices Confirmation */}
      <AlertDialog open={bulkDeleteNoticesConfirm} onOpenChange={setBulkDeleteNoticesConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedNoticeIds.size} Notice(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedNoticeIds.size} notice(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteNotices} className="bg-red-600 hover:bg-red-700">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Editor Confirmation */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved content. Are you sure you want to close? Your changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowCloseConfirm(false);
              setEditOpen(false);
              setEditingNotice(null);
            }} className="bg-amber-600 hover:bg-amber-700">
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settings Modal */}
      {showSettingsModal && isAdmin && (
        <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4" onClick={() => setShowSettingsModal(false)}>
          <div className="bg-card border border-border/40 rounded-none sm:rounded-2xl shadow-2xl w-full max-w-5xl h-[100dvh] sm:h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Sticky header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border/40 shrink-0 bg-card z-20">
              <h2 className="text-lg font-semibold">Settings</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowSettingsModal(false)} className="rounded-lg">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Mobile: horizontal scrollable tab bar */}
            <div className="sm:hidden flex gap-1.5 px-3 py-2 border-b border-border/40 overflow-x-auto shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {[
                { id: "meetings", label: "Meetings", icon: <CalendarDays className="h-3.5 w-3.5" /> },
                { id: "display", label: "Display", icon: <Building2 className="h-3.5 w-3.5" /> },
                { id: "conventions", label: "Conventions", icon: <CalendarClock className="h-3.5 w-3.5" /> },
                { id: "map", label: "Location", icon: <MapPin className="h-3.5 w-3.5" /> },
                { id: "events", label: "Events", icon: <CalendarDays className="h-3.5 w-3.5" /> },
                { id: "files", label: "Files", icon: <FolderClosed className="h-3.5 w-3.5" /> },
                { id: "backup", label: "Backup", icon: <Database className="h-3.5 w-3.5" /> },
                { id: "users", label: "Users", icon: <Users className="h-3.5 w-3.5" /> },
                { id: "reports", label: "Reports", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
                { id: "logs", label: "Activity", icon: <History className="h-3.5 w-3.5" /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id as "meetings" | "display" | "conventions" | "map" | "events" | "files" | "backup" | "users" | "reports" | "logs")}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                    settingsTab === tab.id ? "bg-indigo-500 text-white" : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Body: sidebar + content */}
            <div className="flex flex-1 min-h-0">
              {/* Left sidebar tabs — desktop only */}
              <div className="hidden sm:block w-48 shrink-0 border-r border-border/40 p-3 space-y-1 overflow-y-auto">
                {[
                  { id: "meetings", label: "Meetings", icon: <CalendarDays className="h-4 w-4" /> },
                  { id: "display", label: "Display", icon: <Building2 className="h-4 w-4" /> },
                  { id: "conventions", label: "Conventions", icon: <CalendarClock className="h-4 w-4" /> },
                  { id: "map", label: "Location", icon: <MapPin className="h-4 w-4" /> },
                  { id: "events", label: "Events", icon: <CalendarDays className="h-4 w-4" /> },
                  { id: "files", label: "File Manager", icon: <FolderClosed className="h-4 w-4" /> },
                  { id: "backup", label: "Backup & History", icon: <Database className="h-4 w-4" /> },
                  { id: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
                  { id: "reports", label: "Reports", icon: <ShieldCheck className="h-4 w-4" /> },
                  { id: "logs", label: "Activity Log", icon: <History className="h-4 w-4" /> },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSettingsTab(tab.id as "meetings" | "display" | "conventions" | "map" | "events" | "files" | "backup" | "users" | "reports" | "logs")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      settingsTab === tab.id ? "bg-indigo-500 text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Right content area */}
              <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
                {settingsTab === "meetings" && <SettingsPanel language={language} section="meetings" onSaved={fetchData} />}
                {settingsTab === "display" && <SettingsPanel language={language} section="display" onSaved={fetchData} />}
                {settingsTab === "conventions" && <SettingsPanel language={language} section="conventions" onSaved={fetchData} />}
                {settingsTab === "map" && <SettingsPanel language={language} section="map" onSaved={fetchData} />}
                {settingsTab === "events" && <EventsPanel />}
                {settingsTab === "files" && <FileManager />}
                {settingsTab === "backup" && <BackupHistory />}
                {settingsTab === "users" && <UsersPanel language={language} />}
                {settingsTab === "reports" && <ReportsPanel />}
                {settingsTab === "logs" && <LogsPanel />}
              </div>
            </div>

            {/* Sticky footer — only show close for file manager */}
            {(settingsTab === "files" || settingsTab === "backup" || settingsTab === "users" || settingsTab === "events") && (
              <div className="px-6 py-3 border-t border-border/40 shrink-0 bg-card flex justify-end">
                <Button variant="outline" onClick={() => setShowSettingsModal(false)} className="rounded-lg">Close</Button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Sidebar Content ─────────────────────────────────────

function SidebarContent({
  onSectionJump,
  categories,
  upcomingEventsCount,
  pinnedCount,
  rolesCount,
  hasMap,
  isAdmin,
  onOpenSettings,
  onToggleArchive,
  showArchive,
  activeCategory,
  onCategoryClick,
  categoryCounts,
  serverOnline,
}: {
  onSectionJump: (id: string) => void;
  categories: Category[];
  upcomingEventsCount: number;
  pinnedCount: number;
  rolesCount: number;
  hasMap: boolean;
  isAdmin: boolean;
  onOpenSettings: () => void;
  onToggleArchive: () => void;
  showArchive: boolean;
  activeCategory: string | null;
  onCategoryClick: (id: string | null) => void;
  categoryCounts: Record<string, number>;
  serverOnline: boolean;
}) {
  const navItem = (icon: React.ReactNode, label: string, onClick: () => void, badge?: number) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">{badge}</span>
      )}
    </button>
  );

  return (
    <nav className="flex flex-col gap-1 overflow-y-auto flex-1">
      <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Sections</div>
      {navItem(<CalendarDays className="h-5 w-5" />, "Calendar", () => onSectionJump("calendar"))}

      {categories.length > 0 && (
        <>
          <div className="px-3 py-2 mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Categories</div>
          <button
            onClick={() => onCategoryClick(null)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${!activeCategory ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
          >
            <span className="h-3 w-3 rounded-full shrink-0 bg-indigo-400" />
            <span className="flex-1 text-left">All Notices</span>
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => onCategoryClick(activeCategory === c.id ? null : c.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                activeCategory === c.id
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {c.color && <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />}
              <span className="flex-1 text-left truncate">{c.name}</span>
              {(categoryCounts[c.id] || 0) > 0 && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">{categoryCounts[c.id]}</span>
              )}
            </button>
          ))}
        </>
      )}

      {navItem(<MapPin className="h-5 w-5" />, "Location", () => onSectionJump("map"))}

      {isAdmin && (
        <>
          <div className="px-3 py-2 mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Admin</div>
          <button
            onClick={onToggleArchive}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${showArchive ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
          >
            <Archive className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-left">Archived</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-left">Manage</span>
          </button>
        </>
      )}

      {/* Server status */}
      <div className="mt-auto pt-3">
        <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium ${serverOnline ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400" : "bg-red-50 dark:bg-red-950/20 text-red-500"}`}>
          <span>{serverOnline ? "Connected to server" : "Reconnecting..."}</span>
          <span className={`relative flex h-2 w-2 ${serverOnline ? "" : "animate-pulse"}`}>
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${serverOnline ? "bg-emerald-400 animate-ping" : "bg-red-400"} ${serverOnline ? "" : "animate-none"}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${serverOnline ? "bg-emerald-500" : "bg-red-500"}`} />
          </span>
        </div>
      </div>
    </nav>
  );
}

// ─── Dashboard Section ───────────────────────────────────

function DashboardSection({ id, title, icon, children }: {
  id: string; title: string; icon: React.ReactNode; expanded?: boolean; onToggle?: () => void; children: React.ReactNode;
}) {
  return (
    <section id={id} className="fade-in-up scroll-mt-20">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="text-base sm:text-lg font-bold tracking-tight">{title}</h2>
      </div>
      <div>
        {children}
      </div>
    </section>
  );
}

// ─── Masonry Grid ────────────────────────────────────────

function MasonryGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-2 xl:columns-3 2xl:columns-4 gap-2 sm:gap-4 [&>*]:mb-2 sm:[&>*]:mb-4 [&>*]:break-inside-avoid w-full">
      {children}
    </div>
  );
}

// ─── Padlet-style Notice Card ────────────────────────────

function HoverImage({ src, alt, className, onClick }: { src: string; alt: string; className?: string; onClick?: () => void }) {
  return (
    <div
      className={`relative overflow-hidden ${onClick ? "cursor-pointer" : ""} ${className || ""}`}
      onClick={onClick}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full h-full object-cover"
      />
    </div>
  );
}

function PadletCard({ notice, language, onCardClick, bookmarked, onToggleBookmark, isAdmin, onEdit, onDelete, onTogglePin, onArchive, highlight, siteDomain, bulkSelectMode, isSelected, onToggleSelect }: {
  notice: Notice;
  language: "en" | "tl";
  onCardClick: (notice: Notice) => void;
  bookmarked: boolean;
  onToggleBookmark: (id: string) => void;
  isAdmin?: boolean;
  onEdit?: (notice: Notice) => void;
  onDelete?: (id: string) => void;
  onTogglePin?: (notice: Notice) => void;
  onArchive?: (notice: Notice) => void;
  highlight?: (text: string) => React.ReactNode;
  siteDomain?: string;
  bulkSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const hl = highlight || ((t: string) => t);
  const title = language === "tl" && notice.titleTl ? notice.titleTl : notice.title;
  const description = language === "tl" && notice.descriptionTl ? notice.descriptionTl : notice.description;
  const recent = isRecentlyUpdated(notice.updatedAt);
  const updateDate = notice.updatedAt || notice.createdAt;
  const imageUrl = isImageFile(notice.thumbnailUrl, notice.fileName) ? notice.thumbnailUrl : (isImageFile(notice.fileUrl, notice.fileName) ? notice.fileUrl : null);
  const isPdf = isPdfFile(notice.fileUrl, notice.fileName);
  const countdown = notice.eventStartDate ? getCountdown(notice.eventStartDate) : null;
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  return (
    <Card
      className={`break-inside-avoid card-hover rounded-xl sm:rounded-2xl border-border/40 cursor-pointer ${bulkSelectMode ? "relative" : ""} ${isSelected ? "border-2 border-indigo-500 ring-2 ring-indigo-500/30" : ""} ${recent && !isSelected ? "recently-updated border-indigo-300 dark:border-indigo-700/50" : ""}`}
      onClick={() => bulkSelectMode ? onToggleSelect?.(notice.id) : onCardClick(notice)}
    >
      {/* Bulk select checkbox overlay */}
      {bulkSelectMode && (
        <div className="absolute top-2 left-2 z-20">
          <div className={`flex items-center justify-center h-6 w-6 rounded-md border-2 transition-all ${isSelected ? "bg-indigo-500 border-indigo-500" : "bg-white/80 dark:bg-black/60 border-muted-foreground/40"}`}>
            {isSelected && <Check className="h-4 w-4 text-white" />}
          </div>
        </div>
      )}
      {/* Image — click opens the detail modal */}
      {imageUrl && (
        <div className="relative overflow-visible rounded-t-2xl group">
          <HoverImage src={imageUrl} alt={title} className="h-28 sm:h-48" />
          {notice.isPinned && (
            <div className="absolute top-3 left-3 bg-amber-500 text-white rounded-full p-1.5 shadow-lg z-10">
              <Pin className="h-3 w-3" />
            </div>
          )}
          <div className="absolute top-3 right-3 bg-black/40 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <ImageIcon className="h-3 w-3" />
          </div>
        </div>
      )}

      {/* PDF first-page preview */}
      {!imageUrl && isPdf && notice.fileUrl && (
        <div className="relative overflow-hidden rounded-t-xl sm:rounded-t-2xl bg-neutral-100 dark:bg-neutral-900 group/pdf">
          <iframe
            src={`${notice.fileUrl}#toolbar=0&navpanes=0&view=FitH`}
            className="w-full h-32 sm:h-44 border-0 pointer-events-none"
            title={title}
            loading="lazy"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 sm:px-4 py-1.5 sm:py-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <FileText className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              </div>
              <p className="text-[10px] sm:text-xs font-medium text-white truncate">{notice.fileName || "PDF Document"}</p>
            </div>
          </div>
          {notice.isPinned && (
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-amber-500 text-white rounded-full p-1.5 shadow-lg z-10">
              <Pin className="h-3 w-3" />
            </div>
          )}
        </div>
      )}

      <CardContent className="p-2.5 sm:p-4 md:p-5 space-y-2 sm:space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-1.5 sm:gap-2">
          <h3 className={`font-bold text-xs sm:text-sm md:text-base leading-snug ${!imageUrl && !isPdf && notice.isPinned ? "flex items-center gap-1.5" : ""}`}>
            {!imageUrl && !isPdf && notice.isPinned && <Pin className="h-4 w-4 text-amber-500 shrink-0" />}
            {hl(title)}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            {recent && (
              <span className="recently-updated-badge text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" />New
              </span>
            )}
          </div>
        </div>

        {/* Category badge */}
        {notice.category && (
          <Badge variant="outline" className="text-[10px] sm:text-xs rounded-md">
            {notice.category.name}
          </Badge>
        )}

        {/* Countdown */}
        {countdown && !countdown.isPast && (
          <div className="flex items-center gap-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 px-3 py-2 border border-indigo-200 dark:border-indigo-800/40">
            <CalendarCountdown className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              {countdown.days > 0 && `${countdown.days}d `}
              {countdown.hours > 0 && `${countdown.hours}h `}
              {countdown.days === 0 && `${countdown.mins}m `}
              until event
            </span>
          </div>
        )}

        {/* Location */}
        {notice.location && !bulkSelectMode && (
          <a
            href={notice.latitude != null && notice.longitude != null
              ? `https://www.google.com/maps/dir/?api=1&destination=${notice.latitude},${notice.longitude}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(notice.location)}`
            }
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/20 px-3 py-2 border border-blue-200 dark:border-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors"
          >
            <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">{notice.location}</span>
          </a>
        )}

        {/* Description */}
        {description && (
          <p className="text-sm sm:text-sm text-muted-foreground line-clamp-3 sm:line-clamp-4 leading-relaxed">{hl(description)}</p>
        )}

        {/* Text content */}
        {!imageUrl && !isPdf && !notice.fileUrl && notice.content && (
          <p className="text-sm sm:text-sm text-muted-foreground line-clamp-3 sm:line-clamp-4 whitespace-pre-wrap leading-relaxed">{hl(notice.content)}</p>
        )}

        {/* Link */}
        {notice.linkUrl && !bulkSelectMode && (
          <a href={notice.linkUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
            {notice.linkIcon ? (
              <img src={notice.linkIcon} alt="" className="h-4 w-4 rounded shrink-0" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" />
            )}
            {notice.linkLabel || notice.linkUrl}
          </a>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-border/40 text-xs sm:text-xs text-muted-foreground">
          <span>{timeAgo(updateDate, language)}</span>
          {!bulkSelectMode && (
          <div className="flex items-center gap-0.5">
            {/* Share */}
            <Button variant="ghost" size="sm" className="h-9 w-9 sm:h-7 sm:w-7 p-0 rounded-lg" onClick={(e) => { e.stopPropagation(); shareUrl(`/notice/${notice.id}`, title, siteDomain); }}>
              <Share2 className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
            </Button>
            {/* File download */}
            {notice.fileUrl && (
              <a href={notice.fileUrl} download onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-9 w-9 sm:h-7 sm:w-7 p-0 rounded-lg">
                  <Download className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                </Button>
              </a>
            )}
            {/* Admin controls — inline on desktop, 3-dot menu on mobile */}
            {isAdmin && (
              <>
                {/* Desktop inline buttons */}
                <div className="hidden sm:flex items-center gap-0.5">
                  <div className="w-px h-4 bg-border/60 mx-1" />
                  <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 rounded-lg ${notice.isPinned ? "text-amber-500" : ""}`} onClick={(e) => { e.stopPropagation(); onTogglePin?.(notice); }} title="Pin/Unpin">
                    <Pin className={`h-3 w-3 ${notice.isPinned ? "fill-amber-500" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg" onClick={(e) => { e.stopPropagation(); onEdit?.(notice); }} title="Edit">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg" onClick={(e) => { e.stopPropagation(); onArchive?.(notice); }} title="Archive">
                    <Archive className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg text-red-500 hover:text-red-600" onClick={(e) => { e.stopPropagation(); onDelete?.(notice.id); }} title="Delete">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {/* Mobile 3-dot menu */}
                <div className="sm:hidden relative">
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg" onClick={(e) => { e.stopPropagation(); setShowAdminMenu(o => !o); }} title="More">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                  {showAdminMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowAdminMenu(false); }} />
                      <div className="absolute right-0 bottom-full mb-1 z-50 w-36 rounded-xl border border-border/40 bg-card shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); onTogglePin?.(notice); setShowAdminMenu(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${notice.isPinned ? "text-amber-500" : "hover:bg-accent"}`}
                        >
                          <Pin className={`h-4 w-4 ${notice.isPinned ? "fill-amber-500" : ""}`} /> {notice.isPinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onEdit?.(notice); setShowAdminMenu(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
                        >
                          <Edit className="h-4 w-4" /> Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onArchive?.(notice); setShowAdminMenu(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
                        >
                          <Archive className="h-4 w-4" /> Archive
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete?.(notice.id); setShowAdminMenu(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Event Card ──────────────────────────────────────────

function EventCard({ event, language, onClick }: { event: SpecialEvent; language: "en" | "tl"; onClick?: (event: SpecialEvent) => void }) {
  const colors = EVENT_TYPE_COLORS[event.type] || EVENT_TYPE_COLORS.other;
  const title = event.title;
  const typeLabel = colors.label;

  const daysUntil = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(event.startDate + "T00:00:00");
    const diff = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  })();

  const hasLocation = !!(event.latitude && event.longitude) || !!event.location;

  return (
    <Card className={`snap-start shrink-0 w-[160px] sm:w-[200px] card-hover rounded-xl border-l-4 ${colors.border} border-y border-r border-border/40 bg-card overflow-hidden cursor-pointer`} onClick={() => onClick?.(event)}>
      {event.imageUrl && (
        <div className="relative w-full h-32 overflow-hidden bg-muted/20">
          <img src={event.imageUrl} alt={title} className="w-full h-full object-contain" loading="lazy" />
        </div>
      )}
      <CardContent className="p-2.5 space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center justify-center min-w-[36px] bg-muted/40 rounded-lg py-1 px-1.5 shrink-0">
            <span className={`text-[8px] font-bold uppercase ${colors.accent}`}>{getMonthShort(event.startDate)}</span>
            <span className="text-sm font-bold leading-none">{getDayNum(event.startDate)}</span>
            {event.endDate && event.endDate !== event.startDate && (
              <span className="text-[7px] text-muted-foreground mt-0.5">to {getDayNum(event.endDate)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold leading-tight line-clamp-2">{title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {(() => {
                const s = parseDate(event.startDate);
                if (event.endDate && event.endDate !== event.startDate) {
                  const e = parseDate(event.endDate);
                  const sameMonth = s.getMonth() === e.getMonth();
                  const sameYear = s.getFullYear() === e.getFullYear();
                  if (sameMonth && sameYear) {
                    return `${s.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })} — ${e.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}, ${e.getFullYear()}`;
                  }
                  return `${s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} — ${e.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, ${e.getFullYear()}`;
                }
                return s.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
              })()}
            </p>
            {hasLocation && (
              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{event.location}</span>
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Meeting Card ────────────────────────────────────────

function MeetingCard({ meeting, language, formatDate, onOpenPdf, onOpenPhoto }: { meeting: Meeting; language: "en" | "tl"; formatDate: (d: string) => string; onOpenPdf: (url: string, title: string) => void; onOpenPhoto: (url: string, title: string) => void }) {
  return (
    <Card className="break-inside-avoid card-hover rounded-2xl border-indigo-200/50 dark:border-indigo-800/40 bg-gradient-to-br from-indigo-50/40 to-purple-50/20 dark:from-indigo-950/15 dark:to-purple-950/10">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <Badge variant={meeting.meetingType === "midweek" ? "default" : "secondary"} className="rounded-lg">
          {meeting.meetingType === "midweek" ? t("midweekMeeting", language) : t("weekendMeeting", language)}
        </Badge>
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 shrink-0 text-indigo-500" />{formatDate(meeting.date)}
        </div>
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0 text-indigo-500" />{meeting.time}
        </div>
        {meeting.location && (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-indigo-500" />{meeting.location}
          </div>
        )}
        {meeting.scheduleFileUrl && (
          <div className="flex items-center gap-3 pt-3 border-t border-border/40">
            {isPdfFile(meeting.scheduleFileUrl, meeting.scheduleFileName) ? (
              <button onClick={() => onOpenPdf(meeting.scheduleFileUrl!, t("viewSchedule", language))} className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                <FileText className="h-4 w-4" />{t("viewSchedule", language)}
              </button>
            ) : (
              <button onClick={() => isImageFile(meeting.scheduleFileUrl, meeting.scheduleFileName) ? onOpenPhoto(meeting.scheduleFileUrl!, t("viewSchedule", language)) : onOpenPdf(meeting.scheduleFileUrl!, t("viewSchedule", language))} className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                <FileText className="h-4 w-4" />{t("viewSchedule", language)}
              </button>
            )}
            <a href={meeting.scheduleFileUrl} download className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 hover:underline font-medium">
              <Download className="h-4 w-4" />{t("download", language)}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Pinned Schedule Strip (current week meeting + public talk) ──

// Open a clean print window for a schedule notice — used for printing the
// schedule list to post on the noticeboard
function printScheduleNotice(title: string, content: string) {
  const variant: "midweek" | "public-talk" = /public\s+talk/i.test(title) ? "public-talk" : "midweek";
  const fields = parseScheduleFieldsShared(content);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = fields.map(f => {
    const cfg = getFieldConfig(f.key, variant);
    return `<tr><td class="lbl">${esc(cfg.label || f.key)}</td><td class="${f.key === "TalkTheme" ? "bold" : ""}">${esc(f.value)}</td></tr>`;
  }).join("");
  const html = `<!doctype html><html><head><title>${esc(title)}</title><style>
    body { font-family: Georgia, 'Times New Roman', serif; margin: 40px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .sub { color: #555; font-size: 13px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 10px; border-bottom: 1px solid #ddd; font-size: 14px; vertical-align: top; }
    td.lbl { width: 200px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; font-weight: 700; color: #444; padding-top: 11px; }
    td.bold { font-weight: 700; }
    @media print { body { margin: 10mm; } }
  </style></head><body>
    <h1>${esc(title)}</h1>
    <div class="sub">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
    <table>${rows}</table>
  </body></html>`;
  const w = window.open("", "_blank", "width=720,height=860");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

// "This week at a glance" — compact strip with this week's roles and upcoming
// special events. Meeting times live in the schedule strip above.
function ThisWeekGlance({ roles, events, onOpenPhoto }: {
  roles: RoleAssignment[];
  events: SpecialEvent[];
  onOpenPhoto: (url: string, title: string) => void;
}) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  // Monday of the current week
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const mondayStr = monday.toISOString().split("T")[0];
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const sundayStr = sunday.toISOString().split("T")[0];

  const weekRoles = roles.filter(r => r.isPublished && r.weekDate && r.weekDate >= mondayStr && r.weekDate <= sundayStr);
  const nextEvents = [...events]
    .filter(e => (e.endDate || e.startDate) >= todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 3);

  if (weekRoles.length === 0 && nextEvents.length === 0) return null;

  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const card = "rounded-2xl border border-border/40 bg-card p-4 space-y-2.5 min-w-0";
  const cardTitle = "flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* This week's roles */}
      {weekRoles.length > 0 && (
        <div className={card}>
          <div className={cardTitle}><UserCog className="h-4 w-4 text-blue-600" /> This Week's Roles</div>
          {weekRoles.map(r => (
            <div key={r.id} className="rounded-xl bg-muted/30 border border-border/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${r.meetingType === "midweek" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"}`}>
                  {r.meetingType === "midweek" ? "Midweek" : "Weekend"}
                </span>
                {r.fileUrl && (
                  <button onClick={() => onOpenPhoto(r.fileUrl!, r.title)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate">
                    View role sheet
                  </button>
                )}
              </div>
              {r.ocrText && (
                <p className="text-xs leading-relaxed mt-1.5 whitespace-pre-wrap line-clamp-4">{r.ocrText}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Coming up */}
      {nextEvents.length > 0 && (
        <div className={card}>
          <div className={cardTitle}><Star className="h-4 w-4 text-amber-500" /> Coming Up</div>
          {nextEvents.map(e => (
            <div key={e.id} className="flex items-center gap-2.5 rounded-xl bg-muted/30 border border-border/30 px-3 py-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
                <Star className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(e.startDate)}{e.endDate && e.endDate !== e.startDate ? ` – ${fmtDate(e.endDate)}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PinnedScheduleStrip({ midweekSchedules, publicTalkSchedules, meetings, language, isAdmin, onOpenPdf, onOpenPhoto, onCardClick, onEdit, onDelete, midweekDay = 2, weekendDay = 0 }: {
  midweekSchedules: Notice[];
  publicTalkSchedules: Notice[];
  meetings: Meeting[];
  language: "en" | "tl";
  isAdmin: boolean;
  onOpenPdf: (url: string, title: string) => void;
  onOpenPhoto: (url: string, title: string) => void;
  onCardClick: (notice: Notice) => void;
  onEdit: (notice: Notice) => void;
  onDelete: (id: string) => void;
  midweekDay?: number;
  weekendDay?: number;
}) {
  const today = new Date().toISOString().split("T")[0];
  const todayDate = new Date(today + "T00:00:00");

  // Calculate the actual meeting date within a week range
  // e.g. for Aug 10-16 with midweek on Tuesday (day 2), the meeting date is Aug 12
  const getMeetingDate = (schedule: Notice, meetingDay: number): string | null => {
    const start = schedule.eventStartDate;
    const end = schedule.eventEndDate || start;
    if (!start) return null;
    const startDate = new Date(start + "T00:00:00");
    const endDate = new Date(end + "T00:00:00");
    // Walk through the week range to find the meeting day
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === meetingDay) {
        return d.toISOString().split("T")[0];
      }
    }
    // If meeting day not in range, fall back to start date
    return start;
  };

  // Find current or next upcoming schedule — "current" means the meeting day
  // hasn't passed yet. Once the meeting day passes, the next week becomes current.
  const findCurrent = (schedules: Notice[], meetingDay: number) => {
    // Compute meeting date for each schedule and filter to upcoming
    const withMeetingDate = schedules
      .map(s => {
        const meetingDate = getMeetingDate(s, meetingDay);
        return { schedule: s, meetingDate };
      })
      .filter(({ meetingDate }) => meetingDate && meetingDate >= today)
      .sort((a, b) => (a.meetingDate || "").localeCompare(b.meetingDate || ""));
    return withMeetingDate[0]?.schedule || null;
  };

  const currentMidweek = findCurrent(midweekSchedules, midweekDay);
  const currentPublicTalk = findCurrent(publicTalkSchedules, weekendDay);

  if (!currentMidweek && !currentPublicTalk) return null;

  const fmtRange = (start: string | null, end: string | null) => {
    if (!start) return "No date";
    const sd = new Date(start + "T00:00:00");
    if (!end || end === start) return sd.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const ed = new Date(end + "T00:00:00");
    return `${sd.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${ed.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  };

  const renderScheduleCard = (schedule: Notice | null, type: "midweek" | "public-talk") => {
    // Next upcoming meeting of this type — supplies the time/location even
    // when no schedule image has been uploaded yet
    const nextMeeting = meetings
      .filter(m => m.isPublished && m.meetingType === (type === "midweek" ? "midweek" : "weekend") && m.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (!schedule) {
      return (
        <div className={`w-full sm:w-[280px] rounded-2xl border-2 border-dashed border-border/30 p-4 shrink-0 ${type === "midweek" ? "bg-blue-50/30 dark:bg-blue-950/10" : "bg-purple-50/30 dark:bg-purple-950/10"}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-white shrink-0 ${type === "midweek" ? "bg-blue-400" : "bg-purple-400"}`}>
              {type === "midweek" ? <BookOpen className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </div>
            <span className="text-sm font-bold">{type === "midweek" ? "Midweek Meeting" : "Public Talk"}</span>
          </div>
          {nextMeeting ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3 shrink-0" />
              {new Date(nextMeeting.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {nextMeeting.time}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No schedule uploaded yet</p>
          )}
        </div>
      );
    }

    const meetingDayNum = type === "midweek" ? midweekDay : weekendDay;
    const meetingDate = getMeetingDate(schedule, meetingDayNum);
    const isToday = meetingDate ? today === meetingDate : (today >= (schedule.eventStartDate || "") && today <= (schedule.eventEndDate || schedule.eventStartDate || ""));
    const isThisWeek = (() => {
      const start = schedule.eventStartDate || "";
      const end = schedule.eventEndDate || start;
      return today >= start && today <= end;
    })();

    return (
      <div
        className={`w-full sm:w-[280px] rounded-2xl border-2 p-3.5 shrink-0 cursor-pointer hover:shadow-lg transition-all ${isThisWeek ? "border-green-500 shadow-md shadow-green-500/20" : isToday ? "border-green-400" : type === "midweek" ? "border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-950/20" : "border-purple-200 dark:border-purple-800/40 bg-purple-50 dark:bg-purple-950/20"}`}
        onClick={() => onCardClick(schedule)}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-white shrink-0 ${type === "midweek" ? "bg-blue-500" : "bg-purple-500"}`}>
            {type === "midweek" ? <BookOpen className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight truncate">
              {type === "midweek" ? "Midweek Meeting" : "Public Talk"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {fmtRange(schedule.eventStartDate || null, schedule.eventEndDate || null)}
              {nextMeeting?.time && <span className="ml-1">· {nextMeeting.time}</span>}
              {isThisWeek && <span className="text-green-600 dark:text-green-400 font-bold ml-1">· This week</span>}
            </p>
          </div>
          {isToday && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-green-500 text-white text-[9px] font-bold tracking-wide flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
              TODAY
            </span>
          )}
        </div>

        {/* Field preview — always for public talk (speaker/theme basics),
            for midweek only when there's no image on the schedule */}
        {(type === "public-talk" || !schedule.fileUrl) && (() => {
          const allFields = parseScheduleFieldsShared(schedule.content || "");
          const hasValue = (v: string) => /[\p{L}\p{N}]/u.test(v);
          // Public talk: always surface the basics (speaker, theme, congregation)
          // — a "—" marks missing data; midweek: first fields as stored
          const previewFields = type === "public-talk"
            ? ["Speaker", "TalkTheme", "Congregation"].map(k => {
                const found = allFields.find(f => f.key === k && hasValue(f.value));
                return found || { key: k, value: "—" };
              })
            : allFields.filter(f => hasValue(f.value)).slice(0, 3);
          if (previewFields.length === 0) return null;
          return (
            <div className="space-y-1">
              {previewFields.map((f, i) => {
                const cfg = getFieldConfig(f.key, type === "midweek" ? "midweek" : "public-talk");
                const Icon = cfg.icon;
                return (
                  <div key={i} className={`flex items-center gap-1.5 rounded-lg border ${cfg.border} ${cfg.bg} px-2 py-1 min-w-0`}>
                    <Icon className={`h-3 w-3 ${cfg.text} shrink-0`} />
                    <span className={`text-[10px] font-bold uppercase shrink-0 ${cfg.text}`}>{cfg.label || f.key}</span>
                    <span className={`text-[11px] truncate ${f.key === "TalkTheme" ? "font-bold" : "font-medium"}`}>{f.value}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Thumbnail / file link */}
        {schedule.fileUrl && (
          <div className="space-y-2">
            {isImageFile(schedule.fileUrl, schedule.fileName) && (
              <LazyImage
                src={schedule.fileUrl}
                alt={schedule.title}
                className="rounded-lg w-full h-32 object-contain bg-muted/30 shrink-0"
              />
            )}
            <div className="flex items-center gap-2">
              {isPdfFile(schedule.fileUrl, schedule.fileName) ? (
                <button onClick={(e) => { e.stopPropagation(); onOpenPdf(schedule.fileUrl!, schedule.title); }} className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                  <FileText className="h-3.5 w-3.5" />View Schedule
                </button>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); isImageFile(schedule.fileUrl, schedule.fileName) ? onOpenPhoto(schedule.fileUrl!, schedule.title) : onOpenPdf(schedule.fileUrl!, schedule.title); }} className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                  <FileText className="h-3.5 w-3.5" />View Schedule
                </button>
              )}
              <a href={schedule.fileUrl} download onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 hover:underline font-medium">
                <Download className="h-3.5 w-3.5" />Download
              </a>
              {isAdmin && (
                <div className="flex gap-0.5 ml-auto shrink-0">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-md" onClick={(e) => { e.stopPropagation(); onEdit(schedule); }}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-md text-red-500" onClick={(e) => { e.stopPropagation(); onDelete(schedule.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:w-fit">
      {renderScheduleCard(currentMidweek, "midweek")}
      {renderScheduleCard(currentPublicTalk, "public-talk")}
    </div>
  );
}

// ─── Schedule Carousel ───────────────────────────────────

// Parse schedule content into structured fields with variant-aware colors + icons
function parseScheduleFields(content: string | null, variant: ScheduleVariant = "midweek"): { key: string; name: string; value: string; bg: string; border: string; text: string; iconBg: string; Icon: React.ComponentType<{ className?: string }> }[] {
  const raw = parseScheduleFieldsShared(content);
  return raw.map(f => {
    const cfg = getFieldConfig(f.key, variant);
    return {
      key: f.key,
      name: cfg.label || f.key,
      value: f.value,
      bg: cfg.bg,
      border: cfg.border,
      text: cfg.text,
      iconBg: cfg.iconBg,
      Icon: cfg.icon,
    };
  });
}

function ScheduleCarousel({ schedules, language, isAdmin, onOpenPdf, onOpenPhoto, onCardClick, onEdit, onDelete }: {
  schedules: Notice[];
  language: "en" | "tl";
  isAdmin: boolean;
  onOpenPdf: (url: string, title: string) => void;
  onOpenPhoto: (url: string, title: string) => void;
  onCardClick: (notice: Notice) => void;
  onEdit: (notice: Notice) => void;
  onDelete: (id: string) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [itemsPerView, setItemsPerView] = useState(2);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(300);

  // Sort by eventStartDate ascending
  const sorted = useMemo(() => {
    return [...schedules].sort((a, b) => {
      const da = a.eventStartDate || "9999-99-99";
      const db = b.eventStartDate || "9999-99-99";
      return da.localeCompare(db);
    });
  }, [schedules]);

  // Show upcoming schedules; fall back to most recent past only if no upcoming
  const visibleSchedules = useMemo(() => {
    const past = sorted.filter(s => (s.eventEndDate || s.eventStartDate || "") < today);
    const upcoming = sorted.filter(s => (s.eventEndDate || s.eventStartDate || "") >= today);
    return upcoming.length > 0 ? upcoming : past.slice(-1);
  }, [sorted, today]);

  const isPast = (s: Notice) => (s.eventEndDate || s.eventStartDate || "") < today;
  const isToday = (s: Notice) => {
    const start = s.eventStartDate || "";
    const end = s.eventEndDate || start;
    return today >= start && today <= end;
  };

  const currentScheduleId = visibleSchedules.find(s => !isPast(s))?.id;
  const isCurrent = (s: Notice) => s.id === currentScheduleId;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "No date";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start) return "No date";
    const sd = new Date(start + "T00:00:00");
    if (!end || end === start) return sd.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const ed = new Date(end + "T00:00:00");
    return `${sd.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${ed.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  };

  const isMidweek = (s: Notice) => s.title.toLowerCase().includes("midweek");

  // Dynamically calculate items per view based on container width
  useEffect(() => {
    const updateItems = () => {
      if (!scrollRef.current) return;
      const width = scrollRef.current.offsetWidth;
      const isMobile = width < 640;
      const cw = isMobile ? Math.min(width, 280) : 300;
      const gap = 12;
      const fit = Math.max(1, Math.floor((width + gap) / (cw + gap)));
      setCardWidth(cw);
      setItemsPerView(Math.min(fit, visibleSchedules.length || 1));
    };
    updateItems();
    const observer = new ResizeObserver(updateItems);
    if (scrollRef.current) observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, [visibleSchedules.length]);

  // Scroll to current entry on mount
  useEffect(() => {
    const currentIdx = visibleSchedules.findIndex(s => !isPast(s));
    if (currentIdx >= 0) setScrollIndex(Math.max(0, currentIdx));
  }, [visibleSchedules]);

  const maxScrollIndex = Math.max(0, visibleSchedules.length - itemsPerView);
  const clampedScrollIndex = Math.min(scrollIndex, maxScrollIndex);

  const scrollBy = (delta: number) => {
    setScrollIndex(i => Math.max(0, Math.min(maxScrollIndex, i + delta)));
  };

  if (visibleSchedules.length === 0) return null;

  const canScrollLeft = clampedScrollIndex > 0;
  const canScrollRight = clampedScrollIndex < maxScrollIndex;

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {visibleSchedules.map((s, i) => {
            const sPast = isPast(s);
            const sCurrent = isCurrent(s);
            const isActive = i >= clampedScrollIndex && i < clampedScrollIndex + itemsPerView;
            return (
              <button
                key={s.id}
                onClick={() => setScrollIndex(Math.max(0, Math.min(maxScrollIndex, i)))}
                className={`shrink-0 h-2 rounded-full transition-all ${
                  sCurrent ? "bg-green-500 w-4" :
                  isActive ? "w-4 bg-indigo-500" :
                  sPast ? "w-1.5 bg-muted-foreground/30" :
                  "w-1.5 bg-muted-foreground/50"
                }`}
                title={formatDateRange(s.eventStartDate || null, s.eventEndDate || null)}
              />
            );
          })}
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="rounded-lg h-10 w-10 sm:h-8 sm:w-8 shrink-0" onClick={() => scrollBy(-1)} disabled={!canScrollLeft}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="rounded-lg h-10 w-10 sm:h-8 sm:w-8 shrink-0" onClick={() => scrollBy(1)} disabled={!canScrollRight}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Carousel viewport — extra top padding so the CURRENT badge (-top-2) isn't clipped */}
      <div ref={scrollRef} className="overflow-hidden pt-6 pb-3 -my-3">
        <div
          className="flex gap-3 transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${clampedScrollIndex * (cardWidth + 12)}px)` }}
        >
          {visibleSchedules.map((schedule) => {
            const midweek = isMidweek(schedule);
            const colors = midweek
              ? { bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-200 dark:border-blue-800/40", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300", dot: "bg-blue-500" }
              : { bg: "bg-purple-50 dark:bg-purple-950/20", border: "border-purple-200 dark:border-purple-800/40", badge: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300", dot: "bg-purple-500" };
            const past = isPast(schedule);
            const today_ = isToday(schedule);
            const current = isCurrent(schedule);

            return (
              <div
                key={schedule.id}
                className="shrink-0"
                style={{ width: `min(${cardWidth}px, 100%)` }}
              >
                <Card
                  onClick={() => onCardClick(schedule)}
                  className={`relative rounded-2xl transition-all h-full cursor-pointer hover:shadow-lg ${current ? "border-[3px] border-green-500 shadow-xl shadow-green-500/50 ring-2 ring-green-500/30 bg-green-50 dark:bg-green-950/30" : past ? "border border-border/20 opacity-50" : today_ ? "border-2 border-teal-400 shadow-md" : `border-2 ${colors.border}`} ${current ? "" : colors.bg}`}>
                  {current && (
                    <div className="absolute -top-2 left-3 z-10 px-2 py-0.5 rounded-full bg-green-500 text-white text-[10px] font-bold tracking-wide shadow-md flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      CURRENT
                    </div>
                  )}
                  <CardContent className="p-3.5 space-y-2.5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${colors.badge}`}>
                          {midweek ? "MW" : "WE"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-tight truncate">{formatDateRange(schedule.eventStartDate || null, schedule.eventEndDate || null)}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                            <span className="text-[10px] text-muted-foreground">
                              {midweek ? t("midweekMeeting", language) : t("weekendMeeting", language)}
                            </span>
                            {past && <span className="text-[10px] text-muted-foreground font-medium">· Past</span>}
                            {current && !today_ && <span className="text-[10px] text-green-600 dark:text-green-400 font-bold">· Current</span>}
                            {today_ && <span className="text-[10px] text-teal-600 font-bold">· This week</span>}
                          </div>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-0.5 shrink-0">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-md" onClick={(e) => { e.stopPropagation(); onEdit(schedule); }}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-md text-red-500" onClick={(e) => { e.stopPropagation(); onDelete(schedule.id); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Schedule file */}
                    {schedule.fileUrl && (
                      <>
                        {isImageFile(schedule.fileUrl, schedule.fileName) && (
                          <LazyImage
                            src={schedule.fileUrl}
                            alt={schedule.title}
                            className="rounded-lg w-full max-h-40 object-cover"
                          />
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          {isPdfFile(schedule.fileUrl, schedule.fileName) ? (
                            <button onClick={(e) => { e.stopPropagation(); onOpenPdf(schedule.fileUrl!, schedule.title); }} className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                              <FileText className="h-3.5 w-3.5" />View Schedule
                            </button>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); isImageFile(schedule.fileUrl, schedule.fileName) ? onOpenPhoto(schedule.fileUrl!, schedule.title) : onOpenPdf(schedule.fileUrl!, schedule.title); }} className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                              <FileText className="h-3.5 w-3.5" />View Schedule
                            </button>
                          )}
                          <a href={schedule.fileUrl} download onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 hover:underline font-medium">
                            <Download className="h-3.5 w-3.5" />Download
                          </a>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Role Card ───────────────────────────────────────────

function RolesCarousel({ roles, language, isAdmin, onOpenPdf, onOpenPhoto, onEdit, onDelete, onShowGrid }: {
  roles: RoleAssignment[];
  language: "en" | "tl";
  isAdmin: boolean;
  onOpenPdf: (url: string, title: string) => void;
  onOpenPhoto: (url: string, title: string) => void;
  onEdit: (role: RoleAssignment) => void;
  onDelete: (id: string) => void;
  onShowGrid: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [itemsPerView, setItemsPerView] = useState(2);
  const [scrollIndex, setScrollIndex] = useState(0);

  // Sort by weekDate ascending, nulls last
  const sorted = useMemo(() => {
    return [...roles].sort((a, b) => {
      const da = a.weekDate || "9999-99-99";
      const db = b.weekDate || "9999-99-99";
      return da.localeCompare(db);
    });
  }, [roles]);

  // Only show upcoming + 1 past on the noticeboard
  const visibleRoles = useMemo(() => {
    const past = sorted.filter(r => r.weekDate && r.weekDate < today);
    const upcoming = sorted.filter(r => !r.weekDate || r.weekDate >= today);
    return [...past.slice(-1), ...upcoming];
  }, [sorted, today]);

  const isPast = (r: RoleAssignment) => r.weekDate && r.weekDate < today;
  const isToday = (r: RoleAssignment) => r.weekDate === today;

  const currentRoleId = visibleRoles.find(r => !isPast(r))?.id;
  const isCurrent = (r: RoleAssignment) => r.id === currentRoleId;

  const meetingTypeColor = (mt: string) => {
    if (mt === "midweek") return { bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-200 dark:border-blue-800/40", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300", dot: "bg-blue-500" };
    if (mt === "weekend") return { bg: "bg-purple-50 dark:bg-purple-950/20", border: "border-purple-200 dark:border-purple-800/40", badge: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300", dot: "bg-purple-500" };
    return { bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-200 dark:border-amber-800/40", badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", dot: "bg-amber-500" };
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "No date";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const parseRoles = (ocrText: string | null): { name: string; assignee: string }[] => {
    if (!ocrText) return [];
    const lines = ocrText.split("\n");
    const result: { name: string; assignee: string }[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/[:\-—]|\t/).map(s => s.trim());
      if (parts.length >= 2) {
        result.push({ name: parts[0], assignee: parts.slice(1).join(" ") });
      } else {
        result.push({ name: trimmed, assignee: "" });
      }
    }
    return result;
  };

  // Dynamically calculate items per view based on container width
  useEffect(() => {
    const updateItems = () => {
      if (!scrollRef.current) return;
      const width = scrollRef.current.offsetWidth;
      const isMobile = width < 640;
      const cardWidth = isMobile ? Math.min(width, 260) : 260;
      const gap = 12;
      const fit = Math.max(1, Math.floor((width + gap) / (cardWidth + gap)));
      setItemsPerView(Math.min(fit, visibleRoles.length || 1));
    };
    updateItems();
    const observer = new ResizeObserver(updateItems);
    if (scrollRef.current) observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, [visibleRoles.length]);

  // Scroll to current entry on mount
  useEffect(() => {
    const currentIdx = visibleRoles.findIndex(r => !isPast(r));
    if (currentIdx >= 0) setScrollIndex(Math.max(0, currentIdx));
  }, [visibleRoles]);

  const maxScrollIndex = Math.max(0, visibleRoles.length - itemsPerView);
  const clampedScrollIndex = Math.min(scrollIndex, maxScrollIndex);

  const scrollBy = (delta: number) => {
    setScrollIndex(i => Math.max(0, Math.min(maxScrollIndex, i + delta)));
  };

  if (visibleRoles.length === 0) return null;

  const canScrollLeft = clampedScrollIndex > 0;
  const canScrollRight = clampedScrollIndex < maxScrollIndex;

  return (
    <div className="space-y-3">
      {/* Admin toolbar + carousel controls */}
      <div className="flex items-center justify-between gap-2">
        {/* Dots / progress */}
        <div className="flex items-center gap-1.5">
          {visibleRoles.map((r, i) => {
            const rPast = isPast(r);
            const rCurrent = isCurrent(r);
            const isActive = i >= clampedScrollIndex && i < clampedScrollIndex + itemsPerView;
            return (
              <button
                key={r.id}
                onClick={() => setScrollIndex(Math.max(0, Math.min(maxScrollIndex, i)))}
                className={`shrink-0 h-2 rounded-full transition-all ${
                  rCurrent ? "bg-green-500" :
                  isActive ? "w-4 bg-indigo-500" :
                  rPast ? "w-1.5 bg-muted-foreground/30" :
                  "w-1.5 bg-muted-foreground/50"
                } ${rCurrent ? "w-4" : ""}`}
                title={formatDate(r.weekDate)}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={onShowGrid}>
              <Layers className="h-3.5 w-3.5 mr-1" />
              View All ({sorted.length})
            </Button>
          )}
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="rounded-lg h-8 w-8 shrink-0" onClick={() => scrollBy(-1)} disabled={!canScrollLeft}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-lg h-8 w-8 shrink-0" onClick={() => scrollBy(1)} disabled={!canScrollRight}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Carousel viewport — extra top padding so the CURRENT badge (-top-2) isn't clipped */}
      <div ref={scrollRef} className="overflow-hidden pt-6 pb-3 -my-3">
        <div
          className="flex gap-3 transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${clampedScrollIndex * 272}px)` }}
        >
          {visibleRoles.map((role) => {
            const colors = meetingTypeColor(role.meetingType);
            const past = isPast(role);
            const today_ = isToday(role);
            const parsedRoles = parseRoles(role.ocrText);
            const current = isCurrent(role);

            return (
              <div
                key={role.id}
                className="shrink-0"
                style={{ width: `min(260px, 100%)` }}
              >
                <Card className={`relative rounded-2xl transition-all h-full ${current ? "border-[3px] border-green-500 shadow-xl shadow-green-500/50 ring-2 ring-green-500/30 bg-green-50 dark:bg-green-950/30" : past ? "border border-border/20 opacity-50" : today_ ? "border-2 border-teal-400 shadow-md" : `border-2 ${colors.border}`} ${current ? "" : colors.bg}`}>
                  {current && (
                    <div className="absolute -top-2 left-3 z-10 px-2 py-0.5 rounded-full bg-green-500 text-white text-[10px] font-bold tracking-wide shadow-md flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      CURRENT
                    </div>
                  )}
                  <CardContent className="p-3.5 space-y-2.5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${colors.badge}`}>
                          {role.meetingType === "midweek" ? "MW" : role.meetingType === "weekend" ? "WE" : "SP"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-tight truncate">{formatDate(role.weekDate)}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                            <span className="text-[10px] text-muted-foreground">
                              {role.meetingType === "midweek" ? t("rolesMidweek", language) : role.meetingType === "weekend" ? t("rolesWeekend", language) : t("rolesSpecial", language)}
                            </span>
                            {past && <span className="text-[10px] text-muted-foreground font-medium">· Past</span>}
                            {current && !today_ && <span className="text-[10px] text-green-600 dark:text-green-400 font-bold">· Current</span>}
                            {today_ && <span className="text-[10px] text-teal-600 font-bold">· Today</span>}
                          </div>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-0.5 shrink-0">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-md" onClick={() => onEdit(role)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-md text-red-500" onClick={() => onDelete(role.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Role blocks */}
                    {parsedRoles.length > 0 ? (
                      <div className="space-y-1">
                        {parsedRoles.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-background/60 border border-border/30 px-2 py-1.5">
                            <div className={`w-1 h-6 rounded-full shrink-0 ${colors.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none">{r.name}</p>
                              {r.assignee && <p className="text-xs font-medium leading-tight mt-0.5 truncate">{r.assignee}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : role.ocrText ? (
                      <div className="rounded-lg border border-border/30 bg-background/50 p-2 max-h-32 overflow-y-auto">
                        <p className="text-xs whitespace-pre-wrap leading-relaxed font-mono">{role.ocrText}</p>
                      </div>
                    ) : null}

                    {/* File attachment */}
                    {role.fileUrl && isImageFile(role.fileUrl, role.fileName) && (
                      <LazyImage src={role.fileUrl} alt={role.title} className="rounded-lg h-28 w-full object-cover" onClick={() => onOpenPhoto(role.fileUrl!, role.title)} />
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground">
                      <span>{timeAgo(role.updatedAt, language)}</span>
                      <div className="flex gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 rounded-md"
                          onClick={() => {
                            const meetingLabel = role.meetingType === "midweek" ? "Midweek Meeting" : role.meetingType === "weekend" ? "Weekend Meeting" : "Special";
                            let text = `${formatDate(role.weekDate)} — ${meetingLabel}`;
                            if (role.title && role.title !== meetingLabel) text += `\n${role.title}`;
                            if (parsedRoles.length > 0) {
                              text += "\n" + parsedRoles.map(r => `${r.name}: ${r.assignee || "___"}`).join("\n");
                            } else if (role.ocrText) {
                              text += "\n" + role.ocrText;
                            }
                            navigator.clipboard?.writeText(text);
                          }}
                          title="Copy as text"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {role.fileUrl && (
                          <>
                            {isPdfFile(role.fileUrl, role.fileName) ? (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-md" onClick={() => onOpenPdf(role.fileUrl!, role.title)}>
                                <FileText className="h-3 w-3" />
                              </Button>
                            ) : !isImageFile(role.fileUrl, role.fileName) ? (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-md" onClick={() => onOpenPdf(role.fileUrl!, role.title)}>
                                <FileText className="h-3 w-3" />
                              </Button>
                            ) : null}
                            <a href={role.fileUrl} download>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-md"><Download className="h-3 w-3" /></Button>
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
