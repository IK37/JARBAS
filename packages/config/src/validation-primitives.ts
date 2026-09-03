export type JsonObject = Record<string, unknown>;

export function object(value: unknown, path: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as JsonObject;
}

export function array(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value;
}

export function string(value: unknown, path: string): string {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
  return value;
}

export function nonEmptyString(value: unknown, path: string): string {
  const result = string(value, path);
  if (!result.trim()) throw new Error(`${path} must not be empty`);
  return result;
}

export function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean`);
  return value;
}

export function positiveNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${path} must be a positive number`);
  }
  return value;
}

export function integer(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`${path} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

export function positiveInteger(value: unknown, path: string): number {
  return integer(value, path, 1, Number.MAX_SAFE_INTEGER);
}

export function enumValue<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[]
): T {
  const result = string(value, path);
  if (!allowed.includes(result as T)) {
    throw new Error(`${path} must be one of: ${allowed.join(", ")}`);
  }
  return result as T;
}

export function uniqueId(
  value: unknown,
  path: string,
  seen: Set<string>
): string {
  const id = nonEmptyString(value, path);
  if (seen.has(id)) throw new Error(`Duplicate id: ${id}`);
  seen.add(id);
  return id;
}
