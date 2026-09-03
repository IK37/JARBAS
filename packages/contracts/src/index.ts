export * from "./ai.js";
export * from "./config.js";
export * from "./health.js";
export * from "./session.js";
export * from "./shared.js";

import type { Identifier, IsoDateTime } from "./shared.js";

export type Confidence = "low" | "medium" | "high";
export type Sensitivity = "public" | "personal" | "sensitive" | "restricted";

export interface Provenance {
  readonly sourceId: Identifier;
  readonly sourceType: "user" | "document" | "tool" | "model" | "system";
  readonly capturedAt: IsoDateTime;
  readonly confidence: Confidence;
}

export interface EvidenceRecord {
  readonly id: Identifier;
  readonly claim: string;
  readonly sourceUrl: string;
  readonly studyType:
    | "systematic-review"
    | "meta-analysis"
    | "controlled-trial"
    | "observational"
    | "mechanistic"
    | "expert-opinion";
  readonly certainty: "very-low" | "low" | "moderate" | "high";
  readonly limitations: readonly string[];
  readonly lastReviewedAt: IsoDateTime;
}

export type RiskLevel = "R0" | "R1" | "R2" | "R3" | "R4";

export interface ToolDefinition {
  readonly name: string;
  readonly version: string;
  readonly scopes: readonly string[];
  readonly riskLevel: RiskLevel;
  readonly sideEffects: boolean;
  readonly reversible: boolean;
  readonly timeoutMs: number;
}

export interface ActionProposal {
  readonly id: Identifier;
  readonly tool: ToolDefinition;
  readonly requestedScopes: readonly string[];
  readonly target: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly originatesFromExternalContent: boolean;
}

export interface Grant {
  readonly id: Identifier;
  readonly scopes: readonly string[];
  readonly resources: readonly string[];
  readonly expiresAt?: IsoDateTime;
  readonly maxUses?: number;
  readonly uses: number;
}

export interface PolicyDecision {
  readonly outcome: "allow" | "confirm" | "deny";
  readonly reasons: readonly string[];
}
