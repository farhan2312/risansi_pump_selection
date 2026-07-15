// Shared Tailwind class strings for the wizard's step forms — compact
// spacing, per the Risansi design guide's form-control recipe (§7.2):
// sunk input well, hairline strong border, 13px type, uppercase labels.
export const grid = "grid grid-cols-2 gap-3";
export const fieldWrap = "flex flex-col gap-1";
export const fullWidth = "col-span-2";
export const label =
  "text-[11px] font-semibold uppercase tracking-wide text-fg-2";
export const control =
  "w-full rounded-md border border-line-strong bg-sunk px-3 py-2 text-[13px] text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft";
export const btnPrimary =
  "rounded-md bg-title px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "rounded-md border border-line-strong bg-paper px-4 py-2 text-[13px] font-medium text-fg-2 transition-colors hover:bg-elev";
export const actions = "mt-6 flex justify-end gap-2.5";
export const hint = "text-[12px] text-fg-3";
