/**
 * Noticeboard style definitions.
 *
 * Each style controls the visual appearance of the public noticeboard.
 * The selected style is stored as `noticeboard_style` in the Setting table
 * and exposed via the public settings API.
 */

export type NoticeboardStyleId =
  | "classic"
  | "minimal"
  | "compact"
  | "dark-board"
  | "warm";

export interface NoticeboardStyle {
  id: NoticeboardStyleId;
  label: string;
  labelTl: string;
  description: string;
  descriptionTl: string;
  /** CSS class applied to the noticeboard root container */
  cssClass: string;
  /** Preview accent color for the admin picker */
  accent: string;
  /** Preview background for the admin picker */
  previewBg: string;
}

export const NOTICEBOARD_STYLES: NoticeboardStyle[] = [
  {
    id: "classic",
    label: "Classic",
    labelTl: "Klasiko",
    description:
      "Green gradients, rounded cards, and a warm meeting banner. The default look.",
    descriptionTl:
      "Green gradient, bilugang card, at mainit na banner ng pagpupulong. Ang default na itsura.",
    cssClass: "nb-style-classic",
    accent: "#16a34a",
    previewBg: "linear-gradient(135deg, #f0fdf4, #ecfdf5)",
  },
  {
    id: "minimal",
    label: "Minimal",
    labelTl: "Minimal",
    description:
      "Clean white background, subtle borders, no gradients. Distraction-free reading.",
    descriptionTl:
      "Malinis na puting background, banayad na border, walang gradient. Walang abala sa pagbasa.",
    cssClass: "nb-style-minimal",
    accent: "#525252",
    previewBg: "#ffffff",
  },
  {
    id: "compact",
    label: "Compact List",
    labelTl: "Siksik na Listahan",
    description:
      "List-first layout with tighter spacing. Great for many notices on one screen.",
    descriptionTl:
      "Listahan muna na may mas siksik na espasyo. Maganda para sa maraming abiso sa isang screen.",
    cssClass: "nb-style-compact",
    accent: "#2563eb",
    previewBg: "#eff6ff",
  },
  {
    id: "dark-board",
    label: "Dark Board",
    labelTl: "Dark Board",
    description:
      "Dark-first design with neon accents. Optimized for TV displays at the Kingdom Hall.",
    descriptionTl:
      "Dark-first na disenyo na may neon accent. Optimize para sa TV display sa Kingdom Hall.",
    cssClass: "nb-style-dark-board",
    accent: "#22d3ee",
    previewBg: "#0f172a",
  },
  {
    id: "warm",
    label: "Warm Amber",
    labelTl: "Mainit na Amber",
    description:
      "Amber and orange tones with a cozy feel. Soft shadows and warm accents.",
    descriptionTl:
      "Amber at orange na kulay na may mainit na pakiramdam. Malambot na anino at mainit na accent.",
    cssClass: "nb-style-warm",
    accent: "#d97706",
    previewBg: "linear-gradient(135deg, #fffbeb, #fef3c7)",
  },
];

export const DEFAULT_NOTICEBOARD_STYLE: NoticeboardStyleId = "classic";

export function getNoticeboardStyle(
  id: string | undefined | null
): NoticeboardStyle {
  if (!id) return NOTICEBOARD_STYLES[0];
  return (
    NOTICEBOARD_STYLES.find((s) => s.id === id) ?? NOTICEBOARD_STYLES[0]
  );
}
