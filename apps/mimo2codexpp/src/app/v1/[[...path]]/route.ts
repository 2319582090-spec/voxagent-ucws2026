import { NextResponse } from "next/server";
import { readKeysWithRaw } from "@/lib/key-store";
import { getPoolManager } from "@/lib/pool-manager";

const UPSTREAM_TIMEOUT_MS = 120_000;

async function readBody(request: Request) {
  try {
    return await request.arrayBuffer();
  } catch {
    return new ArrayBuffer(0);
  }
}

function buildUpstreamRequest(targetPort: number, pathname: string, request: Request, body: ArrayBuffer) {
  const targetUrl = `http://127.0.0.1:${targetPort}/v1/${pathname}`;
  const headers = new Headers();

  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "connection" || lower === "keep-alive" || lower === "transfer-encoding") {
      continue;
    }
    headers.set(key, value);
  }

  headers.set("host", `127.0.0.1:${targetPort}`);
  return new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : body,
  });
}

export async function GET(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  return proxyRequest(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  return proxyRequest(request, context);
}

export async function PUT(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  return proxyRequest(request, context);
}

export async function PATCH(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  return proxyRequest(request, context);
}

export async function DELETE(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  return proxyRequest(request, context);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "*",
    },
  });
}

async function proxyRequest(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  const joinedPath = (path ?? []).join("/");
  const body = await readBody(request);
  const POOL = getPoolManager();
  await POOL.init();
  const keys = readKeysWithRaw();

  if (keys.length === 0) {
    return NextResponse.json({ error: "no_api_keys_configured" }, { status: 503 });
  }

  // NOTE: Instances are now added during POOL.init(), not on every request.
  // This prevents instance duplication and pool instability.

  let attempt = 0;
  const maxAttempts = Math.min(keys.length, 3);

  while (attempt < maxAttempts) {
    const choice = POOL.selectAndBegin();

    if (!choice) {
      break;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    const start = Date.now();

    try {
      const upstream = await fetch(buildUpstreamRequest(choice.port, joinedPath, request, body), {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const elapsedMs = Date.now() - start;

      if (upstream.status === 429) {
        POOL.endRequest(choice.keyId, { success: false, status: 429, latencyMs: elapsedMs });
        attempt += 1;
        continue;
      }

      if (upstream.status >= 500) {
        POOL.endRequest(choice.keyId, { success: false, status: upstream.status, latencyMs: elapsedMs });
        attempt += 1;
        continue;
      }

      POOL.endRequest(choice.keyId, { success: true, latencyMs: elapsedMs });

      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.set("x-mimo-pp-selected-key", choice.keyId);
      responseHeaders.set("x-mimo-pp-instance-port", String(choice.port));
      responseHeaders.set("x-mimo-pp-attempt", String(attempt + 1));
      responseHeaders.set("x-mimo-pp-response-ms", String(elapsedMs));
      responseHeaders.delete("transfer-encoding");

      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch (error) {
      clearTimeout(timeout);
      POOL.endRequest(choice.keyId, { success: false, latencyMs: Date.now() - start });
      attempt += 1;

      if (attempt >= maxAttempts) {
        return NextResponse.json(
          { error: "upstream_request_failed", detail: String(error) },
          { status: 502 }
        );
      }
    }
  }

  return NextResponse.json({ error: "no_available_instances" }, { status: 503 });
}
