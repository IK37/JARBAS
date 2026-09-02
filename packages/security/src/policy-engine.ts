import type {
  ActionProposal,
  Grant,
  IsoDateTime,
  PolicyDecision
} from "@jarvis/contracts";

export interface PolicyContext {
  readonly grants: readonly Grant[];
  readonly now: IsoDateTime;
  readonly userConfirmedProposalId?: string;
}

const BLOCKED_IN_MVP = new Set(["R4"]);

export function evaluateAction(
  proposal: ActionProposal,
  context: PolicyContext
): PolicyDecision {
  if (hasUnsafeResourcePath(proposal.target)) {
    return decision("deny", "unsafe-resource-path");
  }

  if (BLOCKED_IN_MVP.has(proposal.tool.riskLevel)) {
    return decision("deny", "risk-level-blocked-in-mvp");
  }

  if (!hasValidGrant(proposal, context)) {
    return decision("deny", "missing-or-expired-grant");
  }

  if (proposal.originatesFromExternalContent) {
    if (context.userConfirmedProposalId !== proposal.id) {
      return decision("confirm", "external-content-cannot-grant-authority");
    }
  }

  if (proposal.tool.riskLevel === "R3") {
    if (context.userConfirmedProposalId !== proposal.id) {
      return decision(
        "confirm",
        "sensitive-action-requires-contextual-confirmation"
      );
    }
  }

  if (proposal.tool.sideEffects && !proposal.tool.reversible) {
    if (context.userConfirmedProposalId !== proposal.id) {
      return decision(
        "confirm",
        "non-reversible-side-effect-requires-confirmation"
      );
    }
  }

  return decision("allow", "policy-satisfied");
}

function hasUnsafeResourcePath(target: string): boolean {
  return target.split(/[\\/]/u).some((segment) => segment === "..");
}

function hasValidGrant(
  proposal: ActionProposal,
  context: PolicyContext
): boolean {
  const now = Date.parse(context.now);

  return context.grants.some((grant) => {
    const hasScopes = proposal.requestedScopes.every((scope) =>
      grant.scopes.includes(scope)
    );
    const coversTarget = grant.resources.some(
      (resource) =>
        proposal.target === resource ||
        proposal.target.startsWith(`${resource}/`)
    );
    const hasUses = grant.maxUses === undefined || grant.uses < grant.maxUses;
    const isCurrent =
      grant.expiresAt === undefined || Date.parse(grant.expiresAt) > now;
    return hasScopes && coversTarget && hasUses && isCurrent;
  });
}

function decision(
  outcome: PolicyDecision["outcome"],
  reason: string
): PolicyDecision {
  return { outcome, reasons: [reason] };
}
