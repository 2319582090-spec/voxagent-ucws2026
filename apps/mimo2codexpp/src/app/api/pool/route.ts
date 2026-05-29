import { NextResponse } from "next/server";
import { getPoolManager } from "@/lib/pool-manager";
import { readKeysWithRaw } from "@/lib/key-store";

const POOL = getPoolManager();

/** POST /api/pool — start/restart a specific instance or init all */
export async function POST(request: Request) {
  const body = await request.json();
  const action = String(body.action ?? "");

  await POOL.init();

  if (action === "init") {
    // Pool is already initialized by init() above
    return NextResponse.json({ ok: true, message: "pool initialized" });
  }

  if (action === "restart" && body.keyId) {
    await POOL.restartInstance(body.keyId);
    return NextResponse.json({ ok: true, message: `restarting instance ${body.keyId}` });
  }

  if (action === "stop" && body.keyId) {
    POOL.removeInstance(body.keyId);
    return NextResponse.json({ ok: true, message: `stopped instance ${body.keyId}` });
  }

  if (action === "add" && body.keyId) {
    const keys = readKeysWithRaw();
    const key = keys.find((k) => k.id === body.keyId);
    if (!key?.rawKey) {
      return NextResponse.json({ error: "key not found or not decryptable" }, { status: 404 });
    }
    await POOL.addInstance(key);
    return NextResponse.json({ ok: true, message: `started instance for ${body.keyId}` });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
