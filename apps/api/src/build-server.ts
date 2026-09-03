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

import {
  applySecurityHeaders,
  enforceOrigin,
  httpStatus,
  HttpError,
  readJsonBody,
  requireJsonContentType,
  sendJson,
  writeNdjson
} from "./http-boundary.js";

interface CreateSessionBody {
  readonly projectId?: string;
  readonly title?: string;
}

interface ChatBody {
  readonly sessionId: string;
  readonly content: string;
  readonly task?: ModelTask;
}

const modelTasks = new Set<ModelTask>([
  "simple_conversation",
  "deep_reasoning",
  "coding",
  "memory_extraction",
  "summarization",
  "tool_selection"
]);

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
        const status = httpStatus(error);
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
    requireJsonContentType(request);
    const body = validateCreateSessionBody(
      await readJsonBody(request, config.server.maxRequestBodyBytes)
    );
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
    requireJsonContentType(request);
    const body = validateChatBody(
      await readJsonBody(request, config.server.maxRequestBodyBytes)
    );
    if (body.content.length > config.server.maxMessageCharacters)
      throw new HttpError(413, "Message exceeds limit");
    const abortController = new AbortController();
    response.once("close", () => abortController.abort());
    const input: ChatRequest = {
      sessionId: body.sessionId,
      content: body.content,
      ...(body.task ? { task: body.task } : {})
    };
    const stream = application.chat(input, abortController.signal);
    const iterator = stream[Symbol.asyncIterator]();
    const first = await iterator.next();
    try {
      response.writeHead(200, {
        "content-type": "application/x-ndjson; charset=utf-8"
      });
      if (!first.done) await writeNdjson(response, first.value);
      while (true) {
        const item = await iterator.next();
        if (item.done) break;
        await writeNdjson(response, item.value);
      }
    } finally {
      await iterator.return?.();
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

function validateCreateSessionBody(
  body: Record<string, unknown>
): CreateSessionBody {
  return {
    ...(body.projectId === undefined
      ? {}
      : { projectId: requiredString(body.projectId, "projectId") }),
    ...(body.title === undefined
      ? {}
      : { title: requiredString(body.title, "title") })
  };
}

function validateChatBody(body: Record<string, unknown>): ChatBody {
  const sessionId = requiredString(body.sessionId, "sessionId");
  const content = requiredString(body.content, "content");
  if (!sessionId || !content.trim()) {
    throw new HttpError(400, "sessionId and content are required");
  }
  if (body.task !== undefined && !isModelTask(body.task)) {
    throw new HttpError(400, "task is invalid");
  }
  return {
    sessionId,
    content,
    ...(body.task === undefined ? {} : { task: body.task })
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string`);
  }
  return value;
}

function isModelTask(value: unknown): value is ModelTask {
  return typeof value === "string" && modelTasks.has(value as ModelTask);
}

const staticAssets: Readonly<
  Record<string, { file: string; contentType: string }>
> = {
  "/": { file: "index.html", contentType: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", contentType: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", contentType: "text/css; charset=utf-8" }
};
