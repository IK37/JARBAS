import type { Project } from "./project.js";

export interface ProjectPulse {
  readonly score: number;
  readonly state: "healthy" | "attention" | "stalled";
  readonly signals: readonly string[];
}

const DAY_MS = 86_400_000;

export function calculateProjectPulse(
  project: Project,
  now: Date = new Date()
): ProjectPulse {
  if (project.status !== "active") {
    return { score: 100, state: "healthy", signals: [] };
  }

  const signals: string[] = [];
  let score = 100;
  const inactiveDays = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(project.updatedAt)) / DAY_MS)
  );

  if (!project.nextAction?.trim()) {
    score -= 35;
    signals.push("missing-next-action");
  }

  if (inactiveDays >= 14) {
    score -= 45;
    signals.push("inactive-14-days");
  } else if (inactiveDays >= 7) {
    score -= 25;
    signals.push("inactive-7-days");
  }

  const openHypotheses = project.hypotheses.filter(
    (hypothesis) => hypothesis.status === "open"
  ).length;
  const proposedExperiments = project.experiments.filter(
    (experiment) => experiment.status === "proposed"
  ).length;

  if (openHypotheses > 0 && proposedExperiments === 0) {
    score -= 20;
    signals.push("untested-hypotheses");
  }

  const boundedScore = Math.max(0, score);
  const state =
    boundedScore >= 70
      ? "healthy"
      : boundedScore >= 40
        ? "attention"
        : "stalled";

  return { score: boundedScore, state, signals };
}
