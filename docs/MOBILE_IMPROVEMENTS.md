# Mobile View Improvements

Checklist of phone-view issues found during audit and their fixes.

## Critical — Scroll broken on phones

- [x] **`overflow-x: hidden` on `html` breaks vertical scroll on iOS** — Fixed: removed `overflow-x: hidden` from `html`, now uses `overflow-x: clip` on `html` and `overflow-x: hidden` only on `body`.
- [x] **`overscroll-behavior-y: none` on body** — Fixed: changed to `overscroll-behavior-y: contain` which prevents pull-to-refresh without blocking normal scroll bounce.

## Header / Top Bar

- [x] **Sticky header** — Header already uses `sticky top-0 z-50`. Confirmed working.
- [x] **Header too cramped on small phones** — Fixed: search moved to second row on mobile, theme toggle hidden from header (moved to sidebar), login/manage/logout are icon-only on mobile.
- [x] **Header buttons too small for touch** — Fixed: hamburger and bell increased to h-10 w-10 on mobile, login/manage/logout buttons h-9 w-9 on mobile.
- [x] **Search bar too short on mobile** — Fixed: search is now a full-width second row below the header on mobile (`sm:hidden`), desktop keeps it in the top row.
- [x] **Notification panel too wide** — Fixed: notification panel is now a bottom sheet on mobile (`fixed bottom-0 rounded-t-2xl max-h-[70dvh]`), dropdown on desktop.

## Navigation / Sidebar

- [x] **Mobile sidebar** — Uses overlay sidebar with hamburger toggle. Works but could be improved.
- [x] **Sidebar items too small** — Fixed: touch targets increased from `py-2.5` to `py-3`, icons from `h-4` to `h-5`, section headers from `text-[10px]` to `text-xs`, badges from `text-[10px]` to `text-xs`.
- [x] **No bottom navigation bar** — Added: bottom nav bar with Home, Events, Roles, Menu tabs. Admin users get a center FAB (floating action button) for adding items. Hidden on desktop (`lg:hidden`).

## Card Buttons (PadletCard)

- [x] **Card footer buttons too tiny** — Fixed: buttons increased from h-6/h-7 to h-9 w-9 on mobile (sm:h-7 sm:w-7 on desktop), icons from h-2.5 to h-3.5 on mobile.
- [x] **Card admin buttons crowded** — Fixed: admin buttons replaced with a 3-dot more menu on mobile (`sm:hidden`) that opens a popover with Pin/Edit/Archive/Delete. Desktop keeps inline buttons (`hidden sm:flex`).
- [x] **Card text too small** — Fixed: content preview and description increased from `text-xs` to `text-sm` on mobile. Timestamp increased from `text-[10px]` to `text-xs`.

## Carousels (Roles & Schedules)

- [x] **Carousel card widths** — Fixed with responsive widths.
- [x] **CURRENT badge clipping** — Fixed with `py-3 -my-3` on viewport.
- [x] **Carousel nav buttons too small** — Fixed: buttons increased to `h-10 w-10` on mobile (`sm:h-8 sm:w-8` on desktop).
- [ ] **Carousel cards too dense on mobile** — Showing 1.5 cards on a 360px screen means each card is ~240px. Consider showing full-width cards on mobile with snap scrolling.

## Masonry Grid

- [x] **Single column on phones** — Fixed: `columns-1 sm:columns-2`.
- [x] **No gap between cards on very small screens** — Already fine: masonry grid uses `gap-4` and `mb-4` which is 16px.

## Modals

- [x] **Bottom-sheet modals on phones** — All creation/edit modals use `items-end p-0`, `rounded-t-2xl`, `max-h-[95dvh]`.
- [x] **Use `dvh` instead of `vh`** — Done.
- [x] **Modal close button too small** — Fixed: close button increased to h-10 w-10 on mobile (sm:h-8 sm:w-8).
- [x] **Modal content padding too tight** — Fixed: Input component default height increased from `h-9` to `h-10` on mobile (`sm:h-9` on desktop). All modal close buttons increased to `h-10 w-10` on mobile (`sm:h-8 sm:w-8`).

## Settings Modal

- [x] **Full-screen settings on phones** — Done.
- [x] **Responsive settings forms** — Done.
- [x] **Tab bar horizontal scroll** — Done.
- [x] **Settings tab buttons too small** — Fixed: tab buttons increased from `py-1.5 text-xs` to `py-2.5 text-sm` with `px-3.5` for larger touch target.

## Calendar

- [x] **Calendar type filter on mobile** — Done.
- [x] **Calendar event dialog fits phone** — Done.
- [x] **Calendar day cells too small on mobile** — Improved: day header text increased from `text-[10px]` to `text-xs`, day number text increased from `text-[10px]` to `text-xs`. Cells already use `min-h-10` which is adequate for a 7-column grid.

## Add Item / FAB

- [x] **No floating action button on mobile** — Added: center button in bottom nav bar acts as FAB for admins (opens Add Item picker). Elevated with `-mt-5` and indigo shadow.

## Detail Modal

- [x] **Edit/archive/delete from detail modal** — Fixed: close detail first, then open action modal after 150ms delay.
- [x] **Detail modal footer buttons too small** — Fixed: buttons increased to h-10 w-10 on mobile (sm:h-8 sm:w-8), icons h-4 on mobile.
- [x] **Detail modal image too tall** — Fixed: `max-h-[50dvh]` on mobile (sm:max-h-[55vh]) to leave room for content below.

## General

- [x] **No safe-area padding on main content** — Fixed: bottom nav bar includes `pb-[env(safe-area-inset-bottom)]` and main content has `pb-20 lg:pb-6` to clear the nav bar.
- [x] **Body scroll lock when modal open** — Fixed: created shared `useScrollLock` hook in `src/lib/use-scroll-lock.ts`. Added to all 10 modals (announcement, edit-link, letter, link, media, photo, schedule, special-event, weekly-roles, notice-detail). Replaced inline scroll lock code in schedule-modal and weekly-roles-modal with shared hook.
- [x] **Text size too small generally** — Fixed: bottom nav labels increased from `text-[10px]` to `text-xs`. Card content/description increased from `text-xs` to `text-sm`. Calendar day headers/numbers increased from `text-[10px]` to `text-xs`. Sidebar section headers and badges increased from `text-[10px]` to `text-xs`. Remaining `text-[10px]` instances are in badges, notification counts, and PDF labels where small text is appropriate.
