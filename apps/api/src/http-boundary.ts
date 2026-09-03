import type { IncomingMessage, ServerResponse } from "node:http";

import {
  InputContextLimitError,
  InvalidChatRequestError,
  ProviderUnavailableError,
  SessionBusyError,
  SessionNotFoundError
} from "@jarvis/application";
import type { JarbasConfig } from "@jarvis/contracts";

export class HttpError extends Error {
  public constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function readJsonBody(
  request: IncomingMessage,
  maxBytes: number
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as Uint8Array);
    bytes += buffer.length;
    if (bytes > maxBytes)
      throw new HttpError(413, "Request body exceeds limit");
    chunks.push(buffer);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "JSON body must be an object");
  }
  return value as Record<string, unknown>;
}

export function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown
): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

export function enforceOrigin(
  config: JarbasConfig,
  request: IncomingMessage,
  response: ServerResponse
): void {
  const origin = request.headers.origin;
  if (!origin) return;
  if (!allowedOrigins(config).has(origin)) {
    throw new HttpError(403, "Origin not allowed");
  }
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("vary", "Origin");
}

export function applySecurityHeaders(response: ServerResponse): void {
  response.setHeader(
    "content-security-policy",
    "default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  );
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("cache-control", "no-store");
}

export function requireJsonContentType(request: IncomingMessage): void {
  const mediaType = request.headers["content-type"]?.split(";", 1)[0]?.trim();
  if (mediaType !== "application/json") {
    throw new HttpError(415, "Content-Type must be application/json");
  }
}

export function httpStatus(error: unknown): number {
  if (error instanceof HttpError) return error.status;
  if (error instanceof SessionNotFoundError) return 404;
  if (error instanceof SessionBusyError) return 409;
  if (error instanceof InputContextLimitError) return 413;
  if (error instanceof InvalidChatRequestError) return 400;
  if (error instanceof ProviderUnavailableError) return 503;
  return 500;
}

export async function writeNdjson(
  response: ServerResponse,
  value: unknown
): Promise<void> {
  if (response.destroyed || response.writableEnded) throw disconnectedError();
  if (response.write(`${JSON.stringify(value)}\n`)) return;
  await new Promise<void>((resolve, reject) => {
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(disconnectedError());
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      response.off("drain", onDrain);
      response.off("close", onClose);
      response.off("error", onError);
    };
    response.once("drain", onDrain);
    response.once("close", onClose);
    response.once("error", onError);
    if (response.destroyed || response.writableEnded) onClose();
  });
}

function disconnectedError(): Error {
  const error = new Error("Client disconnected while streaming");
  error.name = "AbortError";
  return error;
}

function allowedOrigins(config: JarbasConfig): ReadonlySet<string> {
  const origins = new Set(
    config.server.allowedOrigins.map((origin) => new URL(origin).origin)
  );
  for (const host of new Set([config.server.host, "127.0.0.1", "localhost"])) {
    const address = host.includes(":") ? `[${host}]` : host;
    origins.add(new URL(`http://${address}:${config.server.port}`).origin);
  }
  return origins;
}
