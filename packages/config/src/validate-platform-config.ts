import { backends } from "./validate-ai-config.js";
import {
  array,
  boolean,
  enumValue,
  type JsonObject,
  nonEmptyString,
  object,
  positiveNumber,
  uniqueId
} from "./validation-primitives.js";

const classifications = [
  "public",
  "personal",
  "private",
  "secret",
  "restricted"
] as const;

export function validatePlatformConfig(root: JsonObject): void {
  validateHardwareProfiles(root.hardwareProfiles);
  validateExternalDataPolicy(root.externalDataPolicy);
}

function validateHardwareProfiles(value: unknown): void {
  const ids = new Set<string>();
  for (const [index, candidate] of array(value, "hardwareProfiles").entries()) {
    const item = object(candidate, `hardwareProfiles[${index}]`);
    uniqueId(item.id, `hardwareProfiles[${index}].id`, ids);
    nonEmptyString(item.label, `hardwareProfiles[${index}].label`);
    enumValue(item.phase, `hardwareProfiles[${index}].phase`, [
      "current",
      "future"
    ] as const);
    nonEmptyString(item.cpu, `hardwareProfiles[${index}].cpu`);
    nonEmptyString(item.gpu, `hardwareProfiles[${index}].gpu`);
    positiveNumber(item.vramGb, `hardwareProfiles[${index}].vramGb`);
    positiveNumber(item.ramGb, `hardwareProfiles[${index}].ramGb`);
    const preferred = array(
      item.preferredBackends,
      `hardwareProfiles[${index}].preferredBackends`
    );
    if (preferred.length === 0) {
      throw new Error("Hardware profiles require a preferred backend");
    }
    preferred.forEach((backend, backendIndex) =>
      enumValue(
        backend,
        `hardwareProfiles[${index}].preferredBackends[${backendIndex}]`,
        backends
      )
    );
  }
}

function validateExternalDataPolicy(value: unknown): void {
  const seen = new Set<string>();
  for (const [index, candidate] of array(
    value,
    "externalDataPolicy"
  ).entries()) {
    const item = object(candidate, `externalDataPolicy[${index}]`);
    const classification = enumValue(
      item.classification,
      `externalDataPolicy[${index}].classification`,
      classifications
    );
    if (seen.has(classification)) {
      throw new Error(`Duplicate external data rule: ${classification}`);
    }
    seen.add(classification);
    enumValue(
      item.defaultAction,
      `externalDataPolicy[${index}].defaultAction`,
      ["allow", "confirm", "deny"] as const
    );
    const externalAllowed = boolean(
      item.externalAllowed,
      `externalDataPolicy[${index}].externalAllowed`
    );
    if (
      (classification === "secret" || classification === "restricted") &&
      externalAllowed
    ) {
      throw new Error(
        `${classification} data must never be externally allowed`
      );
    }
  }
  for (const classification of classifications) {
    if (!seen.has(classification)) {
      throw new Error(`Missing external data rule: ${classification}`);
    }
  }
}
