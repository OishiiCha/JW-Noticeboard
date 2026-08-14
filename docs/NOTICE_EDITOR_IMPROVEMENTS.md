# Notice Editor — Specialized Modals Per Item Type

## Overview

Each item type in the `AddItemPicker` opens its own **dedicated modal** with fields tailored to that content type. No generic one-size-fits-all editor. Each modal is purpose-built for speed and clarity.

**Current problem**: All item types open the same generic notice editor with the same fields, regardless of what the user is creating.

**Solution**: 9 specialized modals, one per item type.

---

## Item Types & Their Modals

| # | Item Type | Modal Name | Primary Action |
|---|-----------|-----------|---------------|
| 1 | Midweek Schedule | `MidweekScheduleModal` | Upload file + assign weeks |
| 2 | Public Talk Schedule | `PublicTalkScheduleModal` | Upload file + assign weeks |
| 3 | Weekly Roles | `WeeklyRolesModal` | Type roles + assign dates (bulk) |
| 4 | Special Event | `SpecialEventModal` | Event details + dates + location |
| 5 | Letter | `LetterModal` | Upload file + description |
| 6 | Announcement | `AnnouncementModal` | Rich text content |
| 7 | Photo / Image | `PhotoModal` | Upload images + link to dates |
| 8 | Document / PDF | `DocumentModal` | Upload file + description |
| 9 | External Link | `LinkModal` | URL + preview + description |

---

## 1. Midweek Schedule Modal

Upload the midweek meeting schedule file and assign it to one or more weeks.

### Layout
```
┌─────────────────────────────────────────┐
│  📖 Midweek Schedule            [×]     │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │     Drag & drop file here      │    │
│  │     or click to browse         │    │
│  │                                 │    │
│  │     [📄]  PDF or Image         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ── Which week(s) is this for? ──       │
│                                         │
│  [x] Week of Mon Jul 28 – Aug 3         │
│  [x] Week of Mon Aug 4 – Aug 10         │
│  [ ] Week of Mon Aug 11 – Aug 17        │
│  [ ] Week of Mon Aug 18 – Aug 24        │
│  [ ] Custom dates...                    │
│                                         │
│  ── Options ──                          │
│  [○] Pin to top                         │
│                                         │
│              [Cancel]  [Upload & Post]  │
└─────────────────────────────────────────┘
```

### Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| File | File upload (drag-drop) | Yes | PDF or image, auto-detect |
| Week selection | Checkbox list | Yes | Multiple weeks can share one file |
| Custom dates | Date range picker | No | If "Custom dates" selected |
| Pin to top | Toggle | No | Default: off |

### Behavior
- Auto-generates title: "Midweek Meeting Schedule — Week of [date]"
- Category auto-set to "Meetings"
- Type auto-set to `file` (image or pdf based on upload)
- If multiple weeks selected, creates one notice per week, each with the same file
- `eventStartDate` = Monday of each selected week
- `eventEndDate` = Sunday of each selected week
- `showOnCalendar` = true (so it appears on calendar)
- Description auto-set: "Midweek meeting schedule for [week range]"
- **Future**: OCR button to extract schedule text from uploaded image

### Creates
- One `Notice` record per selected week
- Each with `type: "file"`, `categoryId: Meetings`, `showOnCalendar: true`

---

## 2. Public Talk Schedule Modal

Identical to Midweek Schedule but for the weekend public talk.

### Differences from Midweek
- Title auto-set: "Public Talk Schedule — Week of [date]"
- Category auto-set to "Meetings"
- `eventStartDate` = Saturday/Sunday of the selected week
- Same file upload + week selection pattern

### Creates
- One `Notice` record per selected week
- Category: Meetings

---

## 3. Weekly Roles Modal

Type out or paste role assignments. Can create for multiple weeks at once (bulk).

### Layout
```
┌─────────────────────────────────────────┐
│  👥 Weekly Roles                [×]     │
├─────────────────────────────────────────┤
│                                         │
│  ── How would you like to add? ──       │
│  [📝 Type / Paste]  [📷 Upload Image]  │
│                                         │
│  ┌─ Type/Paste mode ────────────────┐   │
│  │                                   │   │
│  │  Week of: [Aug 4 ▾]              │   │
│  │  [+ Add another week]            │   │
│  │                                   │   │
│  │  ┌─ Week of Aug 4 ────────────┐  │   │
│  │  │                             │  │   │
│  │  │  Chairman:    [___________] │  │   │
│  │  │  Prayer (Open):[__________] │  │   │
│  │  │  Prayer (Close):[_________] │  │   │
│  │  │  Reader:      [___________] │  │   │
│  │  │  CBS Conductor:[__________] │  │   │
│  │  │  CBS Reader:  [___________] │  │   │
│  │  │                             │  │   │
│  │  │  ── Treasures ──            │  │   │
│  │  │  Speaker:     [___________] │  │   │
│  │  │                             │  │   │
│  │  │  ── Ministry ──             │  │   │
│  │  │  Part 1: [_____] by [_____] │  │   │
│  │  │  Part 2: [_____] by [_____] │  │   │
│  │  │                             │  │   │
│  │  └─────────────────────────────┘  │   │
│  │                                   │   │
│  └───────────────────────────────────┘   │
│                                         │
│  ┌─ Upload mode ────────────────────┐   │
│  │  [Drag & drop image here]        │   │
│  │  "Extract Text" (OCR) button     │   │
│  │  Select weeks (checkbox list)    │   │
│  └───────────────────────────────────┘   │
│                                         │
│              [Cancel]  [Save Roles]     │
└─────────────────────────────────────────┘
```

### Fields (Type/Paste mode)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Week date | Date picker | Yes | Monday of the week |
| Role entries | Key-value pairs | Yes | Role name + person name |
| Additional weeks | Button to add more | No | Repeat role fields for each week |

### Fields (Upload mode)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Image | File upload | Yes | Photo of printed roles |
| OCR extract | Button | No | Extract text from image |
| Week selection | Checkbox list | Yes | Which weeks this image covers |

### Behavior
- **Type mode**: Creates one `RoleAssignment` per week
- **Bulk mode**: "+ Add another week" duplicates the role fields, user fills in for each week
- **Upload mode**: Creates one `RoleAssignment` per selected week, all sharing the same image
- **OCR**: Uses existing `useOCR` hook to extract text, populates role fields
- `meetingType` = "midweek" (default, can toggle to "weekend")

### Creates
- `RoleAssignment` records (one per week)

---

## 4. Special Event Modal

Add a convention, assembly, CO visit, memorial, or other special event.

### Layout
```
┌─────────────────────────────────────────┐
│  📅 Special Event               [×]     │
├─────────────────────────────────────────┤
│                                         │
│  Type: [Convention ▾]                   │
│                                         │
│  Title: [________________________]      │
│                                         │
│  Description: [____________________]    │
│                                         │
│  ── Dates ──                            │
│  Start: [____]  End: [____] (optional)  │
│                                         │
│  ── Location ──                         │
│  [_______________________________]      │
│  [📍 Use saved location ▾]             │
│                                         │
│  ── Image (optional) ──                 │
│  [Upload banner image]                  │
│                                         │
│  Color: [🟣 Purple ▾]                   │
│                                         │
│  [○] Show on noticeboard                │
│                                         │
│              [Cancel]  [Save Event]     │
└─────────────────────────────────────────┘
```

### Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Event type | Dropdown | Yes | convention, co_visit, assembly, memorial, other |
| Title | Text input | Yes | |
| Description | Textarea | No | |
| Start date | Date picker | Yes | |
| End date | Date picker | No | Multi-day events |
| Location | Text input | No | Can pick from saved locations |
| Image | File upload | No | Banner/cover image |
| Color | Color picker | No | Calendar display color |
| Show on noticeboard | Toggle | No | Default: on |

### Creates
- One `SpecialEvent` record

---

## 5. Letter Modal

Upload a letter from the branch or body of elders.

### Layout
```
┌─────────────────────────────────────────┐
│  ✉️ Letter                      [×]     │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │     Drag & drop file here      │    │
│  │     or click to browse         │    │
│  │                                 │    │
│  │     [📄]  PDF or Image         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Title: [Letter from the Branch ___]    │
│                                         │
│  Description (optional):                │
│  [_________________________________]    │
│                                         │
│  ── Options ──                          │
│  [○] Pin to top                         │
│  [○] Show on calendar                   │
│  Date: [____] (if on calendar)          │
│                                         │
│              [Cancel]  [Post Letter]    │
└─────────────────────────────────────────┘
```

### Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| File | File upload | Yes | PDF or image |
| Title | Text input | Yes | Pre-filled "Letter" |
| Description | Textarea | No | Brief summary |
| Pin | Toggle | No | |
| Show on calendar | Toggle | No | If on, show date picker |
| Calendar date | Date picker | Conditional | Only if showOnCalendar |

### Creates
- One `Notice` with `type: "file"`, category: Announcements

---

## 6. Announcement Modal

Quick text announcement with optional formatting.

### Layout
```
┌─────────────────────────────────────────┐
│  📢 Announcement                [×]     │
├─────────────────────────────────────────┤
│                                         │
│  Title: [________________________]      │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │   [Rich text editor area]       │    │
│  │                                 │    │
│  │   Type your announcement...     │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ── Options ──                          │
│  [○] Pin to top                         │
│  [○] Add expiry date                    │
│  [○] Show on calendar                   │
│                                         │
│            [Cancel]  [Post Announcement]│
└─────────────────────────────────────────┘
```

### Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Title | Text input | Yes | |
| Content | Textarea | Yes | The announcement body |
| Pin | Toggle | No | |
| Expiry date | Date picker | No | Auto-hide after date |
| Show on calendar | Toggle | No | With date picker |

### Creates
- One `Notice` with `type: "text"`, category: Announcements

---

## 7. Photo / Image Modal

Upload one or more photos. Can link to calendar dates.

### Layout
```
┌─────────────────────────────────────────┐
│  📷 Photo / Image               [×]     │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │     Drag & drop images here    │    │
│  │     or click to browse         │    │
│  │                                 │    │
│  │     Supports multiple files     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌── Preview strip ─────────────────┐   │
│  │ [🖼️] [🖼️] [🖼️] [+]          │   │
│  │  ⭐primary                        │   │
│  └──────────────────────────────────┘   │
│                                         │
│  Title: [________________________]      │
│  Caption: [________________________]    │
│                                         │
│  ── Link to dates (optional) ──         │
│  [x] Aug 4  [ ] Aug 11  [ ] Aug 18     │
│  [ ] Custom date...                     │
│                                         │
│  ── Options ──                          │
│  [○] Pin to top                         │
│  [ ] Extract text from image (OCR)      │
│                                         │
│              [Cancel]  [Upload & Post]  │
└─────────────────────────────────────────┘
```

### Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Images | Multi-file upload | Yes | Drag-drop or browse, multiple |
| Title | Text input | Yes | |
| Caption | Text input | No | Short description |
| Date links | Checkbox list | No | Link photo to calendar dates |
| Custom date | Date picker | No | If "Custom" selected |
| Pin | Toggle | No | |
| OCR | Toggle | No | Extract text from primary image |

### Behavior
- First image = primary (`thumbnailUrl` + `fileUrl`)
- Additional images → `galleryUrls` (new field, comma-separated)
- If dates selected, creates one notice per date OR one notice with date range
- OCR button appears on primary image thumbnail
- Clicking thumbnail sets it as primary
- Each thumbnail has remove (×) button

### Creates
- One `Notice` with `type: "image"`
- `galleryUrls` for multi-photo

### Schema Change Needed
```prisma
// Add to Notice model
galleryUrls String? // comma-separated additional image URLs
```

---

## 8. Document / PDF Modal

Upload a PDF document.

### Layout
```
┌─────────────────────────────────────────┐
│  📄 Document / PDF              [×]     │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │     Drag & drop file here      │    │
│  │     or click to browse         │    │
│  │                                 │    │
│  │     [📄]  PDF files            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Title: [________________________]      │
│  Description: [____________________]    │
│                                         │
│  ── Options ──                          │
│  [○] Pin to top                         │
│  [○] Add expiry date                    │
│                                         │
│              [Cancel]  [Upload & Post]  │
└─────────────────────────────────────────┘
```

### Creates
- One `Notice` with `type: "file"` (PDF)

---

## 9. External Link Modal

Add a link to an external resource with automatic preview.

### Layout
```
┌─────────────────────────────────────────┐
│  🔗 External Link               [×]     │
├─────────────────────────────────────────┤
│                                         │
│  URL: [https://___________________]     │
│       [Fetch Preview]                   │
│                                         │
│  ┌── Link Preview (auto-fetched) ──┐    │
│  │                                  │    │
│  │  [🖼️ preview image]             │    │
│  │  Site Title                      │    │
│  │  site-description.com            │    │
│  │                                  │    │
│  └──────────────────────────────────┘    │
│                                         │
│  Title: [________________________]      │
│  Description: [____________________]    │
│  Button label: [Click here ______]      │
│                                         │
│  ── Options ──                          │
│  [○] Pin to top                         │
│  [○] Add expiry date                    │
│                                         │
│              [Cancel]  [Add Link]       │
└─────────────────────────────────────────┘
```

### Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| URL | URL input | Yes | Auto-fetch preview on blur/paste |
| Preview | Auto-fetched | No | OG image + title from URL |
| Title | Text input | Yes | Defaults to fetched page title |
| Description | Textarea | No | |
| Button label | Text input | No | e.g. "Read on jw.org" |
| Pin | Toggle | No | |
| Expiry | Date picker | No | |

### Behavior
- On URL input, attempt to fetch Open Graph metadata (image, title, description)
- Use a `/api/link-preview?url=...` endpoint that fetches and parses OG tags
- Display preview card with image, site title, domain
- User can override the auto-fetched title/description
- `linkIcon` = fetched favicon URL

### API Endpoint Needed
```
GET /api/link-preview?url=https://example.com
Response: { title, description, image, favicon, domain }
```

### Creates
- One `Notice` with `type: "link"`, `linkUrl`, `linkLabel`, `linkIcon`

---

## Shared UI Patterns

### File Upload Area (all file modals)
- Large dashed-border drop zone
- Active state: indigo border + light indigo background
- Shows file preview after upload (thumbnail for images, icon for PDFs)
- Remove button to clear file
- Upload progress bar during upload
- Reuses existing `/api/upload` endpoint

### Week Selection (schedule modals)
- Auto-generates next 4-6 weeks based on meeting day setting
- Checkbox list: "Week of Mon Jul 28 – Sun Aug 3"
- Multiple weeks can be selected for bulk upload
- "Custom dates" option opens date range picker

### Options Section (all modals)
- Collapsed by default
- Toggle switches for: Pin, Expiry, Show on Calendar
- Each toggle reveals its date picker when enabled

### Modal Wrapper
- `max-w-lg` (512px) — not too wide, focused
- `max-h-[90vh]` with `overflow-y-auto`
- Dark backdrop with blur
- Close on backdrop click or X button
- Smooth fade-in animation

---

## Implementation Checklist

### New Components to Create
- [x] `src/components/modals/schedule-modal.tsx` (handles both midweek & public talk via variant prop)
- [x] `src/components/modals/weekly-roles-modal.tsx`
- [x] `src/components/modals/special-event-modal.tsx`
- [x] `src/components/modals/letter-modal.tsx` (handles both letter & document via variant prop)
- [x] `src/components/modals/announcement-modal.tsx`
- [x] `src/components/modals/photo-modal.tsx`
- [x] `src/components/modals/link-modal.tsx`
- [x] `src/components/shared/file-upload-zone.tsx` (reusable drag-drop)
- [x] `src/components/shared/week-selector.tsx` (reusable week checkboxes)
- [x] `src/components/shared/advanced-options.tsx` (reusable toggles section)

### Schema Changes
- [x] Add `galleryUrls String?` to `Notice` model
- [x] Run migration (prisma db push)

### New API Endpoints
- [x] `GET /api/link-preview?url=...` — fetch OG metadata for link previews
- [x] Update notice POST to accept `galleryUrls`

### Integration
- [x] Update `handleAddItemSelect` in `page.tsx` to open the correct modal per type
- [x] Each modal manages its own state and API calls
- [x] After save, close modal and call `fetchData()` to refresh the board
- [x] Keep the existing generic editor as fallback for editing existing notices

### Future Enhancements
- [ ] OCR integration for schedule/roles/photo modals
- [x] Link preview auto-fetch with OG image
- [ ] Bulk date selection for photos (link one photo to multiple dates)
- [ ] Role template (save common role structures for reuse)
