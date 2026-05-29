import { NextResponse } from "next/server";
import { readKeysWithRaw, readKeysSafe } from "@/lib/key-store";
import { getPoolManager } from "@/lib/pool-manager";

export async function GET() {
  const POOL = getPoolManager();
  await POOL.init();
  const safe = readKeysSafe();
  const status = POOL.getStatus();

  return NextResponse.json({
    keys: safe,
    instances: status.instances,
    totals: {
      total: status.totalKeys,
      healthy: status.healthyKeys,
      cooling: status.coolingKeys,
      unhealthy: status.unhealthyKeys,
      starting: 0,
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = String(body.action ?? "").trim();
  const id = String(body.id ?? "").trim();
  const POOL = getPoolManager();
  await POOL.init();
  const keysWithRaw = readKeysWithRaw();

  if (action === "start-all") {
    for (const key of keysWithRaw) {
      if (key.encryptedKey && key.rawKey) {
        await POOL.addInstance(key);
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "stop-all") {
    for (const key of keysWithRaw) {
      POOL.removeInstance(key.id);
    }
    return NextResponse.json({ ok: true });
  }

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const target = keysWithRaw.find((item) => item.id === id);
  if (!target) {
    return NextResponse.json({ error: "key not found" }, { status: 404 });
  }

  if (action === "start") {
    if (!target.rawKey) {
      return NextResponse.json({ error: "key not found or not decryptable" }, { status: 404 });
    }

    const instance = await POOL.addInstance(target);
    return NextResponse.json({ ok: true, instance: { keyId: instance.keyId, port: instance.port, status: instance.status } });
  }

  if (action === "stop") {
    POOL.removeInstance(id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}
