// Shared Tailwind class strings for the wizard's step forms — comfortable,
// readable spacing (Risansi design guide §7.2: sunk input well, hairline
// strong border, uppercase labels), a touch roomier than fully-dense.
export const grid = "grid grid-cols-2 gap-x-5 gap-y-4";
export const fieldWrap = "flex flex-col gap-1.5";
export const fullWidth = "col-span-2";
export const label =
  "text-xs font-semibold uppercase tracking-wide text-fg-2";
export const control =
  "w-full rounded-lg border border-line-strong bg-sunk px-3.5 py-2.5 text-sm text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft";
export const btnPrimary =
  "rounded-lg bg-title px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "rounded-lg border border-line-strong bg-paper px-5 py-2.5 text-sm font-medium text-fg-2 transition-colors hover:bg-elev";
export const actions = "mt-7 flex justify-end gap-3";
export const hint = "text-[12px] text-fg-3";
