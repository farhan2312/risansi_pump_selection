// Shared Tailwind class strings for the wizard's step forms — comfortable,
// readable spacing (Risansi design guide §7.2: sunk input well, hairline
// strong border, uppercase labels).
export const grid = "grid grid-cols-2 gap-x-6 gap-y-3";
export const fieldWrap = "flex flex-col gap-1";
export const fullWidth = "col-span-2";
export const label =
  "text-[12.5px] font-semibold uppercase tracking-wide text-fg-2";
export const control =
  "w-full rounded-lg border border-line-strong bg-sunk px-4 py-2.5 text-[15px] text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft";
export const btnPrimary =
  "rounded-lg bg-title px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "rounded-lg border-2 border-line-strong bg-paper px-8 py-3.5 text-base font-semibold text-fg-2 transition-colors hover:border-accent hover:text-accent hover:bg-elev";
export const actions = "mt-5 flex justify-end gap-3";
export const hint = "text-[12px] text-fg-3";
export const hintError = "text-[12px] text-neg";

// Compact variants for inline rows (e.g. next to a text input).
export const btnPrimarySm =
  "rounded-lg bg-title px-4 py-3 text-sm font-semibold text-white whitespace-nowrap transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhostSm =
  "rounded-lg border border-line-strong bg-paper px-4 py-3 text-sm font-medium text-fg-2 whitespace-nowrap transition-colors hover:bg-elev disabled:cursor-not-allowed disabled:opacity-50";
