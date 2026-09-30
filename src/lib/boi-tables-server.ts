// Server-only: the Drizzle table and default order behind each BOI_TABLES key.
import { asc, sql } from "drizzle-orm";

import type { BoiTableKey } from "@/lib/boi-tables";
import { boiDrpPanel, boiDrpProbe, pumpShaftDia } from "@/lib/db/schema";

export const BOI_DB = { "drp-probe": boiDrpProbe, "drp-panel": boiDrpPanel, "shaft-dia": pumpShaftDia } as const;

export const BOI_ORDER = {
  "drp-probe": [asc(boiDrpProbe.sizeMm)],
  "drp-panel": [asc(boiDrpPanel.srNo), asc(boiDrpPanel.description)],
  "shaft-dia": [sql`${pumpShaftDia.shaftDia} asc nulls last`, asc(pumpShaftDia.model)],
} satisfies Record<BoiTableKey, unknown[]>;
