// Shared Tailwind class strings for the wizard's step forms — comfortable,
// readable spacing (Risansi design guide §7.2: sunk input well, hairline
// strong border, uppercase labels).
//
// Spacing/sizing below uses fixed px (arbitrary values) rather than
// Tailwind's rem-based scale (gap-x-6, px-4, text-base, …). Those rem
// utilities scale with the app's root font-size, which index.css sets to
// 13px ("compact scale") — noticeably tighter than the 16px browser default
// they'd otherwise assume. Fixed px keeps the wizard at the intended wider
// spacing regardless of that root font-size.
export const grid = "grid grid-cols-2 gap-x-[24px] gap-y-[12px]";
export const fieldWrap = "flex flex-col gap-[4px]";
export const fullWidth = "col-span-2";
export const label =
  "text-[12.5px] font-semibold uppercase tracking-wide text-fg-2";
export const control =
  "w-full rounded-lg border border-line-strong bg-sunk px-[16px] py-[10px] text-[15px] text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft";
export const btnPrimary =
  "rounded-lg bg-title px-[32px] py-[14px] text-[16px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "rounded-lg border-2 border-line-strong bg-paper px-[32px] py-[14px] text-[16px] font-semibold text-fg-2 transition-colors hover:border-accent hover:text-accent hover:bg-elev";
export const actions = "mt-[20px] flex justify-end gap-[12px]";
export const hint = "text-[12px] text-fg-3";
export const hintError = "text-[12px] text-neg";

// Compact variants for inline rows (e.g. next to a text input).
export const btnPrimarySm =
  "rounded-lg bg-title px-[16px] py-[12px] text-[14px] font-semibold text-white whitespace-nowrap transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhostSm =
  "rounded-lg border border-line-strong bg-paper px-[16px] py-[12px] text-[14px] font-medium text-fg-2 whitespace-nowrap transition-colors hover:bg-elev disabled:cursor-not-allowed disabled:opacity-50";
