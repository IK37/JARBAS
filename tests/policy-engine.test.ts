import { describe, expect, it } from "vitest";
import type { ActionProposal, Grant } from "../packages/contracts/src/index.js";
import { evaluateAction } from "../packages/security/src/index.js";

const grant: Grant = {
  id: "grant-1",
  scopes: ["files:read", "files:write"],
  resources: ["/workspace/projects"],
  uses: 0
};

function proposal(overrides: Partial<ActionProposal> = {}): ActionProposal {
  return {
    id: "proposal-1",
    tool: {
      name: "workspace-file",
      version: "1.0.0",
      scopes: ["files:read"],
      riskLevel: "R1",
      sideEffects: false,
      reversible: true,
      timeoutMs: 2_000
    },
    requestedScopes: ["files:read"],
    target: "/workspace/projects/jarvis/README.md",
    reason: "Indexar arquivo autorizado",
    idempotencyKey: "index-readme-v1",
    originatesFromExternalContent: false,
    ...overrides
  };
}

describe("policy engine", () => {
  it("allows scoped read-only work", () => {
    expect(
      evaluateAction(proposal(), {
        grants: [grant],
        now: "2026-09-02T12:00:00.000Z"
      }).outcome
    ).toBe("allow");
  });

  it("denies targets outside the grant", () => {
    expect(
      evaluateAction(proposal({ target: "/workspace/secrets/token.txt" }), {
        grants: [grant],
        now: "2026-09-02T12:00:00.000Z"
      }).outcome
    ).toBe("deny");
  });

  it("denies traversal even when the textual prefix looks authorized", () => {
    expect(
      evaluateAction(
        proposal({ target: "/workspace/projects/../secrets/token.txt" }),
        { grants: [grant], now: "2026-09-02T12:00:00.000Z" }
      ).outcome
    ).toBe("deny");
  });

  it("denies expired grants", () => {
    expect(
      evaluateAction(proposal(), {
        grants: [{ ...grant, expiresAt: "2026-09-01T12:00:00.000Z" }],
        now: "2026-09-02T12:00:00.000Z"
      }).outcome
    ).toBe("deny");
  });

  it("requires confirmation when external content triggers an action", () => {
    expect(
      evaluateAction(proposal({ originatesFromExternalContent: true }), {
        grants: [grant],
        now: "2026-09-02T12:00:00.000Z"
      }).outcome
    ).toBe("confirm");
  });

  it("blocks R4 even when the user confirms", () => {
    const highRisk = proposal({
      tool: { ...proposal().tool, riskLevel: "R4" }
    });
    expect(
      evaluateAction(highRisk, {
        grants: [grant],
        now: "2026-09-02T12:00:00.000Z",
        userConfirmedProposalId: highRisk.id
      }).outcome
    ).toBe("deny");
  });
});
