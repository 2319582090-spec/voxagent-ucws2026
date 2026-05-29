import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { addKey, readKeysSafe, removeKey } from "@/lib/key-store";
import { encrypt } from "@/lib/encryption";
import { getPoolManager } from "@/lib/pool-manager";
import type { MiMoKeyRecord } from "@/lib/types";

export async function GET() {
  return NextResponse.json(readKeysSafe());
}

export async function POST(request: Request) {
  const body = await request.json();
  const rawKey = String(body.key ?? "").trim();

  if (!rawKey) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  // Check for duplicate keys by prefix+tail (weak but practical check)
  const existing = readKeysSafe();
  const prefix = rawKey.slice(0, 3);
  const tail = rawKey.slice(-4);
  const isDuplicate = existing.some(
    (k) => k.keyPrefix === prefix && k.keyTail === tail
  );
  if (isDuplicate) {
    return NextResponse.json({ error: "a key with the same prefix and tail already exists" }, { status: 409 });
  }

  const record: MiMoKeyRecord = {
    id: uuid(),
    label: String(body.label ?? "").trim() || "MiMo Key",
    keyPrefix: prefix,
    keyTail: tail,
    encryptedKey: encrypt(rawKey),
    hostType: rawKey.startsWith("tp-")
      ? "token-plan"
      : rawKey.startsWith("sk-")
        ? "pay-as-you-go"
        : "unknown",
    status: "unknown",
    instanceStatus: "stopped",
    metrics: {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      rateLimitCount: 0,
      timeoutCount: 0,
      avgLatencyMs: 0,
    },
  };

  const saved = addKey(record);

  // Auto-start instance for this key
  try {
    const manager = getPoolManager();
    await manager.addInstance({ ...record, rawKey: rawKey });
  } catch (err) {
    console.error("[keys] failed to start instance:", err);
  }

  return NextResponse.json(saved, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  removeKey(id);
  return NextResponse.json({ ok: true });
}
