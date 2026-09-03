import type { IsoDateTime } from "./shared.js";

export interface ComponentHealth {
  readonly name: "application" | "storage" | "runtime" | "model";
  readonly status: "healthy" | "degraded" | "unavailable";
  readonly detail?: string;
  readonly latencyMs?: number;
}

export interface SystemHealth {
  readonly status: "healthy" | "degraded" | "unavailable";
  readonly checkedAt: IsoDateTime;
  readonly components: readonly ComponentHealth[];
}
