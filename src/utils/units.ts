// Client-side mirror of the engine's unit conversions (recommendation-engine.ts
// toM3PerHr / toMwc), so the wizard can show the converted base-unit value
// inline without importing server-only code. Keep in sync with the engine.

export function toM3PerHr(value: number, unit: string, sg: number): number {
  const u = (unit || "M3/hr").trim();
  if (u === "M3/hr") return value;
  if (u === "LPH") return value / 1000;
  if (u === "GPM") return value * 0.227125; // US gallons/min
  if (u === "KLPD") return value / 24; // kiloliters/day
  if (u === "TPH") return value / (sg || 1.0); // tons/hr, needs density
  return value;
}

export function toMwc(value: number, unit: string, sg: number): number {
  const u = (unit || "MWC").trim();
  if (u === "MWC") return value;
  if (u === "MLC") return value / (sg || 1.0);
  if (u === "Bar") return value * 10.0;
  if (u === "Kg/cm2" || u === "Kg/cm²") return value * 10.0;
  return value;
}

/** Nicely formatted number for the inline hint (drops trailing zeros). */
export function fmt(n: number): string {
  if (!isFinite(n)) return "—";
  return Number(n.toFixed(3)).toLocaleString("en-IN");
}
