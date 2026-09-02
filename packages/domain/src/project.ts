import type {
  Confidence,
  EvidenceRecord,
  Identifier,
  IsoDateTime,
  Provenance,
  Sensitivity
} from "@jarvis/contracts";

export type ProjectStatus =
  "inbox" | "active" | "incubating" | "paused" | "completed" | "archived";

export interface ProjectDecision {
  readonly id: Identifier;
  readonly question: string;
  readonly choice: string;
  readonly rationale: string;
  readonly alternatives: readonly string[];
  readonly reopenWhen: readonly string[];
  readonly decidedAt: IsoDateTime;
  readonly confidence: Confidence;
  readonly evidenceIds: readonly Identifier[];
}

export interface ProjectHypothesis {
  readonly id: Identifier;
  readonly statement: string;
  readonly falsificationTest: string;
  readonly status: "open" | "supported" | "rejected" | "inconclusive";
}

export interface ProjectExperiment {
  readonly id: Identifier;
  readonly hypothesisId: Identifier;
  readonly description: string;
  readonly successCriterion: string;
  readonly estimatedCost: number;
  readonly estimatedHours: number;
  readonly uncertaintyReduction: number;
  readonly status: "proposed" | "running" | "completed" | "cancelled";
}

export interface ProjectMemory {
  readonly id: Identifier;
  readonly projectId: Identifier;
  readonly statement: string;
  readonly provenance: Provenance;
  readonly sensitivity: Sensitivity;
  readonly expiresAt?: IsoDateTime;
  readonly kind: "episodic" | "semantic" | "prospective";
}

export interface Project {
  readonly id: Identifier;
  readonly title: string;
  readonly objective: string;
  readonly successCriteria: readonly string[];
  readonly status: ProjectStatus;
  readonly nextAction?: string;
  readonly updatedAt: IsoDateTime;
  readonly decisions: readonly ProjectDecision[];
  readonly hypotheses: readonly ProjectHypothesis[];
  readonly experiments: readonly ProjectExperiment[];
  readonly memories: readonly ProjectMemory[];
  readonly evidence: readonly EvidenceRecord[];
  readonly relatedProjectIds: readonly Identifier[];
}

export function selectNextBestExperiment(
  experiments: readonly ProjectExperiment[]
): ProjectExperiment | undefined {
  const candidates = experiments.filter(
    (experiment) => experiment.status === "proposed"
  );

  return candidates.toSorted((left, right) => {
    const leftScore = scoreExperiment(left);
    const rightScore = scoreExperiment(right);
    return rightScore - leftScore || left.id.localeCompare(right.id);
  })[0];
}

function scoreExperiment(experiment: ProjectExperiment): number {
  const costPenalty =
    1 + experiment.estimatedCost + experiment.estimatedHours * 10;
  return experiment.uncertaintyReduction / costPenalty;
}
