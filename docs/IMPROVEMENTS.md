# Noticeboard — Improvements & Design Spec

## Table of Contents
1. [Current Architecture](#current-architecture)
2. [Public Noticeboard (`/`)](#public-noticeboard)
3. [Admin Page (`/admin`)](#admin-page)
4. [Grid Layout System](#grid-layout-system)
5. [Card Components](#card-components)
6. [Settings Panel](#settings-panel)
7. [Calendar View](#calendar-view)
8. [Add Item Picker](#add-item-picker)
9. [Improvements Checklist](#improvements-checklist)

---

## Current Architecture

- **Framework**: Next.js 16 (App Router) + React 19
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Database**: Prisma ORM + SQLite
- **Auth**: NextAuth.js (session-based, admin/super_admin roles)
- **Icons**: Lucide React
- **Container**: Docker (port 3003, 256MB memory limit)

### Key Files
| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Public noticeboard (main page) |
| `src/app/admin/page.tsx` | Admin dashboard (tabbed) |
| `src/app/globals.css` | Theme variables, animations, scrollbar |
| `src/components/settings-panel.tsx` | Congregation settings |
| `src/components/calendar/calendar-view.tsx` | Monthly calendar |
| `src/components/noticeboard/notice-manager.tsx` | CRUD for notices (admin) |
| `src/components/add-item-picker.tsx` | Quick-add dialog |
| `src/components/events/event-manager.tsx` | Event CRUD |
| `src/components/users-panel.tsx` | User management |

---

## Public Noticeboard

### Desktop (≥1024px)
```
┌─────────────────────────────────────────────────────┐
│  [Logo] Congregation Title              [🌙] [Login] │  ← sticky header, max-w-6xl
├─────────────────────────────────────────────────────┤
│                                                     │
│              [🔍 Search notices...                  │  ← centered, max-w-xl, h-12
│                                                     │
│  📌 Pinned                                          │  ← section header (icon badge + title)
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │  ← 4-column masonry
│  │ card │ │ card │ │ card │ │ card │               │
│  └──────┘ └──────┘ └──────┘ └──────┘               │
│                                                     │
│  📅 Upcoming Events                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│  └──────┘ └──────┘ └──────┘ └──────┘               │
│                                                     │
│  📆 Midweek Meetings                                │
│  ┌──────┐ ┌──────┐                                  │  ← max 2 cards
│  └──────┘ └──────┘                                  │
│                                                     │
│  📆 Weekend Meetings                                │
│  ┌──────┐ ┌──────┐                                  │
│  └──────┘ └──────┘                                  │
│                                                     │
│  👥 Roles & Assignments                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│  └──────┘ └──────┘ └──────┘ └──────┘               │
│                                                     │
│  📋 Category Name                                   │  ← per-category sections
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│  └──────┘ └──────┘ └──────┘ └──────┘               │
│                                                     │
│  📍 Our Location                                    │  ← map embed (if configured)
│  ┌─────────────────────────────────────────┐        │
│  │           Google Maps iframe             │        │
│  └─────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────┘
```

### Tablet (640–1023px)
- 2-column masonry grid
- Header same layout, slightly smaller text
- Search bar full width within max-w-xl

### Mobile (<640px)
- 1-column masonry (cards stack vertically)
- Header: logo + title on left, theme + login on right
- Search: full width
- Floating + button (admin only) bottom-right
- Sections collapsible (tap to expand/collapse)

### Header Behavior
- **Sticky** at top with `backdrop-blur-xl` and semi-transparent card background
- Logo: 44x44px rounded-2xl gradient badge (indigo→purple)
- Title: `text-lg` mobile, `text-xl` desktop, `font-bold tracking-tight`
- Buttons: `rounded-xl`, icon-only on mobile, icon+label on desktop
- Admin sees "Manage" button (opens slide-out panel)

### Section Collapsing
- Each `DashboardSection` has expand/collapse with chevron icon
- Smooth `max-height` transition (300ms)
- `fade-in-up` animation on render
- [x] State persisted in localStorage (survives page reload)

### Admin Slide-Out Panel (Manage)
- Fixed overlay, right-side drawer (320px wide)
- Semi-transparent backdrop with blur
- Buttons navigate to `/admin?tab=...`
- Links: Events Manager, Calendar View, Users, Settings

---

## Admin Page

### Desktop (≥1024px)
```
┌─────────────────────────────────────────────────────┐
│  [Logo] Congregation — Admin    [🌙] [Noticeboard]  │  ← sticky header
│                                 [Logout]            │
├─────────────────────────────────────────────────────┤
│  [Notices] [Events] [Calendar] [Users] [Settings]   │  ← 5-col tab bar
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─ Active Tab Content ─────────────────────────┐   │
│  │                                              │   │
│  │  (NoticeManager / EventManager / etc.)       │   │
│  │                                              │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│                                          [＋]       │  ← floating add button
└─────────────────────────────────────────────────────┘
```

### Mobile (<640px)
- Tab bar: icon-only (labels hidden), 5 equal columns
- Content stacks vertically
- Floating + button bottom-right

### Tabs
| Tab | Component | Purpose |
|-----|-----------|---------|
| Notices | `NoticeManager` | CRUD notices, upload files, pin/archive |
| Events | `EventManager` | CRUD special events with images |
| Calendar | `CalendarView` | Monthly calendar with event dots |
| Users | `UsersPanel` | Manage user accounts & roles |
| Settings | `SettingsPanel` | Congregation config (meetings, map, title) |

### URL Query Params
- `?tab=notices` — opens Notices tab
- `?tab=events` — opens Events tab
- `?tab=calendar` — opens Calendar tab
- `?tab=users` — opens Users tab
- `?tab=settings` — opens Settings tab

---

## Grid Layout System

### Masonry Grid (`MasonryGrid` component)
Uses CSS multi-column layout (not CSS Grid) for true masonry effect:

| Breakpoint | Columns | Gap | Margin between items |
|------------|---------|-----|---------------------|
| Mobile (`<640px`) | 1 | 20px (gap-5) | 20px (mb-5) |
| Tablet (`≥640px`) | 2 | 20px | 20px |
| Desktop (`≥1024px`) | 3 | 20px | 20px |
| Wide (`≥1280px`) | 4 | 20px | 20px |

```css
columns-1 sm:columns-2 lg:columns-3 xl:columns-4
gap-5 [&>*]:mb-5 [&>*]:break-inside-avoid
```

**How it works**: CSS columns flow content vertically, filling each column before moving to the next. `break-inside-avoid` prevents cards from splitting across columns. Cards of varying heights create the masonry effect naturally.

### Container Width
- `max-w-6xl` (1152px) for both public and admin pages
- Horizontal padding: `px-4` mobile, `px-6` desktop
- Vertical padding: `py-8` mobile, `py-10` desktop
- Section spacing: `space-y-10` (40px between sections)

### Card Sizing
- Cards fill their column width (100%)
- Height is content-driven (no fixed heights except images: `max-h-48`)
- Image cards: image fills width, content below
- PDF cards: gradient header section + content
- Text cards: just content with padding

---

## Card Components

### PadletCard (Notice)
```
┌──────────────────────────┐
│  [Image] or [PDF banner] │  ← rounded-t-2xl, hover zoom on images
│                          │
├──────────────────────────┤
│  Title          [New]    │  ← font-bold, "New" badge if <48hr
│  [Category badge]        │  ← outline badge
│  [⏰ 3d 5h left]         │  ← countdown (if event date set)
│  Description text...     │  ← line-clamp-4, muted
│  Content text...         │  ← text type only, line-clamp-4
│  🔗 Link label           │  ← link type only
│─────────────────────────│
│  3h ago    [📤][🔖][📄]  │  ← footer: timestamp + actions
│            [📌][✏️][📦][🗑]│  ← admin controls (if admin)
└──────────────────────────┘
```

**Hover effect**: `translateY(-4px)` + layered shadow via `.card-hover` class
**Recently updated**: Indigo border + pulse-glow animation (3 pulses)
**Pinned indicator**: Amber pin icon (in image overlay or inline with title)

### EventCard
```
┌──────────────────────────┐
│  [Event image]           │  ← optional, max-h-48
├──────────────────────────┤
│  • CONVENTION            │  ← colored dot + type label
│  ┌────┐                  │
│  │ AUG │ Event Title     │  ← date block + title
│  │ 15  │ Aug 15 — Aug 17 │
│  └────┘                  │
│  📍 Location             │
│  Description...          │
└──────────────────────────┘
```

**Color themes** by event type:
| Type | Dot | Background gradient |
|------|-----|-------------------|
| Convention | Blue | `from-blue-50 to-blue-50` |
| Assembly | Green | `from-green-50 to-green-50` |
| CO Visit | Purple | `from-purple-50 to-purple-50` |
| Memorial | Rose | `from-rose-50 to-pink-50` |
| Other | Slate | `from-slate-50 to-gray-50` |

### MeetingCard
```
┌──────────────────────────┐
│  [Midweek Meeting]       │  ← badge (default/secondary)
│  📆 Monday, August 15    │  ← full date format
│  ⏰ 18:30                │
│  📍 Kingdom Hall         │  ← if location set
│─────────────────────────│
│  📄 View Schedule  ⬇ DL  │  ← if file uploaded
└──────────────────────────┘
```

**Background**: Subtle indigo→purple gradient
**Icons**: All indigo-colored

### RoleCard
```
┌──────────────────────────┐
│  [Role image]            │  ← optional, max-h-48
├──────────────────────────┤
│  Role Title    [Midweek] │  ← title + meeting type badge
│  Week of: Aug 15         │
│  ┌─────────────────────┐ │
│  │ OCR extracted text  │ │  ← scrollable, max-h-40
│  └─────────────────────┘ │
│─────────────────────────│
│  3h ago         [📄][⬇]  │
└──────────────────────────┘
```

---

## Settings Panel

### Layout
- `max-w-2xl` centered within admin tab content
- Stacked cards, each with header + content
- Save button at bottom (fixed blue/indigo)

### Settings Cards

#### 1. Congregation Identity
- **Field**: Congregation Title (text input)
- **Permission**: Super admin only to change
- **Effect**: Displayed in header of public page

#### 2. Meeting Schedule
- **Midweek Meeting**: Day (select) + Time (time input)
- **Weekend Meeting**: Day (select) + Time (time input)
- **Meeting Location**: Text input
- **Permission**: Super admin only
- **Effect**: Auto-generates meeting entries on calendar + meeting cards on public page

#### 3. Display Settings
- **Calendar Start Day**: Sunday / Monday / Saturday
- **Effect**: Controls first day of week in calendar view

#### 4. Map Settings
- **Map Address**: Text (used for directions link)
- **Map Embed URL**: Google Maps embed URL
- **Effect**: Shows map section at bottom of public page

#### 5. Current Schedule Summary
- Read-only display of current midweek/weekend settings
- Blue gradient card with day + time

### Permission Model
- **Admin**: Can view all settings, cannot save
- **Super Admin**: Can view and save all settings
- **Forbidden state**: Shows amber warning card when non-super-admin tries to save

---

## Calendar View

### Layout
```
┌──────────────────────────────────────┐
│  [‹]  August 2025  [›]  [Today]      │  ← month navigation
├──────────────────────────────────────┤
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun   │  ← day headers (respects start day)
├──────────────────────────────────────┤
│  │  │  │  │1 │2 │3 │                  │
│  │  │  │  │  │  │  │                  │
│  │4 │5 │6 │7 │8 │9 │10│               │  ← date cells
│  │  │  │  │  │  │  │  │               │
│  │11│12│13│14│15│16│17│               │
│  │  │  │  │  │  │  │  │               │
│  │18│19│20│21│22│23│24│               │
│  │  │  │  │  │  │  │  │               │
│  │25│26│27│28│29│30│31│               │
└──────────────────────────────────────┘
```

### Event Indicators
- Colored dots on dates with events:
  - 🔵 Blue = Meeting
  - 🟣 Purple = Special Event
  - 🟡 Amber = Notice (if `showOnCalendar` is true)
  - 🔴 Red = Override

### Desktop vs Mobile
- **Desktop**: Full 7-column grid, large cells, event titles visible
- **Mobile**: Same grid but smaller cells, dots only (no titles), scrollable event list below

### Data Sources
- Meetings: Auto-generated from settings (midweek/weekend schedule)
- Events: From `SpecialEvent` table
- Notices: From `Notice` table where `showOnCalendar = true`
- Overrides: From `MeetingOverride` table (cancelled/moved meetings)

---

## Add Item Picker

### Trigger
- Floating + button on admin page (bottom-right, rounded-2xl, gradient)
- Opens dialog with grid of item types

### Item Types
| Type | Icon | Color | Action |
|------|------|-------|--------|
| Text Notice | FileText | Blue | Opens notice editor (text type) |
| Photo / Image | Image | Green | Opens notice editor (image type) |
| PDF Document | FileText | Rose | Opens notice editor (PDF type) |
| External Link | Link | Cyan | Opens notice editor (link type) |
| Special Event | CalendarClock | Amber | Switches to Events tab |
| Pin a Letter | Pin | Yellow | Switches to Notices tab (pin mode) |
| Archive Item | Archive | Slate | Switches to Notices tab (archive mode) |

### Layout
- Dialog: `max-w-2xl`
- Grid: 2 columns mobile, 3 columns desktop
- Each item: gradient card with icon, label, hover scale effect

---

## Improvements Checklist

### High Priority

- [x] **1. Calendar item click → detail popup**
   - Clicking a calendar event opens a dialog showing full details
   - For meetings: shows schedule, type (midweek/weekend), link to schedule file
   - For events: shows full description, location, dates
   - For notices: shows notice content
   - File: `src/components/calendar/calendar-view.tsx`

- [x] **2. Notice type auto-detection**
   - When uploading a file, auto-detects type (text/image/pdf) from file MIME type
   - Auto-fills title from filename if title is empty
   - Sets thumbnailUrl for images automatically
   - File: `src/app/page.tsx` (edit dialog) + `src/app/api/upload/route.ts`
   - **Note**: Hybrid types (text + PDF, text + image) not yet supported

- [x] **3. Edit dialog UX cleanup**
   - Drag-and-drop style upload zone with dashed border
   - Image preview with hover-remove button
   - PDF/file card showing filename + type with remove button
   - Upload spinner state
   - Auto-fill title from filename
   - Link label field added
   - All inputs use `rounded-xl`
   - Pinned/Published switches in bordered cards
   - File: `src/app/page.tsx`

- [x] **4. Settings panel language cleanup**
   - Removed all `language === "tl"` conditionals
   - Removed `labelTl` fields from DAYS array
   - Hardcoded all text to English
   - Updated color scheme to indigo/purple
   - File: `src/components/settings-panel.tsx`

- [x] **5. Add-item picker language cleanup**
   - Removed `labelTl` field from type definition
   - Removed all Tagalog labels from items
   - Updated header icon to rounded-xl with indigo/purple gradient
   - File: `src/components/add-item-picker.tsx`

### Medium Priority

- [x] **6. Section persistence**
   - Expanded/collapsed section state saved to localStorage
   - State loaded from localStorage on mount
   - Survives page reload

- [x] **7. Search improvements**
   - Add category filter chips
   - Highlight matched text in results

- [x] **8. Card image lazy loading**
   - Blur placeholder + lazy loading via `LazyImage` component
   - Used in PadletCard, EventCard, RoleCard

- [x] **9. Dark mode polish**
   - Dark mode pulse-glow animation
   - Calendar today highlight dark variant
   - Event type colors already had dark variants

- [x] **10. Admin notice manager styling**
   - Match the new card-hover and rounded-2xl design language
   - File: `src/components/noticeboard/notice-manager.tsx`

### Low Priority

- [x] **11. PWA / offline support**
   - Enhanced service worker with stale-while-revalidate for API data
   - Cache uploaded files (images, PDFs) for offline viewing
   - Separate data cache for notices/events/meetings

- [x] **12. Bookmark sync**
   - Added Bookmark model to Prisma schema
   - Created `/api/bookmarks` GET/POST endpoints
   - Client syncs bookmarks to server when logged in
   - Falls back to localStorage for anonymous users

- [x] **13. Calendar mobile view**
   - Agenda-style list view on mobile, grid on desktop

- [x] **14. Event manager styling**
   - Match new design language
   - File: `src/components/events/event-manager.tsx`

- [x] **15. Users panel styling**
   - Match new design language
   - File: `src/components/users-panel.tsx`

---

## Design Tokens

### Colors (CSS Custom Properties)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | `oklch(0.98 0.002 250)` | `oklch(0.14 0.008 260)` | Page background |
| `--card` | `oklch(1 0 0)` | `oklch(0.19 0.008 260)` | Card backgrounds |
| `--primary` | `oklch(0.55 0.22 260)` | `oklch(0.65 0.2 260)` | Primary actions, badges |
| `--border` | `oklch(0.91 0.005 250)` | `oklch(1 0 0 / 10%)` | Borders (used at 40% opacity) |
| `--muted-foreground` | `oklch(0.52 0.01 250)` | `oklch(0.65 0.01 260)` | Secondary text |

### Radius
| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.75rem` | Base |
| `--radius-sm` | `calc(0.75rem - 4px)` | Small elements |
| `--radius-lg` | `0.75rem` | Cards (default) |
| `--radius-xl` | `calc(0.75rem + 4px)` | Large containers |

### Animations
| Class | Duration | Effect |
|-------|----------|--------|
| `.card-hover` | 300ms | translateY(-4px) + shadow on hover |
| `.fade-in-up` | 400ms | Opacity 0→1 + translateY(8px→0) on mount |
| `.recently-updated` | 2s x3 | Pulse glow shadow |
| `.animate-marquee` | linear infinite | Horizontal scroll for ticker |

### Typography
| Element | Mobile | Desktop | Weight |
|---------|--------|---------|--------|
| Page title | `text-lg` | `text-xl` | `font-bold` |
| Section title | `text-base` | `text-lg` | `font-bold` |
| Card title | `text-sm` | `text-base` | `font-bold` |
| Body text | `text-sm` | `text-sm` | normal |
| Caption/timestamp | `text-xs` | `text-xs` | normal |
| Badge/type label | `text-[10px]` | `text-[10px]` | `font-bold` |

---

## Docker Deployment

```yaml
# docker-compose.yml
services:
  noticeboard-app:
    build: .
    ports: ["3003:3003"]
    volumes:
      - ./data:/app/data          # SQLite DB
      - ./uploads:/app/public/uploads  # Uploaded files
    environment:
      - DATABASE_URL=file:/app/data/noticeboard.db
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost:3003}
      - ADMIN_EMAIL=${ADMIN_EMAIL:-admin@jw.org}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}
    deploy:
      resources:
        limits: { memory: 256M, cpus: "0.5" }
```

### Commands
```bash
# Rebuild and restart
docker compose down && docker compose up -d --build

# Clean up cache (MANDATORY after builds)
docker system prune -a --volumes -f && docker builder prune -a -f

# Check status
docker ps --filter name=noticeboard-app
curl -s -o /dev/null -w '%{http_code}' http://localhost:3003/
```
