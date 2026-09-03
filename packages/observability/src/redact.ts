const secretKeyPattern =
  /^(authorization|proxy[-_]?authorization|api[-_]?key|x[-_]?api[-_]?key|password|private[-_]?key|secret|client[-_]?secret|access[-_]?token|refresh[-_]?token|id[-_]?token|cookie|set[-_]?cookie|jwt|token)$/i;
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const knownCredentialPattern =
  /\b(sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,})\b/g;
const privateKeyPattern =
  /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g;

export function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(bearerPattern, "Bearer [REDACTED]")
      .replace(jwtPattern, "[REDACTED JWT]")
      .replace(knownCredentialPattern, "[REDACTED]")
      .replace(privateKeyPattern, "[REDACTED PRIVATE KEY]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      secretKeyPattern.test(key) ? "[REDACTED]" : redact(nested)
    ])
  );
}
