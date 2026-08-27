"use client";
import { useScrollLock } from "@/lib/use-scroll-lock";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X, ChevronLeft, ChevronRight, Download, Share2, ExternalLink, FileText,
  Pin, Edit, Archive, Trash2, Bookmark, CalendarClock, MapPin,
  Maximize, Minimize,
} from "lucide-react";
import { getFieldConfig, parseScheduleFields, sortFieldsByNum, isScheduleContent, type ScheduleVariant } from "@/lib/schedule-field-config";

const PdfThumbnail = dynamic(() => import("@/components/shared/pdf-thumbnail").then(m => m.PdfThumbnail), { ssr: false });

interface NoticeDetailModalProps {
  notice: NoticeLike | null;
  language: "en" | "tl";
  bookmarked: boolean;
  onToggleBookmark: (id: string) => void;
  onClose: () => void;
  isAdmin?: boolean;
  onEdit?: (notice: NoticeLike) => void;
  onDelete?: (id: string) => void;
  onTogglePin?: (notice: NoticeLike) => void;
  onArchive?: (notice: NoticeLike) => void;
  onOpenPdf?: (url: string, title: string) => void;
  siteDomain?: string;
}

export interface NoticeLike {
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
  language: string;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: { id: string; name: string; color?: string | null } | null;
}

function isImageFile(url?: string | null, fileName?: string | null): boolean {
  if (!url && !fileName) return false;
  const str = (fileName || url || "").toLowerCase();
  return str.match(/\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)$/) !== null || (url?.includes("/uploads/") && str.includes("image")) || false;
}

function isPdfFile(url?: string | null, fileName?: string | null): boolean {
  if (!url && !fileName) return false;
  const str = (fileName || url || "").toLowerCase();
  return str.endsWith(".pdf") || str.includes("application/pdf");
}

function timeAgo(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Detect schedule variant from content/title
function detectVariant(content: string): ScheduleVariant {
  if (/public\s+talk/i.test(content)) return "public-talk";
  return "midweek";
}

// Render schedule content as structured colored blocks with icons
export function ScheduleFieldsDisplay({ content, variant = "midweek" }: { content: string; variant?: ScheduleVariant }) {
  // Skip fields whose value has no real visible characters (blank, dashes, or
  // invisible/zero-width chars that survive trim) — they'd render as ghost rows
  const hasVisible = (v: string) => /[\p{L}\p{N}]/u.test(v);
  const fields = sortFieldsByNum(parseScheduleFields(content)).filter(f => hasVisible(f.value));
  if (fields.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {fields.map((f, i) => {
        const cfg = getFieldConfig(f.key, variant);
        const Icon = cfg.icon;
        // Talk theme is the headline of a public talk — render it bold with its number
        const isTheme = f.key === "TalkTheme";
        return (
          <div key={i} className={`flex items-start gap-2.5 rounded-xl ${cfg.bg} border ${cfg.border} px-3 py-2`}>
            {f.num !== undefined && (
              <div className="shrink-0 h-6 w-6 rounded-full border-2 border-current/30 flex items-center justify-center text-[11px] font-bold mt-0.5 tabular-nums opacity-80">
                {f.num}
              </div>
            )}
            <div className={`shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-white ${cfg.iconBg} mt-0.5`}>
              <Icon className="h-3 w-3" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] uppercase tracking-wide leading-none font-bold ${cfg.text}`}>{cfg.label || f.key}</p>
              {f.value && (
                <p className={`leading-tight mt-1 ${isTheme ? "text-sm font-bold" : "text-sm font-medium"}`}>{f.value}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Full renderer for a schedule text: extracts the header line, detects the
// variant, and renders the body as structured colored blocks. Falls back to a
// plain-text paragraph when the text isn't a parseable schedule, so callers
// never render a blank section.
export function ScheduleContentDisplay({ text, plainClassName = "text-sm leading-relaxed", whitespacePreWrap = false }: { text: string; plainClassName?: string; whitespacePreWrap?: boolean }) {
  if (!isScheduleContent(text)) {
    return <p className={`${plainClassName}${whitespacePreWrap ? " whitespace-pre-wrap" : ""}`}>{text}</p>;
  }
  const headerMatch = text.match(/^(Midweek meeting|Public talk)\s+schedule for\s+.+/im);
  const body = headerMatch ? text.slice(headerMatch[0].length).trim() : text;
  const variant = detectVariant(text);
  const fields = parseScheduleFields(body);
  if (fields.length === 0) {
    return <p className={`${plainClassName}${whitespacePreWrap ? " whitespace-pre-wrap" : ""}`}>{text}</p>;
  }
  return (
    <div className="space-y-2">
      {headerMatch && (
        <p className="text-sm font-bold text-muted-foreground">{headerMatch[0]}</p>
      )}
      <ScheduleFieldsDisplay content={body} variant={variant} />
    </div>
  );
}

export function NoticeDetailModal({
  notice, language, bookmarked, onToggleBookmark, onClose,
  isAdmin, onEdit, onDelete, onTogglePin, onArchive, onOpenPdf, siteDomain,
}: NoticeDetailModalProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const [fitMode, setFitMode] = useState(true);
  const [imageNatural, setImageNatural] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Reset fit mode when switching images
  useEffect(() => {
    setFitMode(true);
    setImageNatural(null);
  }, [imageIndex, notice?.id]);

  // Track container size for determining if original fits
  useEffect(() => {
    if (!imageContainerRef.current) return;
    const update = () => {
      if (imageContainerRef.current) {
        setContainerSize({
          w: imageContainerRef.current.clientWidth,
          h: imageContainerRef.current.clientHeight,
        });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(imageContainerRef.current);
    return () => observer.disconnect();
  }, [notice]);

  // Image is "smaller than modal" if its natural dimensions fit within the container
  const isSmallerThanContainer = imageNatural && containerSize
    ? imageNatural.w <= containerSize.w && imageNatural.h <= containerSize.h
    : false;

  const handleShare = useCallback(() => {
    if (!notice) return;
    const url = `${siteDomain || window.location.origin}/notice/${notice.id}`;
    if (navigator.share) {
      navigator.share({ title: notice.title, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
    }
  }, [notice]);

  useScrollLock(!!notice);

  if (!notice) return null;

  const title = language === "tl" && notice.titleTl ? notice.titleTl : notice.title;
  const description = language === "tl" && notice.descriptionTl ? notice.descriptionTl : notice.description;
  const isImg = isImageFile(notice.thumbnailUrl, notice.fileName) || isImageFile(notice.fileUrl, notice.fileName);
  const isPdf = isPdfFile(notice.fileUrl, notice.fileName);
  const primaryImage = isImageFile(notice.thumbnailUrl, notice.fileName) ? notice.thumbnailUrl : (isImageFile(notice.fileUrl, notice.fileName) ? notice.fileUrl : null);

  // Build gallery images list
  const galleryImages: string[] = [];
  if (primaryImage) galleryImages.push(primaryImage);
  if (notice.galleryUrls) {
    notice.galleryUrls.split(",").forEach(u => {
      const trimmed = u.trim();
      if (trimmed && !galleryImages.includes(trimmed)) galleryImages.push(trimmed);
    });
  }

  const hasGallery = galleryImages.length > 1;
  const currentImage = galleryImages[imageIndex] || primaryImage;
  const updateDate = notice.updatedAt || notice.createdAt;

  // Dynamic sizing: wider for images/PDFs, narrower for text-only
  const hasVisual = !!currentImage || isPdf;
  const maxWidthClass = hasVisual ? "max-w-5xl" : "max-w-lg";

  // Admin action buttons — used in the vertical icon strip and text-only footer
  const adminButtons = (
    <>
      <Button variant="ghost" size="sm" className={`h-10 w-10 sm:h-8 sm:w-8 rounded-lg ${notice.isPinned ? "text-amber-500" : ""}`} onClick={() => onTogglePin?.(notice)} title="Pin/Unpin">
        <Pin className={`h-4 w-4 sm:h-3.5 sm:w-3.5 ${notice.isPinned ? "fill-amber-500" : ""}`} />
      </Button>
      <Button variant="ghost" size="sm" className="h-10 w-10 sm:h-8 sm:w-8 rounded-lg" onClick={() => { onClose(); setTimeout(() => onEdit?.(notice), 150); }} title="Edit">
        <Edit className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-10 w-10 sm:h-8 sm:w-8 rounded-lg" onClick={() => { onClose(); setTimeout(() => onArchive?.(notice), 150); }} title="Archive">
        <Archive className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-10 w-10 sm:h-8 sm:w-8 rounded-lg text-red-500 hover:text-red-600" onClick={() => { onClose(); setTimeout(() => onDelete?.(notice.id), 150); }} title="Delete">
        <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      </Button>
    </>
  );

  // Info content block — description + metadata shown below the image
  const infoContent = (
    <>
      {/* Pinned indicator */}
      {notice.isPinned && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          <Pin className="h-3 w-3" /> Pinned
        </div>
      )}

      {/* Description — structured blocks for schedules, plain text otherwise */}
      {description && <ScheduleContentDisplay text={description} />}

      {/* Content — schedules show their structured list even with an image attached */}
      {notice.content && !description && (!notice.fileUrl || isScheduleContent(notice.content)) && <ScheduleContentDisplay text={notice.content} plainClassName="text-sm whitespace-pre-wrap leading-relaxed" whitespacePreWrap />}

      {/* Location */}
      {notice.location && (
        <a
          href={notice.latitude != null && notice.longitude != null
            ? `https://www.google.com/maps/dir/?api=1&destination=${notice.latitude},${notice.longitude}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(notice.location)}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/20 px-3 py-2 border border-blue-200 dark:border-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors"
        >
          <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">{notice.location}</span>
        </a>
      )}

      {/* External link */}
      {notice.linkUrl && (
        <a
          href={notice.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
        >
          {notice.linkIcon ? (
            <img src={notice.linkIcon} alt="" className="h-4 w-4 rounded shrink-0" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
          {notice.linkLabel || notice.linkUrl}
        </a>
      )}

      {/* Download button for files */}
      {notice.fileUrl && (currentImage || isPdf) && (
        <a href={notice.fileUrl} download className="inline-flex">
          <Button variant="outline" size="sm" className="rounded-xl">
            <Download className="h-4 w-4 mr-1.5" /> Download
          </Button>
        </a>
      )}

      {/* Date info */}
      {notice.eventStartDate && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          {notice.eventEndDate && notice.eventEndDate !== notice.eventStartDate
            ? `${notice.eventStartDate} — ${notice.eventEndDate}`
            : notice.eventStartDate}
        </div>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className={`bg-card border border-border/40 rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-2xl w-full ${maxWidthClass} max-h-[95dvh] sm:max-h-[90vh] flex flex-col overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        {hasVisual ? (
          /* ─── Visual layout: icon strip on side + title/image/description stacked ─── */
          <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
            {/* Vertical icon strip — thin sidebar with action buttons */}
            <div className="shrink-0 w-12 sm:w-14 flex flex-col items-center gap-1 py-3 border-r border-border/40 bg-muted/30">
              <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg shrink-0" title="Close">
                <X className="h-4 w-4" />
              </Button>
              <div className="w-6 h-px bg-border/40 my-1" />
              <Button variant="ghost" size="icon" onClick={handleShare} className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg shrink-0" title="Share">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onToggleBookmark(notice.id)} className={`h-9 w-9 sm:h-10 sm:w-10 rounded-lg shrink-0 ${bookmarked ? "text-amber-500" : ""}`} title="Bookmark">
                <Bookmark className={`h-4 w-4 ${bookmarked ? "fill-amber-500" : ""}`} />
              </Button>
              {isAdmin && (
                <>
                  <div className="w-6 h-px bg-border/40 my-1" />
                  {adminButtons}
                </>
              )}
              {/* Spacer pushes time ago to bottom */}
              <div className="flex-1" />
              <span className="text-[9px] text-muted-foreground text-center leading-tight px-1 [writing-mode:vertical-rl] rotate-180 shrink-0">{timeAgo(updateDate)}</span>
            </div>

            {/* Main column — title above, image center, description below */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Title at top */}
              <div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2 mb-1">
                  {notice.category && (
                    <Badge variant="outline" className="text-xs rounded-md shrink-0">
                      {notice.category.name}
                    </Badge>
                  )}
                </div>
                <h2 className="text-base font-bold leading-snug">{title}</h2>
              </div>

              {/* Image / PDF — takes up most of the space */}
              <div className="relative flex-1 min-h-0 bg-black/5 dark:bg-black/20 flex flex-col overflow-hidden">
                {currentImage && (
                  <div ref={imageContainerRef} className="relative flex-1 flex items-center justify-center overflow-auto min-h-0 p-2">
                    <div className="relative flex items-center justify-center w-full h-full">
                      <img
                        src={currentImage}
                        alt={title}
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          setImageNatural({ w: img.naturalWidth, h: img.naturalHeight });
                        }}
                        className={fitMode
                          ? "max-w-full max-h-full object-contain"
                          : "object-contain"
                        }
                        style={fitMode ? {} : { width: imageNatural?.w, height: imageNatural?.h }}
                      />

                      {/* Gallery nav arrows */}
                      {hasGallery && (
                        <>
                          <button
                            onClick={() => setImageIndex(i => Math.max(0, i - 1))}
                            disabled={imageIndex === 0}
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/80 dark:bg-black/60 hover:bg-white dark:hover:bg-black/80 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-opacity shadow-md z-10"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => setImageIndex(i => Math.min(galleryImages.length - 1, i + 1))}
                            disabled={imageIndex === galleryImages.length - 1}
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/80 dark:bg-black/60 hover:bg-white dark:hover:bg-black/80 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-opacity shadow-md z-10"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Fit / Original toggle — only show "Original" if image is smaller than container */}
                    {imageNatural && (
                      <div className="absolute bottom-3 right-3 z-10">
                        {fitMode ? (
                          isSmallerThanContainer && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8 rounded-lg bg-white/90 dark:bg-black/70 shadow-md text-xs"
                              onClick={() => setFitMode(false)}
                              title="Show original size"
                            >
                              <Maximize className="h-3.5 w-3.5 mr-1" /> Original
                            </Button>
                          )
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 rounded-lg bg-white/90 dark:bg-black/70 shadow-md text-xs"
                            onClick={() => setFitMode(true)}
                            title="Fit to modal"
                          >
                            <Minimize className="h-3.5 w-3.5 mr-1" /> Fit
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* PDF thumbnail preview */}
                {!currentImage && isPdf && notice.fileUrl && (
                  <div className="relative flex-1 overflow-hidden">
                    <PdfThumbnail
                      url={notice.fileUrl}
                      className="max-h-[50dvh] sm:max-h-[80vh] w-full"
                      onClick={() => {
                        if (notice.fileUrl) {
                          if (onOpenPdf) {
                            onOpenPdf(notice.fileUrl, title);
                          } else {
                            window.open(notice.fileUrl, "_blank");
                          }
                        }
                      }}
                    />
                  </div>
                )}

                {/* Gallery thumbnails strip */}
                {hasGallery && (
                  <div className="shrink-0 flex items-center gap-2 p-2 overflow-x-auto bg-card border-t border-border/40">
                    {galleryImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setImageIndex(idx)}
                        className={`shrink-0 h-12 w-12 rounded-lg overflow-hidden border-2 transition-colors ${
                          idx === imageIndex ? "border-indigo-500" : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                    <div className="text-xs text-muted-foreground ml-auto shrink-0 px-2">
                      {imageIndex + 1} / {galleryImages.length}
                    </div>
                  </div>
                )}
              </div>

              {/* Description / info below image */}
              {(description || notice.location || notice.linkUrl || notice.eventStartDate || notice.isPinned) && (
                <div className="shrink-0 max-h-[30dvh] overflow-y-auto p-4 space-y-3 border-t border-border/40">
                  {infoContent}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ─── Text-only layout (vertical, same as before) ─── */
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {notice.category && (
                  <Badge variant="outline" className="text-xs rounded-md shrink-0">
                    {notice.category.name}
                  </Badge>
                )}
                <h2 className="text-base font-bold truncate">{title}</h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={handleShare} className="h-8 w-8 rounded-lg">
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onToggleBookmark(notice.id)} className={`h-8 w-8 rounded-lg ${bookmarked ? "text-amber-500" : ""}`}>
                  <Bookmark className={`h-4 w-4 ${bookmarked ? "fill-amber-500" : ""}`} />
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 sm:h-8 sm:w-8 rounded-lg shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-4">
                {infoContent}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border/40 shrink-0 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{timeAgo(updateDate)}</span>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  {adminButtons}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
