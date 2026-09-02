import { describe, expect, it } from "vitest";
import {
  calculateProjectPulse,
  selectNextBestExperiment,
  type Project,
  type ProjectExperiment
} from "../packages/domain/src/index.js";

const cheapHighLearning: ProjectExperiment = {
  id: "experiment-a",
  hypothesisId: "hypothesis-a",
  description: "Testar com três projetos reais",
  successCriterion: "Retomar contexto em menos de 30 segundos",
  estimatedCost: 0,
  estimatedHours: 2,
  uncertaintyReduction: 80,
  status: "proposed"
};

describe("project intelligence", () => {
  it("selects the experiment with the best uncertainty-to-cost ratio", () => {
    const expensive: ProjectExperiment = {
      ...cheapHighLearning,
      id: "experiment-b",
      estimatedCost: 2_000,
      uncertaintyReduction: 90
    };

    expect(selectNextBestExperiment([expensive, cheapHighLearning])?.id).toBe(
      "experiment-a"
    );
  });

  it("flags an active project without a next action", () => {
    const project: Project = {
      id: "project-a",
      title: "JARVIS",
      objective: "Construir o Personal R&D OS",
      successCriteria: ["Retomada em 30 segundos"],
      status: "active",
      updatedAt: "2026-08-15T12:00:00.000Z",
      decisions: [],
      hypotheses: [],
      experiments: [],
      memories: [],
      evidence: [],
      relatedProjectIds: []
    };

    expect(
      calculateProjectPulse(project, new Date("2026-09-02T12:00:00.000Z"))
    ).toEqual({
      score: 20,
      state: "stalled",
      signals: ["missing-next-action", "inactive-14-days"]
    });
  });
});
