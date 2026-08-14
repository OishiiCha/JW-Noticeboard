"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  CalendarClock,
  BookOpen,
  Mic,
  Users,
  Megaphone,
  Paperclip,
  CalendarDays,
  ClipboardList,
} from "lucide-react";

export type AddItemType =
  | "midweek-schedule"
  | "public-talk-schedule"
  | "weekly-roles"
  | "event"
  | "announcement"
  | "upload"
  | "schedule"
  | "link";

export interface AddItemChoice {
  type: AddItemType;
  defaultTitle?: string;
  defaultCategory?: string;
  tab: string;
}

interface AddItemPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (choice: AddItemChoice) => void;
}

const ITEM_TYPES: {
  type: AddItemType;
  label: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  border: string;
  iconBg: string;
  defaultTitle?: string;
  defaultCategory?: string;
  tab: string;
}[] = [
  {
    type: "midweek-schedule",
    label: "Midweek Schedule",
    description: "Upload the midweek meeting schedule (PDF or image)",
    icon: <BookOpen className="h-6 w-6" />,
    gradient: "from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30",
    border: "border-blue-200 dark:border-blue-800/50",
    iconBg: "bg-blue-500",
    defaultTitle: "Midweek Meeting Schedule",
    defaultCategory: "Meetings",
    tab: "notices",
  },
  {
    type: "public-talk-schedule",
    label: "Public Talk Schedule",
    description: "Upload the public talk / weekend schedule",
    icon: <Mic className="h-6 w-6" />,
    gradient: "from-purple-50 to-violet-50 dark:from-purple-950/40 dark:to-violet-950/30",
    border: "border-purple-200 dark:border-purple-800/50",
    iconBg: "bg-purple-500",
    defaultTitle: "Public Talk Schedule",
    defaultCategory: "Meetings",
    tab: "notices",
  },
  {
    type: "weekly-roles",
    label: "Weekly Roles",
    description: "Assign roles for the week (audio, video, etc.)",
    icon: <Users className="h-6 w-6" />,
    gradient: "from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/30",
    border: "border-green-200 dark:border-green-800/50",
    iconBg: "bg-green-500",
    defaultTitle: "Weekly Roles",
    defaultCategory: "Ministry",
    tab: "notices",
  },
  {
    type: "event",
    label: "Special Event",
    description: "Add a convention, assembly, CO visit, or memorial",
    icon: <CalendarClock className="h-6 w-6" />,
    gradient: "from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30",
    border: "border-amber-200 dark:border-amber-800/50",
    iconBg: "bg-amber-500",
    tab: "events",
  },
  {
    type: "announcement",
    label: "Announcement",
    description: "Post a text announcement to the congregation",
    icon: <Megaphone className="h-6 w-6" />,
    gradient: "from-cyan-50 to-sky-50 dark:from-cyan-950/40 dark:to-sky-950/30",
    border: "border-cyan-200 dark:border-cyan-800/50",
    iconBg: "bg-cyan-500",
    defaultTitle: "Announcement",
    defaultCategory: "Announcements",
    tab: "notices",
  },
  {
    type: "upload",
    label: "Upload Notice",
    description: "Upload photos, documents, letters, or files - pick a category",
    icon: <Paperclip className="h-6 w-6" />,
    gradient: "from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30",
    border: "border-emerald-200 dark:border-emerald-800/50",
    iconBg: "bg-emerald-500",
    tab: "notices",
  },
  {
    type: "schedule",
    label: "Schedule / Roster",
    description: "Cleaning, ministry, or any schedule - pick a category and upload",
    icon: <ClipboardList className="h-6 w-6" />,
    gradient: "from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/30",
    border: "border-rose-200 dark:border-rose-800/50",
    iconBg: "bg-rose-500",
    tab: "notices",
  },
  {
    type: "link",
    label: "External Link",
    description: "Add a link to an external resource (jw.org, etc.)",
    icon: <LinkIcon className="h-6 w-6" />,
    gradient: "from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/30",
    border: "border-sky-200 dark:border-sky-800/50",
    iconBg: "bg-sky-500",
    tab: "notices",
  },
];

export function AddItemPicker({ open, onClose, onSelect }: AddItemPickerProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
              <CalendarDays className="h-4 w-4" />
            </div>
            What would you like to add?
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
          {ITEM_TYPES.map((item) => (
            <button
              key={item.type}
              onClick={() => {
                onSelect({
                  type: item.type,
                  defaultTitle: item.defaultTitle,
                  defaultCategory: item.defaultCategory,
                  tab: item.tab,
                });
                onClose();
              }}
              className={`group relative rounded-xl border-2 ${item.border} bg-gradient-to-br ${item.gradient} p-4 text-left hover:shadow-lg hover:scale-[1.03] transition-all duration-200`}
            >
              <div className={`h-10 w-10 rounded-lg ${item.iconBg} text-white flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                {item.icon}
              </div>
              <p className="font-semibold text-sm text-foreground">{item.label}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{item.description}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
