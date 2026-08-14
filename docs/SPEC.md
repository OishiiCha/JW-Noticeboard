# Standalone Noticeboard App — Specification

## Overview

A standalone noticeboard application extracted from the main NB app. It provides a public-facing digital noticeboard with file uploads, calendar events, and meeting schedule display — without the complex schedule/assignment/territory systems of the main app.

**Location:** `/home/lucas/nb/noticeboard/`
**Port:** 3003 (next available after maintenance-app on 3002)
**Database:** SQLite at `data/noticeboard.db` (separate from main app)

---

## What's Different from the Main App

| Feature | Main App | Standalone Noticeboard |
|---------|----------|------------------------|
| Schedule source | Scraped from jw.org, assigned to brothers | **Manual entry** — admin sets meeting date/time, uploads schedule PDF |
| Meeting assignments | Full part-by-part assignment system | Not included — just show the date/time and uploaded file |
| Brothers/Groups | Full publisher management | Not included |
| Territories, Field Service, Cart | Full modules | Not included |
| Chat, Info Board | Full modules | Not included |
| Noticeboard | Embedded in main app | **Core feature** — enhanced |
| Calendar | Aggregates all module events | **Notice + event + meeting dates only** |
| File uploads | Cloud storage (Dropbox/S3/etc.) | **Local storage** with optional cloud (keep it simple) |

---

## Tech Stack (same as parent for consistency)

- Next.js 16 (App Router)
- React 19, Tailwind CSS 4, shadcn/ui
- Prisma + SQLite
- NextAuth (credentials provider, admin + user roles)
- Local file storage (`public/uploads/`) with optional cloud sync

---

## Prisma Models

### Auth (simplified — same as maintenance-app pattern)

- **User** — username, email, password, role (`admin` / `user`), interfaceLanguage, isActive
- **Account** / **Session** / **VerificationToken** — NextAuth standard
- **Setting** — key-value config (meeting days, times, cloud config, etc.)

### Noticeboard

- **Category** — name, nameTl, slug, icon, color, sortOrder, isActive
- **Notice** — title, titleTl, description, type (`text`/`pdf`/`image`/`link`), content, fileUrl, fileName, thumbnailUrl, linkUrl, linkLabel, linkIcon, isPinned, isPublished, isPublic, audience, showOnCalendar, eventStartDate, eventEndDate, expiresAt, pinExpiresAt, publishAt, approvalStatus, categoryId, createdBy, language, deletedAt
- **NoticeRead** — noticeId, userId, readAt

### Meeting Schedule (simplified — no brother assignments)

- **MeetingSchedule** — meetingType (`midweek`/`weekend`), date (ISO `YYYY-MM-DD`), time (`HH:mm`), location, scheduleFileUrl (uploaded PDF), scheduleFileName, notes, isPublished, createdAt, updatedAt
  - Admin manually creates entries for each meeting
  - Can upload a PDF of the schedule that users can view/download
  - The current/next meeting shows on the public noticeboard

### Events / Calendar

- **SpecialEvent** — title, titleTl, type (`convention`/`co_visit`/`assembly`/`memorial`/`other`), startDate (ISO), endDate (ISO), location, description, imageUrl, color, showOnNoticeboard, createdAt, updatedAt
- **MeetingOverride** — date (ISO), meetingType, overrideDay, overrideTime, isCancelled, reason

---

## Views

### Public View (no login required)

Visible to anyone with the URL. Shows:

1. **Current Meeting Card** — next upcoming midweek + weekend meeting with date, time, and link to uploaded schedule PDF
2. **Pinned Notices** — pinned notices at the top (with pin expiry support)
3. **Notice Feed** — published, non-expired notices sorted by date
4. **Category Filter** — filter notices by category
5. **Search** — search notices by title/description
6. **Calendar View** — monthly calendar showing:
   - Meeting dates (midweek + weekend)
   - Special events
   - Notices with `showOnCalendar = true` and `eventStartDate` set
   - Meeting overrides (cancelled/rescheduled)
7. **Language Toggle** — EN / TL
8. **Dark/Light Mode** — theme toggle
9. **PDF Viewer** — click a PDF notice to view inline or download
10. **File Download** — download attached files (PDF, images)

### Admin View (login required)

1. **Notice Management**
   - Create / edit / delete notices
   - Upload files (PDF, images) — link to a date range
   - Pin/unpin notices (with pin expiry)
   - Schedule publish time
   - Set audience visibility (`all` / `elders` / `ms` / `publishers`)
   - Approval workflow for user-submitted notices
   - Soft delete with restore
   - Category management (CRUD)
   - Notice style customization (layout, colors)

2. **Meeting Schedule Management**
   - Set midweek meeting day + time (e.g., Tuesday 18:30)
   - Set weekend meeting day + time (e.g., Saturday 15:00)
   - Create specific meeting entries with custom dates/times
   - Upload schedule PDF for each meeting
   - Mark meetings as cancelled or rescheduled (MeetingOverride)
   - Publish/unpublish meeting schedules

3. **Event Management**
   - Create / edit / delete special events
   - Set event type, date range, location, description
   - Upload event image
   - Toggle show on noticeboard
   - Set calendar color

4. **Calendar Management**
   - View all calendar events in a month/week/day grid
   - Click any event to edit
   - Drag to reschedule (optional, future)
   - iCal export endpoint

5. **Settings**
   - Meeting day/time defaults
   - Noticeboard display style
   - Language preferences
   - User management (create/edit users, reset passwords)
   - Optional cloud storage configuration

---

## File Upload Flow

Instead of connecting to jw.org schedules:

1. Admin goes to **Meeting Schedule** tab
2. Creates a meeting entry (date, time, type)
3. Uploads a PDF file (the schedule for that meeting)
4. The PDF is stored locally in `public/uploads/schedules/`
5. Public view shows the meeting card with a "View Schedule" button
6. Users can view/download the PDF

For notices:
1. Admin creates a notice
2. Selects type: `text`, `pdf`, `image`, or `link`
3. If PDF/image: uploads file → stored in `public/uploads/notices/`
4. Optionally links the notice to a date range (`eventStartDate` / `eventEndDate`)
5. If `showOnCalendar` is true, the notice appears on the calendar for that date range

---

## API Routes

```
/api/auth/[...nextauth]/route.ts          — NextAuth handler
/api/notices/route.ts                     — GET (list), POST (create)
/api/notices/[id]/route.ts                — GET, PUT, DELETE
/api/notices/approve/route.ts             — POST (approve/reject)
/api/notices/read/route.ts                — POST (mark as read)
/api/notices/publish-scheduled/route.ts   — POST (publish scheduled notices)
/api/categories/route.ts                  — GET, POST
/api/categories/[id]/route.ts             — PUT, DELETE
/api/meetings/route.ts                    — GET (list), POST (create)
/api/meetings/[id]/route.ts               — GET, PUT, DELETE
/api/events/route.ts                      — GET, POST
/api/events/[id]/route.ts                 — PUT, DELETE
/api/calendar/route.ts                    — GET (calendar events for month)
/api/calendar/ical/route.ts               — GET (iCal feed)
/api/upload/route.ts                      — POST (file upload)
/api/settings/route.ts                    — GET, PUT
/api/admin/users/route.ts                 — GET, POST (user management)
/api/admin/users/[id]/route.ts            — PUT, DELETE
```

---

## Folder Structure

```
noticeboard/
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── prisma/
│   └── schema.prisma              # Noticeboard + auth models
├── public/
│   └── uploads/
│       ├── notices/               # Uploaded notice files
│       └── schedules/             # Uploaded schedule PDFs
├── data/                          # SQLite DB
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Public noticeboard view
│   │   ├── globals.css
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── admin/
│   │   │   ├── page.tsx           # Admin dashboard
│   │   │   ├── notices/
│   │   │   │   └── page.tsx       # Notice management
│   │   │   ├── meetings/
│   │   │   │   └── page.tsx       # Meeting schedule management
│   │   │   ├── events/
│   │   │   │   └── page.tsx       # Event management
│   │   │   ├── calendar/
│   │   │   │   └── page.tsx       # Calendar management
│   │   │   ├── categories/
│   │   │   │   └── page.tsx       # Category management
│   │   │   └── settings/
│   │   │       └── page.tsx       # Settings + user management
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── notices/
│   │       ├── categories/
│   │       ├── meetings/
│   │       ├── events/
│   │       ├── calendar/
│   │       ├── upload/
│   │       ├── settings/
│   │       └── admin/users/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives
│   │   ├── noticeboard/
│   │   │   ├── public-noticeboard.tsx   # Public view
│   │   │   ├── notice-card.tsx
│   │   │   ├── notice-detail-modal.tsx
│   │   │   ├── create-notice-modal.tsx
│   │   │   ├── category-filter.tsx
│   │   │   └── events-banner.tsx
│   │   ├── calendar/
│   │   │   └── full-calendar.tsx        # Calendar component
│   │   ├── meetings/
│   │   │   ├── meeting-card.tsx         # Current meeting display
│   │   │   └── meeting-manager.tsx      # Admin meeting CRUD
│   │   ├── events/
│   │   │   └── event-manager.tsx        # Event CRUD
│   │   └── app-sidebar.tsx              # Admin navigation
│   ├── lib/
│   │   ├── db.ts                        # Prisma client
│   │   ├── auth-api.ts                  # Auth helpers
│   │   ├── auth-options.ts              # NextAuth config
│   │   ├── i18n.ts                      # EN/TL translations
│   │   ├── noticeboard-styles.ts        # Display style options
│   │   └── utils.ts                     # cn() utility
│   └── hooks/
│       ├── use-language.ts              # Language store
│       └── use-toast.ts                 # Toast notifications
├── Dockerfile
└── docker-compose.yml
```

---

## Docker Configuration

- **Port:** 3003
- **Volumes:** `./data:/app/data` (SQLite), `./uploads:/app/public/uploads` (files)
- **Env:** `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- **Healthcheck:** `wget --spider http://localhost:3003/`
- **Resource limits:** 256M memory, 0.5 CPUs (lighter than maintenance-app)

---

## Implementation Steps

1. **Create folder structure** — `noticeboard/` with all subdirectories
2. **Copy and trim Prisma schema** — noticeboard + meeting + event + auth models
3. **Copy UI components** — full `components/ui/` directory from main app
4. **Copy and simplify noticeboard components** — remove dependencies on `useAppStore`, schedule components, cleaning reminders
5. **Create meeting schedule components** — new `MeetingSchedule` model + admin UI for manual entry + PDF upload
6. **Copy calendar component** — simplify to only show notices + events + meetings
7. **Copy and adapt API routes** — notices, categories, events, calendar, upload, settings, auth
8. **Create simplified app shell** — public view at `/`, admin at `/admin/*`
9. **Create Docker config** — Dockerfile + docker-compose for standalone deployment
10. **Test** — verify notice CRUD, file upload, calendar, meeting schedule display, public view

---

## What NOT to Include

- Brother/Group management (no person assignment)
- Schedule scraping from jw.org
- Part-by-part meeting assignments
- Territories, field service, cart witnessing
- Chat, info board
- Push notifications, SMS, WhatsApp, email
- Maintenance, cleaning, repair issues
- Accounting, audit sessions
- Multi-congregation support (single congregation)
- AI/WebLLM features
- Onboarding wizard

---

## Future Addon Integration

The noticeboard app is designed to work standalone but can be linked back to the main app as an addon in the future:

- **Shared database docs:** See `database-docs/main-app-schema.md` for the main app's full schema
- **Notice model:** Matches the main app's `Notice` model exactly — can sync or share data
- **SpecialEvent model:** Matches the main app's `SpecialEvent` model — events can be shared
- **MeetingOverride model:** Same structure — meeting changes can propagate
- **MeetingSchedule model:** New to this app (main app uses `Schedule` + `WeekendMeeting` with brother assignments) — a simplified version that could be mapped back

When linking as an addon, the main app's `Schedule` and `WeekendMeeting` models can populate the noticeboard's `MeetingSchedule` entries via an API or database sync.
