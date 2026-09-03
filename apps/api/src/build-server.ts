import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { JarbasApplication } from "@jarvis/application";
import type { ChatRequest, JarbasConfig, ModelTask } from "@jarvis/contracts";

interface CreateSessionBody {
  readonly projectId?: string;
  readonly title?: string;
}

interface ChatBody {
  readonly sessionId?: string;
  readonly content?: string;
  readonly task?: ModelTask;
}

export function buildServer(
  config: JarbasConfig,
  application: JarbasApplication,
  webRoot = resolve(process.cwd(), "apps/web/public")
): Server {
  return createServer((request, response) => {
    void handleRequest(config, application, webRoot, request, response).catch(
      (error: unknown) => {
        if (response.headersSent) {
          response.destroy(error instanceof Error ? error : undefined);
          return;
        }
        const status = error instanceof HttpError ? error.status : 500;
        sendJson(response, status, {
          error:
            status < 500 && error instanceof Error
              ? error.message
              : "Request failed",
          code: error instanceof Error ? error.name : "UNKNOWN_ERROR"
        });
      }
    );
  });
}

async function handleRequest(
  config: JarbasConfig,
  application: JarbasApplication,
  webRoot: string,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  applySecurityHeaders(response);
  enforceOrigin(config, request, response);
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "localhost"}`
  );

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    });
    response.end();
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, await application.healthCheck());
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/config") {
    sendJson(response, 200, application.publicConfig());
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/sessions") {
    const body = await readJsonBody<CreateSessionBody>(request);
    const session = application.createSession(
      normalizedText(body.projectId, "inbox", 100),
      normalizedText(body.title, "Nova conversa", 200)
    );
    sendJson(response, 201, session);
    return;
  }
  const messagesMatch = /^\/api\/sessions\/([^/]+)\/messages$/u.exec(
    url.pathname
  );
  if (request.method === "GET" && messagesMatch?.[1]) {
    const sessionId = decodeURIComponent(messagesMatch[1]);
    if (!application.getSession(sessionId))
      throw new HttpError(404, "Session not found");
    sendJson(response, 200, application.listMessages(sessionId));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/chat") {
    const body = await readJsonBody<ChatBody>(request);
    if (!body.sessionId || !body.content?.trim()) {
      throw new HttpError(400, "sessionId and content are required");
    }
    if (body.content.length > 50_000)
      throw new HttpError(413, "Message exceeds limit");
    const abortController = new AbortController();
    response.once("close", () => abortController.abort());
    const input: ChatRequest = {
      sessionId: body.sessionId,
      content: body.content,
      ...(body.task ? { task: body.task } : {})
    };
    response.writeHead(200, {
      "content-type": "application/x-ndjson; charset=utf-8"
    });
    for await (const event of application.chat(input, abortController.signal)) {
      response.write(`${JSON.stringify(event)}\n`);
    }
    response.end();
    return;
  }
  if (request.method === "GET") {
    const asset = staticAssets[url.pathname];
    if (asset) {
      const body = await readFile(resolve(webRoot, asset.file));
      response.writeHead(200, { "content-type": asset.contentType });
      response.end(body);
      return;
    }
  }
  throw new HttpError(404, "Not found");
}

function normalizedText(
  value: string | undefined,
  fallback: string,
  maxLength: number
): string {
  const normalized = value?.trim() || fallback;
  return normalized.slice(0, maxLength);
}

class HttpError extends Error {
  public constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as Uint8Array);
    bytes += buffer.length;
    if (bytes > 1_000_000)
      throw new HttpError(413, "Request body exceeds limit");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown
): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function enforceOrigin(
  config: JarbasConfig,
  request: IncomingMessage,
  response: ServerResponse
): void {
  const origin = request.headers.origin;
  if (!origin) return;
  if (!config.server.allowedOrigins.includes(origin))
    throw new HttpError(403, "Origin not allowed");
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("vary", "Origin");
}

function applySecurityHeaders(response: ServerResponse): void {
  response.setHeader(
    "content-security-policy",
    "default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  );
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("cache-control", "no-store");
}

const staticAssets: Readonly<
  Record<string, { file: string; contentType: string }>
> = {
  "/": { file: "index.html", contentType: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", contentType: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", contentType: "text/css; charset=utf-8" }
};
